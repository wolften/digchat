<?php

namespace Tests\Feature;

use App\Models\AppSetting;
use App\Models\Contact;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\Sector;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class InboxTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Config::set('services.whatsapp.phone_number_id', '123456');
        Config::set('services.whatsapp.access_token', 'token');
    }

    private function makeConversation(
        string $status = Conversation::STATUS_QUEUED,
        ?User $assignedUser = null,
        string $contactName = 'Cliente',
        ?Contact $contact = null,
    ): Conversation
    {
        $contact ??= Contact::create([
            'wa_id' => '55'.fake()->numerify('4799999####'),
            'profile_name' => $contactName,
        ]);

        return $contact->conversations()->create([
            'status' => $status,
            'assigned_user_id' => $assignedUser?->id,
            'last_message_at' => now(),
        ]);
    }

    public function test_atendente_can_view_inbox(): void
    {
        $atendente = User::factory()->create(['role' => User::ROLE_ATENDENTE]);

        $this->actingAs($atendente)->get('/inbox')->assertOk();
    }

    public function test_agent_can_assume_a_conversation(): void
    {
        Http::fake([
            'graph.facebook.com/*' => Http::response(['messages' => [['id' => 'wamid.ASSIGN']]], 200),
        ]);

        $atendente = User::factory()->create(['role' => User::ROLE_ATENDENTE]);
        $conversation = $this->makeConversation();

        $this->actingAs($atendente)
            ->post("/inbox/{$conversation->id}/assign")
            ->assertRedirect();

        $conversation->refresh();
        $this->assertSame(Conversation::STATUS_OPEN, $conversation->status);
        $this->assertSame($atendente->id, $conversation->assigned_user_id);

        $this->assertDatabaseHas('messages', [
            'conversation_id' => $conversation->id,
            'direction' => Message::DIRECTION_OUT,
            'body' => sprintf('Usuário %s assumiu seu atendimento.', $atendente->name),
            'wa_message_id' => 'wamid.ASSIGN',
        ]);
    }

    public function test_assign_keeps_only_one_active_conversation_for_the_same_contact(): void
    {
        Http::fake([
            'graph.facebook.com/*' => Http::response(['messages' => [['id' => 'wamid.ASSIGN']]], 200),
        ]);

        $atendente = User::factory()->create(['role' => User::ROLE_ATENDENTE]);
        $contact = Contact::create([
            'wa_id' => '5547999992222',
            'profile_name' => 'Cliente Duplicado',
        ]);
        $conversationToAssign = $this->makeConversation(
            status: Conversation::STATUS_QUEUED,
            assignedUser: null,
            contact: $contact,
        );
        $duplicatedActive = $this->makeConversation(
            status: Conversation::STATUS_OPEN,
            assignedUser: null,
            contact: $contact,
        );

        $this->actingAs($atendente)
            ->post("/inbox/{$conversationToAssign->id}/assign")
            ->assertRedirect();

        $this->assertSame(Conversation::STATUS_OPEN, $conversationToAssign->fresh()->status);
        $this->assertSame($atendente->id, $conversationToAssign->fresh()->assigned_user_id);

        $duplicatedActive->refresh();
        $this->assertSame(Conversation::STATUS_CLOSED, $duplicatedActive->status);
        $this->assertNull($duplicatedActive->assigned_user_id);
    }

    public function test_atendente_does_not_list_open_conversations_assigned_to_another_agent(): void
    {
        $atendente = User::factory()->create(['role' => User::ROLE_ATENDENTE]);
        $otherAtendente = User::factory()->create(['role' => User::ROLE_ATENDENTE]);

        $this->makeConversation(Conversation::STATUS_OPEN, $atendente, 'Minha conversa');
        $this->makeConversation(Conversation::STATUS_OPEN, $otherAtendente, 'Conversa de outro');

        $response = $this->actingAs($atendente)->get('/inbox?filter=open');

        $response->assertOk();
        $response->assertSee('Minha conversa');
        $response->assertDontSee('Conversa de outro');
    }

    public function test_atendente_cannot_open_conversation_assigned_to_another_agent(): void
    {
        $atendente = User::factory()->create(['role' => User::ROLE_ATENDENTE]);
        $otherAtendente = User::factory()->create(['role' => User::ROLE_ATENDENTE]);
        $conversation = $this->makeConversation(Conversation::STATUS_OPEN, $otherAtendente);

        $this->actingAs($atendente)->get("/inbox/{$conversation->id}")->assertForbidden();
    }

    public function test_agent_can_send_a_message(): void
    {
        Http::fake([
            'graph.facebook.com/*' => Http::response(['messages' => [['id' => 'wamid.OUT']]], 200),
        ]);

        $atendente = User::factory()->create(['role' => User::ROLE_ATENDENTE]);
        $conversation = $this->makeConversation(Conversation::STATUS_OPEN, $atendente);

        $this->actingAs($atendente)
            ->post("/inbox/{$conversation->id}/messages", ['body' => 'Olá, como posso ajudar?'])
            ->assertRedirect();

        $this->assertDatabaseHas('messages', [
            'conversation_id' => $conversation->id,
            'direction' => Message::DIRECTION_OUT,
            'sender_user_id' => $atendente->id,
            'body' => 'Olá, como posso ajudar?',
            'wa_message_id' => 'wamid.OUT',
        ]);
    }

    public function test_atendente_cannot_send_message_in_open_conversation_assigned_to_another_agent(): void
    {
        $atendente = User::factory()->create(['role' => User::ROLE_ATENDENTE]);
        $otherAtendente = User::factory()->create(['role' => User::ROLE_ATENDENTE]);
        $conversation = $this->makeConversation(Conversation::STATUS_OPEN, $otherAtendente);

        $this->actingAs($atendente)
            ->post("/inbox/{$conversation->id}/messages", ['body' => 'Tentativa'])
            ->assertForbidden();
    }

    public function test_send_failure_surfaces_whatsapp_api_error_message(): void
    {
        Http::fake([
            'graph.facebook.com/*' => Http::response([
                'error' => [
                    'message' => '(#131030) Recipient phone number not in allowed list',
                    'error_data' => [
                        'details' => 'O número de telefone do destinatário não está na lista de permissão.',
                    ],
                ],
            ], 400),
        ]);

        $atendente = User::factory()->create(['role' => User::ROLE_ATENDENTE]);
        $conversation = $this->makeConversation(Conversation::STATUS_OPEN, $atendente);

        $this->actingAs($atendente)
            ->from('/inbox')
            ->post("/inbox/{$conversation->id}/messages", ['body' => 'Mensagem teste'])
            ->assertRedirect('/inbox')
            ->assertSessionHasErrors([
                'send' => 'O número de telefone do destinatário não está na lista de permissão.',
            ]);
    }

    public function test_send_failure_surfaces_invalid_whatsapp_token_diagnostic(): void
    {
        Http::fake([
            'graph.facebook.com/*' => Http::response([
                'error' => [
                    'message' => 'Error validating access token: Session has expired',
                    'type' => 'OAuthException',
                    'code' => 190,
                ],
            ], 401),
        ]);

        $atendente = User::factory()->create(['role' => User::ROLE_ATENDENTE]);
        $conversation = $this->makeConversation(Conversation::STATUS_OPEN, $atendente);

        $this->actingAs($atendente)
            ->from('/inbox')
            ->post("/inbox/{$conversation->id}/messages", ['body' => 'Mensagem teste'])
            ->assertRedirect('/inbox')
            ->assertSessionHasErrors([
                'send' => 'WhatsApp recusou a autenticação: token inválido ou expirado. Gere um novo token permanente de System User com permissão whatsapp_business_messaging, salve em Configurações e rode o teste de conexão novamente.',
            ]);
    }

    public function test_atendente_cannot_assume_open_conversation_already_assigned_to_other_agent(): void
    {
        $atendente = User::factory()->create(['role' => User::ROLE_ATENDENTE]);
        $otherAtendente = User::factory()->create(['role' => User::ROLE_ATENDENTE]);
        $conversation = $this->makeConversation(Conversation::STATUS_OPEN, $otherAtendente);

        $this->actingAs($atendente)
            ->post("/inbox/{$conversation->id}/assign")
            ->assertForbidden();

        $this->assertSame($otherAtendente->id, $conversation->fresh()->assigned_user_id);
    }

    public function test_agent_can_close_and_reopen(): void
    {
        $atendente = User::factory()->create(['role' => User::ROLE_ATENDENTE]);
        $conversation = $this->makeConversation(Conversation::STATUS_OPEN, $atendente);

        $this->actingAs($atendente)->post("/inbox/{$conversation->id}/close")->assertRedirect();
        $this->assertSame(Conversation::STATUS_CLOSED, $conversation->fresh()->status);

        $this->actingAs($atendente)->post("/inbox/{$conversation->id}/assign")->assertRedirect();
        $this->assertSame(Conversation::STATUS_OPEN, $conversation->fresh()->status);
    }

    public function test_atendente_cannot_close_conversation_assigned_to_another_agent(): void
    {
        $atendente = User::factory()->create(['role' => User::ROLE_ATENDENTE]);
        $otherAtendente = User::factory()->create(['role' => User::ROLE_ATENDENTE]);
        $conversation = $this->makeConversation(Conversation::STATUS_OPEN, $otherAtendente);

        $this->actingAs($atendente)->post("/inbox/{$conversation->id}/close")->assertForbidden();

        $conversation->refresh();
        $this->assertSame(Conversation::STATUS_OPEN, $conversation->status);
        $this->assertSame($otherAtendente->id, $conversation->assigned_user_id);
    }

    public function test_transfer_sends_customer_notice_when_enabled(): void
    {
        Http::fake([
            'graph.facebook.com/*' => Http::response(['messages' => [['id' => 'wamid.TRANSFER']]], 200),
        ]);

        AppSetting::set('notify_customer_on_transfer', '1');

        $atendente = User::factory()->create(['role' => User::ROLE_ATENDENTE]);
        $conversation = $this->makeConversation(Conversation::STATUS_OPEN, $atendente);
        $sector = Sector::create([
            'name' => 'Financeiro',
            'is_active' => true,
        ]);

        $this->actingAs($atendente)
            ->post("/inbox/{$conversation->id}/transfer", ['sector_id' => $sector->id])
            ->assertRedirect();

        $conversation->refresh();
        $this->assertSame(Conversation::STATUS_QUEUED, $conversation->status);
        $this->assertNull($conversation->assigned_user_id);
        $this->assertSame($sector->id, $conversation->sector_id);

        $this->assertDatabaseHas('messages', [
            'conversation_id' => $conversation->id,
            'direction' => Message::DIRECTION_OUT,
            'body' => 'Seu atendimento foi transferido para o setor Financeiro. Em breve um atendente dará continuidade.',
            'wa_message_id' => 'wamid.TRANSFER',
        ]);

        Http::assertSentCount(1);
    }

    public function test_transfer_does_not_send_customer_notice_when_disabled(): void
    {
        Http::fake();

        AppSetting::set('notify_customer_on_transfer', '0');

        $atendente = User::factory()->create(['role' => User::ROLE_ATENDENTE]);
        $conversation = $this->makeConversation(Conversation::STATUS_OPEN, $atendente);
        $sector = Sector::create([
            'name' => 'Suporte',
            'is_active' => true,
        ]);

        $this->actingAs($atendente)
            ->post("/inbox/{$conversation->id}/transfer", ['sector_id' => $sector->id])
            ->assertRedirect();

        $this->assertDatabaseMissing('messages', [
            'conversation_id' => $conversation->id,
            'direction' => Message::DIRECTION_OUT,
            'body' => 'Seu atendimento foi transferido para o setor Suporte. Em breve um atendente dará continuidade.',
        ]);

        Http::assertNothingSent();
    }

    public function test_admin_can_view_all_assume_and_only_send_after_assuming(): void
    {
        Http::fake([
            'graph.facebook.com/*' => Http::sequence()
                ->push(['messages' => [['id' => 'wamid.ADMIN.ASSIGN']]], 200)
                ->push(['messages' => [['id' => 'wamid.ADMIN']]], 200),
        ]);

        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
        $atendente = User::factory()->create(['role' => User::ROLE_ATENDENTE]);
        $conversation = $this->makeConversation(Conversation::STATUS_OPEN, $atendente, 'Conversa monitorada');

        $this->actingAs($admin)->get('/inbox?filter=open')->assertOk()->assertSee('Conversa monitorada');

        $this->actingAs($admin)
            ->post("/inbox/{$conversation->id}/messages", ['body' => 'Tentativa sem assumir'])
            ->assertForbidden();

        $this->actingAs($admin)->post("/inbox/{$conversation->id}/assign")->assertRedirect();
        $this->assertSame($admin->id, $conversation->fresh()->assigned_user_id);

        $this->actingAs($admin)
            ->post("/inbox/{$conversation->id}/messages", ['body' => 'Agora assumida'])
            ->assertRedirect();

        $this->assertDatabaseHas('messages', [
            'conversation_id' => $conversation->id,
            'direction' => Message::DIRECTION_OUT,
            'sender_user_id' => $admin->id,
            'body' => 'Agora assumida',
            'wa_message_id' => 'wamid.ADMIN',
        ]);
    }

    public function test_media_endpoint_returns_403_for_user_without_access_to_the_conversation(): void
    {
        $owner = User::factory()->create(['role' => User::ROLE_ATENDENTE]);
        $outsider = User::factory()->create(['role' => User::ROLE_ATENDENTE]);
        $conversation = $this->makeConversation(Conversation::STATUS_OPEN, $owner);
        $message = $conversation->messages()->create([
            'direction' => Message::DIRECTION_IN,
            'type' => 'image',
            'body' => '[image]',
            'status' => 'received',
            'payload' => ['image' => ['id' => 'media-forbidden']],
        ]);

        $this->actingAs($outsider)
            ->get("/inbox/messages/{$message->id}/media")
            ->assertForbidden();
    }

    public function test_media_endpoint_surfaces_invalid_whatsapp_token_diagnostic(): void
    {
        Http::fake([
            'graph.facebook.com/*' => Http::response([
                'error' => [
                    'message' => 'Error validating access token: Session has expired',
                    'type' => 'OAuthException',
                    'code' => 190,
                ],
            ], 401),
        ]);

        $owner = User::factory()->create(['role' => User::ROLE_ATENDENTE]);
        $conversation = $this->makeConversation(Conversation::STATUS_OPEN, $owner);
        $message = $conversation->messages()->create([
            'direction' => Message::DIRECTION_IN,
            'type' => 'image',
            'body' => '[image]',
            'status' => 'received',
            'payload' => ['image' => ['id' => 'media-expired-token']],
        ]);

        $this->actingAs($owner)
            ->get("/inbox/messages/{$message->id}/media")
            ->assertStatus(502)
            ->assertSee('token inválido ou expirado');
    }

    public function test_guests_cannot_access_inbox(): void
    {
        $this->get('/inbox')->assertRedirect('/login');
    }
}
