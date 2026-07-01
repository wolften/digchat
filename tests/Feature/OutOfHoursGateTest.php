<?php

namespace Tests\Feature;

use App\Contracts\MessagingChannel;
use App\Jobs\ProcessInboundMessage;
use App\Jobs\ProcessTelegramMessage;
use App\Jobs\ProcessWebChatMessage;
use App\Models\AppSetting;
use App\Models\BusinessHour;
use App\Models\Channel;
use App\Models\Contact;
use App\Models\Conversation;
use App\Models\Flow;
use App\Models\Message;
use App\Services\OutOfHoursGate;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class OutOfHoursGateTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config(['app.timezone' => 'America/Sao_Paulo']);
    }

    public function test_gate_sends_out_of_hours_message_and_blocks_flow(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-07-07 20:00:00', 'America/Sao_Paulo'));
        $this->seedClosedGlobalHours();
        AppSetting::setMany([
            'out_of_hours_enabled' => '1',
            'out_of_hours_message' => 'Estamos fora do horário.',
        ]);

        $channel = new FakeMessagingChannel;
        $conversation = $this->makeBotConversation();

        $blocked = (new OutOfHoursGate)->blocksBotFlow($conversation, $channel);

        $this->assertTrue($blocked);
        $this->assertDatabaseHas('messages', [
            'conversation_id' => $conversation->id,
            'direction' => Message::DIRECTION_OUT,
            'body' => 'Estamos fora do horário.',
        ]);
        $this->assertNotNull($conversation->fresh()->last_ooh_notified_at);

        Carbon::setTestNow();
    }

    public function test_gate_defers_to_flow_with_business_hours_check_node(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-07-07 20:00:00', 'America/Sao_Paulo'));
        $this->seedClosedGlobalHours();
        AppSetting::setMany([
            'out_of_hours_enabled' => '1',
            'out_of_hours_message' => 'Estamos fora do horário.',
        ]);

        $flow = Flow::create([
            'name' => 'Fluxo com horário',
            'definition' => [
                'nodes' => [
                    ['id' => 'start', 'type' => 'start', 'data' => []],
                    ['id' => 'hours', 'type' => 'business_hours_check', 'data' => []],
                ],
                'edges' => [],
            ],
            'is_active' => true,
            'is_default' => true,
        ]);

        $channel = new FakeMessagingChannel;
        $contact = Contact::create(['wa_id' => '5547999999999']);
        $conversation = $contact->conversations()->create([
            'status' => Conversation::STATUS_BOT,
            'flow_id' => $flow->id,
            'last_message_at' => now(),
        ]);

        $blocked = (new OutOfHoursGate)->blocksBotFlow($conversation, $channel);

        $this->assertFalse($blocked);
        $this->assertSame(0, $conversation->messages()->where('direction', Message::DIRECTION_OUT)->count());

        Carbon::setTestNow();
    }

    public function test_gate_allows_flow_during_business_hours(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-07-07 10:00:00', 'America/Sao_Paulo'));
        $this->seedOpenGlobalHours();
        AppSetting::setMany([
            'out_of_hours_enabled' => '1',
            'out_of_hours_message' => 'Estamos fora do horário.',
        ]);

        $channel = new FakeMessagingChannel;
        $conversation = $this->makeBotConversation();

        $blocked = (new OutOfHoursGate)->blocksBotFlow($conversation, $channel);

        $this->assertFalse($blocked);
        $this->assertSame(0, $conversation->messages()->where('direction', Message::DIRECTION_OUT)->count());

        Carbon::setTestNow();
    }

    public function test_whatsapp_job_sends_out_of_hours_message_when_closed(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-07-07 20:00:00', 'America/Sao_Paulo'));
        $this->seedClosedGlobalHours();
        AppSetting::setMany([
            'out_of_hours_enabled' => '1',
            'out_of_hours_message' => 'Fora do horário no WhatsApp.',
        ]);

        Http::fake([
            'graph.facebook.com/*' => Http::response(['messages' => [['id' => 'wamid.OOH']]], 200),
        ]);

        $channel = Channel::create([
            'name' => 'WhatsApp',
            'type' => Channel::TYPE_WHATSAPP,
            'config' => [
                'phone_number_id' => '123456',
                'access_token' => 'token',
            ],
            'is_active' => true,
        ]);

        $contact = Contact::create(['wa_id' => '5547999990000', 'channel_id' => $channel->id]);
        $conversation = $contact->conversations()->create([
            'channel_id' => $channel->id,
            'status' => Conversation::STATUS_BOT,
            'flow_id' => Flow::create([
                'name' => 'Default',
                'definition' => ['nodes' => [], 'edges' => []],
                'is_active' => true,
                'is_default' => true,
            ])->id,
            'last_message_at' => now(),
        ]);

        $job = new ProcessInboundMessage([
            'entry' => [[
                'changes' => [[
                    'value' => [
                        'messages' => [[
                            'id' => 'wamid.IN.OOH',
                            'from' => '5547999990000',
                            'timestamp' => (string) now()->timestamp,
                            'type' => 'text',
                            'text' => ['body' => 'Oi'],
                        ]],
                    ],
                ]],
            ]],
        ], $channel->id);

        $job->handle();

        $this->assertDatabaseHas('messages', [
            'conversation_id' => $conversation->id,
            'direction' => Message::DIRECTION_OUT,
            'body' => 'Fora do horário no WhatsApp.',
        ]);
        $this->assertSame(Conversation::STATUS_BOT, $conversation->fresh()->status);

        Carbon::setTestNow();
    }

    public function test_telegram_job_applies_out_of_hours_gate(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-07-07 20:00:00', 'America/Sao_Paulo'));
        $this->seedClosedGlobalHours();
        AppSetting::setMany([
            'out_of_hours_enabled' => '1',
            'out_of_hours_message' => 'Fora do horário no Telegram.',
        ]);

        $channel = Channel::create([
            'name' => 'Telegram',
            'type' => Channel::TYPE_TELEGRAM,
            'config' => ['bot_token' => 'telegram-token'],
            'is_active' => true,
        ]);

        $contact = Contact::create(['wa_id' => '123', 'channel_id' => $channel->id]);
        $conversation = $contact->conversations()->create([
            'channel_id' => $channel->id,
            'status' => Conversation::STATUS_BOT,
            'last_message_at' => now(),
        ]);

        Http::fake(['api.telegram.org/*' => Http::response(['ok' => true, 'result' => ['message_id' => 1]], 200)]);

        $job = new ProcessTelegramMessage([
            'message' => [
                'message_id' => 99,
                'chat' => ['id' => 123],
                'from' => ['id' => 123, 'first_name' => 'Test'],
                'text' => 'Oi',
                'date' => now()->timestamp,
            ],
        ], $channel->id);

        $job->handle();

        $this->assertDatabaseHas('messages', [
            'conversation_id' => $conversation->id,
            'direction' => Message::DIRECTION_OUT,
            'body' => 'Fora do horário no Telegram.',
        ]);

        Carbon::setTestNow();
    }

    public function test_webchat_job_applies_out_of_hours_gate(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-07-07 20:00:00', 'America/Sao_Paulo'));
        $this->seedClosedGlobalHours();
        AppSetting::setMany([
            'out_of_hours_enabled' => '1',
            'out_of_hours_message' => 'Fora do horário no chat web.',
        ]);

        $channel = Channel::create([
            'name' => 'WebChat',
            'type' => Channel::TYPE_WEB,
            'config' => [],
            'is_active' => true,
        ]);

        $contact = Contact::create(['wa_id' => 'web_abc', 'channel_id' => $channel->id]);
        $conversation = $contact->conversations()->create([
            'channel_id' => $channel->id,
            'status' => Conversation::STATUS_BOT,
            'last_message_at' => now(),
        ]);

        $job = new ProcessWebChatMessage(
            contactId: $contact->id,
            channelId: $channel->id,
            text: 'Oi',
        );

        $job->handle();

        $this->assertDatabaseHas('messages', [
            'conversation_id' => $conversation->id,
            'direction' => Message::DIRECTION_OUT,
            'body' => 'Fora do horário no chat web.',
        ]);

        Carbon::setTestNow();
    }

    private function seedOpenGlobalHours(): void
    {
        $weekday = (int) now()->format('w');

        BusinessHour::create([
            'sector_id' => null,
            'weekday'   => $weekday,
            'opens_at'  => '08:00:00',
            'closes_at' => '22:00:00',
            'is_active' => true,
        ]);
    }

    private function seedClosedGlobalHours(): void
    {
        $weekday = (int) now()->format('w');

        BusinessHour::create([
            'sector_id' => null,
            'weekday'   => $weekday,
            'opens_at'  => '08:00:00',
            'closes_at' => '18:00:00',
            'is_active' => true,
        ]);
    }

    private function makeBotConversation(): Conversation
    {
        $contact = Contact::create(['wa_id' => '5547999999999']);

        return $contact->conversations()->create([
            'status' => Conversation::STATUS_BOT,
            'last_message_at' => now(),
        ]);
    }
}

class FakeMessagingChannel implements MessagingChannel
{
    public function sendText(string $to, string $body): ?string
    {
        return 'fake-message-id';
    }

    public function sendButtons(string $to, string $body, array $buttons, ?string $header = null): ?string
    {
        return 'fake-message-id';
    }

    public function sendList(string $to, string $body, string $buttonText, array $rows, ?string $sectionTitle = null): ?string
    {
        return 'fake-message-id';
    }

    public function sendFile(string $to, UploadedFile $file, string $type, ?string $caption = null, ?string $filename = null, ?string $forcedMimeType = null): ?string
    {
        return 'fake-message-id';
    }

    public function supportsMediaFetch(): bool
    {
        return false;
    }

    public function markAsRead(string $messageId): bool
    {
        return true;
    }

    public function isConfigured(): bool
    {
        return true;
    }

    public function getLastErrorMessage(): ?string
    {
        return null;
    }
}