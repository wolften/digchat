<?php

namespace Tests\Feature;

use App\Models\Contact;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
use App\Services\Conversation\ConversationSnoozeService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ConversationSnoozeTest extends TestCase
{
    use RefreshDatabase;

    private function makeOpenConversation(?User $assignedUser = null): Conversation
    {
        $contact = Contact::create([
            'wa_id' => '5547999991001',
            'profile_name' => 'Cliente',
        ]);

        return $contact->conversations()->create([
            'status' => Conversation::STATUS_OPEN,
            'assigned_user_id' => $assignedUser?->id,
            'last_message_at' => now(),
        ]);
    }

    public function test_agent_can_snooze_assigned_conversation(): void
    {
        $agent = User::factory()->create(['role' => User::ROLE_ATENDENTE]);
        $conversation = $this->makeOpenConversation($agent);
        $until = now()->addHours(2);

        $this->actingAs($agent)
            ->post(route('inbox.snooze', $conversation), [
                'snoozed_until' => $until->toIso8601String(),
                'note' => 'Retornar com status da visita',
            ])
            ->assertRedirect()
            ->assertSessionHas('success');

        $conversation->refresh();
        $this->assertSame(Conversation::STATUS_SNOOZED, $conversation->status);
        $this->assertSame($agent->id, $conversation->assigned_user_id);
        $this->assertSame('Retornar com status da visita', $conversation->snooze_note);
        $this->assertNotNull($conversation->snoozed_until);
    }

    public function test_snoozed_conversation_is_hidden_from_default_inbox_list(): void
    {
        $agent = User::factory()->create(['role' => User::ROLE_ATENDENTE]);
        $conversation = $this->makeOpenConversation($agent);

        app(ConversationSnoozeService::class)->snooze(
            $conversation,
            $agent,
            now()->addHour(),
        );

        $this->actingAs($agent)
            ->get(route('inbox.index'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('filter', 'mine')
                ->has('conversations', 0));
    }

    public function test_snoozed_conversation_appears_in_snoozed_filter(): void
    {
        $agent = User::factory()->create(['role' => User::ROLE_ATENDENTE]);
        $conversation = $this->makeOpenConversation($agent);

        app(ConversationSnoozeService::class)->snooze(
            $conversation,
            $agent,
            now()->addHour(),
        );

        $this->actingAs($agent)
            ->get(route('inbox.index', ['filter' => 'snoozed']))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('filter', 'snoozed')
                ->where('counts.snoozed', 1)
                ->where('conversations.0.id', $conversation->id)
                ->where('conversations.0.status', Conversation::STATUS_SNOOZED));
    }

    public function test_agent_can_wake_snoozed_conversation(): void
    {
        $agent = User::factory()->create(['role' => User::ROLE_ATENDENTE]);
        $conversation = $this->makeOpenConversation($agent);
        $service = app(ConversationSnoozeService::class);
        $service->snooze($conversation, $agent, now()->addHour());

        $this->actingAs($agent)
            ->post(route('inbox.wake', $conversation))
            ->assertRedirect()
            ->assertSessionHas('success');

        $conversation->refresh();
        $this->assertSame(Conversation::STATUS_OPEN, $conversation->status);
        $this->assertNull($conversation->snoozed_until);
        $this->assertNull($conversation->snooze_note);
    }

    public function test_expired_snooze_is_woken_by_scheduler(): void
    {
        $agent = User::factory()->create(['role' => User::ROLE_ATENDENTE]);
        $conversation = $this->makeOpenConversation($agent);

        $conversation->forceFill([
            'status' => Conversation::STATUS_SNOOZED,
            'snoozed_until' => now()->subMinute(),
            'snoozed_by_user_id' => $agent->id,
            'snooze_note' => 'Lembrete',
        ])->save();

        $this->artisan('conversations:wake-snoozed')->assertSuccessful();

        $conversation->refresh();
        $this->assertSame(Conversation::STATUS_OPEN, $conversation->status);
        $this->assertNull($conversation->snoozed_until);
    }

    public function test_inbound_message_wakes_snoozed_conversation(): void
    {
        $agent = User::factory()->create(['role' => User::ROLE_ATENDENTE]);
        $conversation = $this->makeOpenConversation($agent);

        $conversation->forceFill([
            'status' => Conversation::STATUS_SNOOZED,
            'snoozed_until' => now()->addHour(),
            'snoozed_by_user_id' => $agent->id,
        ])->save();

        $conversation->messages()->create([
            'direction' => Message::DIRECTION_IN,
            'type' => 'text',
            'body' => 'Olá',
            'wa_message_id' => 'wamid.TEST',
        ]);

        $woken = app(ConversationSnoozeService::class)->wakeOnInboundIfNeeded($conversation->fresh());

        $this->assertSame(Conversation::STATUS_OPEN, $woken->status);
        $this->assertNull($woken->snoozed_until);
    }

    public function test_snooze_stores_browser_utc_iso_in_app_timezone(): void
    {
        $agent = User::factory()->create(['role' => User::ROLE_ATENDENTE]);
        $conversation = $this->makeOpenConversation($agent);

        $localUntil = now('America/Sao_Paulo')->addDay()->setTime(17, 10, 0);
        $browserIso = $localUntil->copy()->utc()->format('Y-m-d\TH:i:s\Z');

        $this->actingAs($agent)
            ->post(route('inbox.snooze', $conversation), [
                'snoozed_until' => $browserIso,
            ])
            ->assertRedirect()
            ->assertSessionHas('success');

        $conversation->refresh();
        $stored = $conversation->snoozed_until?->timezone('America/Sao_Paulo');

        $this->assertNotNull($stored);
        $this->assertSame(17, $stored->hour);
        $this->assertSame(10, $stored->minute);
    }

    public function test_agent_cannot_snooze_conversation_assigned_to_another_agent(): void
    {
        $owner = User::factory()->create(['role' => User::ROLE_ATENDENTE]);
        $other = User::factory()->create(['role' => User::ROLE_ATENDENTE]);
        $conversation = $this->makeOpenConversation($owner);

        $this->actingAs($other)
            ->post(route('inbox.snooze', $conversation), [
                'snoozed_until' => now()->addHour()->toIso8601String(),
            ])
            ->assertForbidden();
    }
}