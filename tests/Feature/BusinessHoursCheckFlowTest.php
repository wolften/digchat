<?php

namespace Tests\Feature;

use App\Models\BusinessHour;
use App\Models\Contact;
use App\Models\Conversation;
use App\Models\Flow;
use App\Models\Message;
use App\Models\Sector;
use App\Services\Flow\FlowEngine;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class BusinessHoursCheckFlowTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config(['app.timezone' => 'America/Sao_Paulo']);
    }

    public function test_closed_branch_sends_out_of_hours_message(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-07-07 20:00:00', 'America/Sao_Paulo'));
        $this->seedClosedGlobalHours();

        $flow = $this->makeHoursFlow();
        $conversation = $this->makeConversation($flow);
        $engine = new FlowEngine(new FakeBotChannel);

        $engine->run($conversation, 'oi');

        $this->assertDatabaseHas('messages', [
            'conversation_id' => $conversation->id,
            'direction' => Message::DIRECTION_OUT,
            'body' => 'Estamos fechados no momento.',
        ]);
        $this->assertDatabaseMissing('messages', [
            'conversation_id' => $conversation->id,
            'body' => 'Bem-vindo! Como posso ajudar?',
        ]);
        $this->assertNotNull($conversation->fresh()->last_ooh_notified_at);

        Carbon::setTestNow();
    }

    public function test_open_branch_sends_welcome_message(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-07-07 10:00:00', 'America/Sao_Paulo'));
        $this->seedOpenGlobalHours();

        $flow = $this->makeHoursFlow();
        $conversation = $this->makeConversation($flow);
        $engine = new FlowEngine(new FakeBotChannel);

        $engine->run($conversation, 'oi');

        $this->assertDatabaseHas('messages', [
            'conversation_id' => $conversation->id,
            'direction' => Message::DIRECTION_OUT,
            'body' => 'Bem-vindo! Como posso ajudar?',
        ]);
        $this->assertDatabaseMissing('messages', [
            'conversation_id' => $conversation->id,
            'body' => 'Estamos fechados no momento.',
        ]);

        Carbon::setTestNow();
    }

    public function test_closed_branch_is_throttled_per_conversation(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-07-07 20:00:00', 'America/Sao_Paulo'));
        $this->seedClosedGlobalHours();

        $flow = $this->makeHoursFlow();
        $conversation = $this->makeConversation($flow);
        $engine = new FlowEngine(new FakeBotChannel);

        $engine->run($conversation, 'oi');
        $this->assertSame(1, $conversation->messages()->where('direction', Message::DIRECTION_OUT)->count());

        $conversation->update(['current_node_id' => null]);
        $engine->run($conversation->fresh(), 'oi de novo');

        $this->assertSame(1, $conversation->messages()->where('direction', Message::DIRECTION_OUT)->count());

        Carbon::setTestNow();
    }

    public function test_global_scope_uses_default_hours_not_sector_override(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-07-07 20:00:00', 'America/Sao_Paulo'));

        $weekday = (int) now()->format('w');
        $sector = Sector::create(['name' => 'Financeiro', 'is_active' => true]);

        BusinessHour::create([
            'sector_id' => null,
            'weekday'   => $weekday,
            'opens_at'  => '08:00:00',
            'closes_at' => '18:00:00',
            'is_active' => true,
        ]);
        BusinessHour::create([
            'sector_id' => $sector->id,
            'weekday'   => $weekday,
            'opens_at'  => '08:00:00',
            'closes_at' => '22:00:00',
            'is_active' => true,
        ]);

        $flow = Flow::create([
            'name' => 'Fluxo global',
            'definition' => [
                'nodes' => [
                    ['id' => 'start', 'type' => 'start', 'data' => []],
                    ['id' => 'hours', 'type' => 'business_hours_check', 'data' => ['hours_scope' => 'global']],
                    ['id' => 'open_msg', 'type' => 'message', 'data' => ['message' => 'Aberto.']],
                    ['id' => 'closed_msg', 'type' => 'message', 'data' => ['message' => 'Fechado pelo padrão.']],
                ],
                'edges' => [
                    ['source' => 'start', 'target' => 'hours'],
                    ['source' => 'hours', 'target' => 'open_msg', 'sourceHandle' => 'open'],
                    ['source' => 'hours', 'target' => 'closed_msg', 'sourceHandle' => 'closed'],
                ],
            ],
            'is_active' => true,
        ]);

        $contact = Contact::create(['wa_id' => '5547999990000']);
        $conversation = $contact->conversations()->create([
            'status' => Conversation::STATUS_BOT,
            'flow_id' => $flow->id,
            'sector_id' => $sector->id,
            'last_message_at' => now(),
        ]);

        (new FlowEngine(new FakeBotChannel))->run($conversation, 'oi');

        $this->assertDatabaseHas('messages', [
            'conversation_id' => $conversation->id,
            'body' => 'Fechado pelo padrão.',
        ]);

        Carbon::setTestNow();
    }

    public function test_flow_has_business_hours_check_helper(): void
    {
        $withNode = Flow::create([
            'name' => 'Com horário',
            'definition' => [
                'nodes' => [
                    ['id' => 'start', 'type' => 'start', 'data' => []],
                    ['id' => 'hours', 'type' => 'business_hours_check', 'data' => []],
                ],
                'edges' => [],
            ],
            'is_active' => true,
        ]);

        $withoutNode = Flow::create([
            'name' => 'Sem horário',
            'definition' => [
                'nodes' => [
                    ['id' => 'start', 'type' => 'start', 'data' => []],
                    ['id' => 'msg', 'type' => 'message', 'data' => ['message' => 'Oi']],
                ],
                'edges' => [],
            ],
            'is_active' => true,
        ]);

        $this->assertTrue($withNode->hasBusinessHoursCheck());
        $this->assertFalse($withoutNode->hasBusinessHoursCheck());
    }

    private function makeHoursFlow(): Flow
    {
        return Flow::create([
            'name' => 'Fluxo com horário',
            'definition' => [
                'nodes' => [
                    ['id' => 'start', 'type' => 'start', 'data' => []],
                    ['id' => 'hours', 'type' => 'business_hours_check', 'data' => []],
                    ['id' => 'open_msg', 'type' => 'message', 'data' => ['message' => 'Bem-vindo! Como posso ajudar?']],
                    ['id' => 'closed_msg', 'type' => 'message', 'data' => ['message' => 'Estamos fechados no momento.']],
                ],
                'edges' => [
                    ['source' => 'start', 'target' => 'hours'],
                    ['source' => 'hours', 'target' => 'open_msg', 'sourceHandle' => 'open'],
                    ['source' => 'hours', 'target' => 'closed_msg', 'sourceHandle' => 'closed'],
                ],
            ],
            'is_active' => true,
            'is_default' => true,
        ]);
    }

    private function makeConversation(Flow $flow): Conversation
    {
        $contact = Contact::create(['wa_id' => '5547999990000']);

        return $contact->conversations()->create([
            'status' => Conversation::STATUS_BOT,
            'flow_id' => $flow->id,
            'last_message_at' => now(),
        ]);
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
}