<?php

namespace Tests\Feature;

use App\Models\AppSetting;
use App\Models\Contact;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CloseInactiveConversationsTest extends TestCase
{
    use RefreshDatabase;

    private function makeOpenConversationWithLastMessage(string $direction, int $minutesAgo): Conversation
    {
        $contact = Contact::create([
            'wa_id' => '55'.fake()->numerify('4799999####'),
            'profile_name' => 'Cliente',
        ]);

        $conversation = $contact->conversations()->create([
            'status' => Conversation::STATUS_OPEN,
            'assigned_user_id' => User::factory()->create(['role' => User::ROLE_ATENDENTE])->id,
            'last_message_at' => now()->subMinutes($minutesAgo),
        ]);

        $message = $conversation->messages()->create([
            'direction' => $direction,
            'type' => 'text',
            'body' => 'Mensagem de teste',
            'status' => $direction === Message::DIRECTION_OUT ? 'sent' : 'received',
        ]);

        $sentAt = now()->subMinutes($minutesAgo);
        $message->forceFill([
            'created_at' => $sentAt,
            'updated_at' => $sentAt,
        ])->save();

        return $conversation;
    }

    public function test_command_does_not_close_when_setting_is_disabled(): void
    {
        AppSetting::set('auto_close_inactive_conversations_enabled', '0');
        AppSetting::set('auto_close_inactive_conversations_minutes', '30');

        $conversation = $this->makeOpenConversationWithLastMessage(Message::DIRECTION_OUT, 45);

        $this->artisan('conversations:close-inactive')
            ->expectsOutputToContain('Auto close is disabled.')
            ->assertSuccessful();

        $this->assertSame(Conversation::STATUS_OPEN, $conversation->fresh()->status);
    }

    public function test_command_closes_open_conversation_after_customer_inactivity(): void
    {
        AppSetting::set('auto_close_inactive_conversations_enabled', '1');
        AppSetting::set('auto_close_inactive_conversations_minutes', '30');

        $conversation = $this->makeOpenConversationWithLastMessage(Message::DIRECTION_OUT, 45);

        $this->artisan('conversations:close-inactive')
            ->expectsOutputToContain('Closed 1 inactive conversation(s).')
            ->assertSuccessful();

        $this->assertSame(Conversation::STATUS_CLOSED, $conversation->fresh()->status);
    }

    public function test_command_keeps_conversation_open_when_last_message_is_from_customer(): void
    {
        AppSetting::set('auto_close_inactive_conversations_enabled', '1');
        AppSetting::set('auto_close_inactive_conversations_minutes', '30');

        $conversation = $this->makeOpenConversationWithLastMessage(Message::DIRECTION_IN, 45);

        $this->artisan('conversations:close-inactive')
            ->expectsOutputToContain('Closed 0 inactive conversation(s).')
            ->assertSuccessful();

        $this->assertSame(Conversation::STATUS_OPEN, $conversation->fresh()->status);
    }

    public function test_command_keeps_recent_outbound_conversation_open(): void
    {
        AppSetting::set('auto_close_inactive_conversations_enabled', '1');
        AppSetting::set('auto_close_inactive_conversations_minutes', '30');

        $conversation = $this->makeOpenConversationWithLastMessage(Message::DIRECTION_OUT, 10);

        $this->artisan('conversations:close-inactive')
            ->expectsOutputToContain('Closed 0 inactive conversation(s).')
            ->assertSuccessful();

        $this->assertSame(Conversation::STATUS_OPEN, $conversation->fresh()->status);
    }

    public function test_command_keeps_conversation_open_when_last_outbound_message_failed(): void
    {
        AppSetting::set('auto_close_inactive_conversations_enabled', '1');
        AppSetting::set('auto_close_inactive_conversations_minutes', '30');

        $conversation = $this->makeOpenConversationWithLastMessage(Message::DIRECTION_OUT, 45);
        $conversation->messages()->latest()->first()->forceFill(['status' => 'failed'])->save();

        $this->artisan('conversations:close-inactive')
            ->expectsOutputToContain('Closed 0 inactive conversation(s).')
            ->assertSuccessful();

        $this->assertSame(Conversation::STATUS_OPEN, $conversation->fresh()->status);
    }
}
