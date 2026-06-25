<?php

namespace Tests\Feature;

use App\Events\ConversationUpdated;
use App\Models\Contact;
use App\Models\Conversation;
use App\Models\Message;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class WhatsAppWebhookTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Config::set('services.whatsapp.verify_token', 'test-verify');
        Config::set('services.whatsapp.app_secret', null); // pula validação de assinatura nos testes
        Config::set('services.whatsapp.phone_number_id', '123456');
        Config::set('services.whatsapp.access_token', 'token');
    }

    public function test_webhook_verification_succeeds_with_correct_token(): void
    {
        $this->get('/api/webhooks/whatsapp?hub_mode=subscribe&hub_verify_token=test-verify&hub_challenge=12345')
            ->assertOk()
            ->assertSee('12345');
    }

    public function test_webhook_verification_fails_with_wrong_token(): void
    {
        $this->get('/api/webhooks/whatsapp?hub_mode=subscribe&hub_verify_token=wrong&hub_challenge=12345')
            ->assertForbidden();
    }

    public function test_inbound_text_message_is_persisted_and_queued_to_human(): void
    {
        Http::fake([
            'graph.facebook.com/*' => Http::response([
                'messages' => [['id' => 'wamid.OUT1']],
            ], 200),
        ]);

        $payload = $this->inboundTextPayload('5547999990000', 'Olá, preciso de ajuda', 'wamid.IN1');

        $this->postJson('/api/webhooks/whatsapp', $payload)
            ->assertOk()
            ->assertSee('EVENT_RECEIVED');

        $this->assertDatabaseHas('contacts', ['wa_id' => '5547999990000']);
        $this->assertDatabaseHas('messages', [
            'wa_message_id' => 'wamid.IN1',
            'direction' => Message::DIRECTION_IN,
            'body' => 'Olá, preciso de ajuda',
        ]);

        $conversation = Conversation::first();
        $this->assertSame(Conversation::STATUS_QUEUED, $conversation->status);
        $this->assertSame(0, $conversation->messages()->where('direction', Message::DIRECTION_OUT)->count());
    }

    public function test_duplicate_inbound_message_is_ignored(): void
    {
        Http::fake(['graph.facebook.com/*' => Http::response(['messages' => [['id' => 'x']]], 200)]);

        $payload = $this->inboundTextPayload('5547999990001', 'oi', 'wamid.DUP');

        $this->postJson('/api/webhooks/whatsapp', $payload)->assertOk();
        $this->postJson('/api/webhooks/whatsapp', $payload)->assertOk();

        $this->assertSame(1, Message::where('wa_message_id', 'wamid.DUP')->count());
    }

    public function test_inbound_message_moves_legacy_bot_conversation_to_queue(): void
    {
        Http::fake(['graph.facebook.com/*' => Http::response(['messages' => [['id' => 'x']]], 200)]);

        $contact = Contact::create(['wa_id' => '5547999990003']);
        $conversation = $contact->conversations()->create([
            'status' => Conversation::STATUS_BOT,
            'last_message_at' => now(),
        ]);

        $this->postJson(
            '/api/webhooks/whatsapp',
            $this->inboundTextPayload('5547999990003', 'oi', 'wamid.LEGACY'),
        )->assertOk();

        $this->assertSame(Conversation::STATUS_QUEUED, $conversation->fresh()->status);
    }

    public function test_status_update_marks_message(): void
    {
        $contact = Contact::create(['wa_id' => '5547999990002']);
        $conversation = $contact->conversations()->create([
            'status' => Conversation::STATUS_OPEN,
            'last_message_at' => now(),
        ]);
        $conversation->messages()->create([
            'direction' => Message::DIRECTION_OUT,
            'type' => 'text',
            'body' => 'oi',
            'wa_message_id' => 'wamid.S1',
            'status' => 'sent',
        ]);

        Event::fake([ConversationUpdated::class]);

        $statusPayload = [
            'entry' => [[
                'changes' => [[
                    'value' => [
                        'statuses' => [[
                            'id' => 'wamid.S1',
                            'status' => 'read',
                            'recipient_id' => '5547999990002',
                        ]],
                    ],
                ]],
            ]],
        ];

        $this->postJson('/api/webhooks/whatsapp', $statusPayload)->assertOk();

        $this->assertDatabaseHas('messages', ['wa_message_id' => 'wamid.S1', 'status' => 'read']);
        Event::assertDispatched(
            ConversationUpdated::class,
            fn (ConversationUpdated $event) => $event->conversation->is($conversation),
        );
    }

    public function test_inbound_reply_marks_previous_outbound_messages_as_read(): void
    {
        Http::fake(['graph.facebook.com/*' => Http::response(['messages' => [['id' => 'x']]], 200)]);

        $contact = Contact::create(['wa_id' => '5547999990004']);
        $conversation = $contact->conversations()->create([
            'status' => Conversation::STATUS_OPEN,
            'last_message_at' => now(),
        ]);
        $outbound = $conversation->messages()->create([
            'direction' => Message::DIRECTION_OUT,
            'type' => 'text',
            'body' => 'olá',
            'wa_message_id' => 'wamid.OUTBOUND',
            'status' => 'sent',
        ]);

        $this->postJson(
            '/api/webhooks/whatsapp',
            $this->inboundTextPayload('5547999990004', 'tudo bom?', 'wamid.REPLY'),
        )->assertOk();

        $this->assertSame('read', $outbound->fresh()->status);
        $this->assertDatabaseHas('messages', [
            'wa_message_id' => 'wamid.REPLY',
            'direction' => Message::DIRECTION_IN,
            'body' => 'tudo bom?',
        ]);
    }

    public function test_inbound_message_closes_duplicated_active_conversations_for_same_contact(): void
    {
        Http::fake(['graph.facebook.com/*' => Http::response(['messages' => [['id' => 'x']]], 200)]);

        $contact = Contact::create(['wa_id' => '5547999990005']);
        $olderConversation = $contact->conversations()->create([
            'status' => Conversation::STATUS_OPEN,
            'last_message_at' => now()->subMinute(),
        ]);
        $newerConversation = $contact->conversations()->create([
            'status' => Conversation::STATUS_QUEUED,
            'last_message_at' => now(),
        ]);

        $this->postJson(
            '/api/webhooks/whatsapp',
            $this->inboundTextPayload('5547999990005', 'nova mensagem', 'wamid.DEDUP'),
        )->assertOk();

        $this->assertDatabaseHas('messages', [
            'conversation_id' => $newerConversation->id,
            'wa_message_id' => 'wamid.DEDUP',
        ]);

        $olderConversation->refresh();
        $this->assertSame(Conversation::STATUS_CLOSED, $olderConversation->status);
        $this->assertNull($olderConversation->assigned_user_id);
    }

    /**
     * @return array<string, mixed>
     */
    private function inboundTextPayload(string $from, string $text, string $messageId): array
    {
        return [
            'object' => 'whatsapp_business_account',
            'entry' => [[
                'id' => 'WABA_ID',
                'changes' => [[
                    'field' => 'messages',
                    'value' => [
                        'messaging_product' => 'whatsapp',
                        'metadata' => ['phone_number_id' => '123456'],
                        'contacts' => [[
                            'wa_id' => $from,
                            'profile' => ['name' => 'Cliente Teste'],
                        ]],
                        'messages' => [[
                            'from' => $from,
                            'id' => $messageId,
                            'timestamp' => (string) now()->timestamp,
                            'type' => 'text',
                            'text' => ['body' => $text],
                        ]],
                    ],
                ]],
            ]],
        ];
    }
}
