<?php

namespace Tests\Feature;

use App\Models\Channel;
use App\Models\Contact;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class ConversationInternalNoteTest extends TestCase
{
    use RefreshDatabase;

    private function makeOpenConversation(?User $assignedUser = null): Conversation
    {
        $contact = Contact::create([
            'wa_id' => '55'.fake()->numerify('4799999####'),
            'profile_name' => 'Cliente',
        ]);

        return $contact->conversations()->create([
            'status' => Conversation::STATUS_OPEN,
            'assigned_user_id' => $assignedUser?->id,
            'last_message_at' => now(),
        ]);
    }

    public function test_manager_can_send_internal_note_without_assuming(): void
    {
        Http::fake();

        $gestor = User::factory()->create(['role' => User::ROLE_GESTOR]);
        $atendente = User::factory()->create(['role' => User::ROLE_ATENDENTE]);
        $conversation = $this->makeOpenConversation($atendente);

        $this->actingAs($gestor)
            ->postJson("/inbox/{$conversation->id}/internal-messages", [
                'body' => 'Sugira o plano premium para este cliente.',
            ])
            ->assertCreated()
            ->assertJsonPath('body', 'Sugira o plano premium para este cliente.')
            ->assertJsonPath('is_internal', true)
            ->assertJsonPath('sender.id', $gestor->id);

        $this->assertDatabaseHas('messages', [
            'conversation_id' => $conversation->id,
            'direction' => Message::DIRECTION_OUT,
            'sender_user_id' => $gestor->id,
            'body' => 'Sugira o plano premium para este cliente.',
            'is_internal' => true,
            'wa_message_id' => null,
            'status' => 'accepted',
        ]);

        Http::assertNothingSent();
    }

    public function test_assignee_can_send_internal_note(): void
    {
        Http::fake();

        $atendente = User::factory()->create(['role' => User::ROLE_ATENDENTE]);
        $conversation = $this->makeOpenConversation($atendente);

        $this->actingAs($atendente)
            ->post("/inbox/{$conversation->id}/internal-messages", [
                'body' => 'Preciso de ajuda com a política de reembolso.',
            ])
            ->assertRedirect();

        $this->assertDatabaseHas('messages', [
            'conversation_id' => $conversation->id,
            'sender_user_id' => $atendente->id,
            'is_internal' => true,
        ]);

        Http::assertNothingSent();
    }

    public function test_non_assignee_atendente_cannot_send_internal_note(): void
    {
        $owner = User::factory()->create(['role' => User::ROLE_ATENDENTE]);
        $outsider = User::factory()->create(['role' => User::ROLE_ATENDENTE]);
        $conversation = $this->makeOpenConversation($owner);

        $this->actingAs($outsider)
            ->post("/inbox/{$conversation->id}/internal-messages", [
                'body' => 'Tentativa indevida',
            ])
            ->assertForbidden();
    }

    public function test_inbox_payload_includes_internal_flags(): void
    {
        $gestor = User::factory()->create(['role' => User::ROLE_GESTOR]);
        $atendente = User::factory()->create(['role' => User::ROLE_ATENDENTE]);
        $conversation = $this->makeOpenConversation($atendente);

        $conversation->messages()->create([
            'direction' => Message::DIRECTION_OUT,
            'type' => 'text',
            'body' => 'Nota interna',
            'status' => 'accepted',
            'sender_user_id' => $gestor->id,
            'is_internal' => true,
        ]);

        $this->actingAs($gestor)
            ->get("/inbox/{$conversation->id}")
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('selected.can_send_internal', true)
                ->has('selected.messages', 1)
                ->where('selected.messages.0.is_internal', true)
            );
    }

    public function test_webchat_poll_excludes_internal_messages(): void
    {
        $channel = Channel::create([
            'name' => 'WebChat',
            'type' => Channel::TYPE_WEB,
            'config' => ['api_key' => 'test-key'],
            'is_active' => true,
        ]);

        $contact = Contact::create([
            'wa_id' => 'web_visitor_1',
            'channel_id' => $channel->id,
        ]);

        $conversation = $contact->conversations()->create([
            'channel_id' => $channel->id,
            'status' => Conversation::STATUS_OPEN,
            'last_message_at' => now(),
        ]);

        $public = $conversation->messages()->create([
            'direction' => Message::DIRECTION_OUT,
            'type' => 'text',
            'body' => 'Olá, como posso ajudar?',
            'status' => 'sent',
        ]);

        $conversation->messages()->create([
            'direction' => Message::DIRECTION_OUT,
            'type' => 'text',
            'body' => 'Nota interna oculta',
            'status' => 'accepted',
            'sender_user_id' => User::factory()->create()->id,
            'is_internal' => true,
        ]);

        $sessionToken = Crypt::encryptString(json_encode([
            'contact_id' => $contact->id,
            'channel_id' => $channel->id,
            'conversation_id' => $conversation->id,
            'exp' => now()->addDays(7)->timestamp,
        ]));

        $response = $this->getJson("/api/webchat/{$channel->id}/messages?session={$sessionToken}")
            ->assertOk();

        $ids = collect($response->json('messages'))->pluck('id')->all();

        $this->assertContains($public->id, $ids);
        $this->assertCount(1, $ids);
    }
}