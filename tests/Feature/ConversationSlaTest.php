<?php

namespace Tests\Feature;

use App\Events\ConversationUpdated;
use App\Models\AppSetting;
use App\Models\Contact;
use App\Models\Conversation;
use App\Models\Sector;
use App\Models\User;
use App\Services\Conversation\ConversationSlaService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class ConversationSlaTest extends TestCase
{
    use RefreshDatabase;

    private ConversationSlaService $sla;

    protected function setUp(): void
    {
        parent::setUp();

        $this->sla = app(ConversationSlaService::class);
    }

    private function makeQueuedConversation(
        ?Sector $sector = null,
        ?\DateTimeInterface $queuedAt = null,
    ): Conversation {
        $contact = Contact::create([
            'wa_id' => '55'.fake()->numerify('4799999####'),
            'profile_name' => 'Cliente SLA',
        ]);

        return $contact->conversations()->create([
            'status' => Conversation::STATUS_QUEUED,
            'sector_id' => $sector?->id,
            'queued_at' => $queuedAt ?? now(),
            'last_message_at' => now(),
        ]);
    }

    public function test_default_sla_target_is_five_minutes(): void
    {
        $this->assertSame(5, $this->sla->defaultTargetMinutes());
    }

    public function test_global_setting_overrides_default_sla_target(): void
    {
        AppSetting::set('sla_first_response_minutes', '10');

        $this->assertSame(10, $this->sla->defaultTargetMinutes());
    }

    public function test_sector_sla_overrides_global_default(): void
    {
        AppSetting::set('sla_first_response_minutes', '10');

        $sector = Sector::create([
            'name' => 'Suporte',
            'sla_first_response_minutes' => 3,
        ]);

        $this->assertSame(3, $this->sla->targetMinutesFor($sector));
    }

    public function test_evaluate_returns_null_for_open_conversations(): void
    {
        $conversation = $this->makeQueuedConversation();
        $conversation->forceFill([
            'status' => Conversation::STATUS_OPEN,
            'first_response_at' => now(),
        ])->save();

        $this->assertNull($this->sla->evaluate($conversation->fresh()));
    }

    public function test_evaluate_marks_conversation_as_breached_after_target(): void
    {
        $conversation = $this->makeQueuedConversation(
            queuedAt: now()->subMinutes(6),
        );

        $result = $this->sla->evaluate($conversation);

        $this->assertNotNull($result);
        $this->assertSame(ConversationSlaService::STATUS_BREACHED, $result['status']);
        $this->assertSame(5, $result['target_minutes']);
        $this->assertGreaterThanOrEqual(360, $result['wait_seconds']);
    }

    public function test_evaluate_marks_conversation_at_risk_before_breach(): void
    {
        $conversation = $this->makeQueuedConversation(
            queuedAt: now()->subMinutes(4)->subSeconds(30),
        );

        $result = $this->sla->evaluate($conversation);

        $this->assertNotNull($result);
        $this->assertSame(ConversationSlaService::STATUS_AT_RISK, $result['status']);
    }

    public function test_inbox_includes_sla_for_queued_conversation(): void
    {
        $atendente = User::factory()->create(['role' => User::ROLE_ATENDENTE]);
        $conversation = $this->makeQueuedConversation(queuedAt: now()->subMinutes(6));

        $this->actingAs($atendente)
            ->get('/inbox?filter=queued')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Inbox/Index')
                ->has('conversations', 1)
                ->where('conversations.0.id', $conversation->id)
                ->where('conversations.0.sla.status', ConversationSlaService::STATUS_BREACHED)
                ->where('conversations.0.sla.target_minutes', 5)
            );
    }

    public function test_conversation_updated_broadcast_includes_sla(): void
    {
        Event::fake([ConversationUpdated::class]);

        $conversation = $this->makeQueuedConversation(queuedAt: now()->subMinutes(6));
        $conversation->touch();

        Event::assertDispatched(ConversationUpdated::class, function (ConversationUpdated $event) use ($conversation): bool {
            if (! $event->conversation->is($conversation)) {
                return false;
            }

            $payload = $event->broadcastWith();

            return ($payload['conversation']['sla']['status'] ?? null) === ConversationSlaService::STATUS_BREACHED;
        });
    }

    public function test_admin_can_save_sector_sla_minutes(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
        $sector = Sector::create(['name' => 'Financeiro']);

        $this->actingAs($admin)
            ->put(route('setores.update', $sector), [
                'name' => 'Financeiro',
                'description' => null,
                'is_active' => true,
                'sla_first_response_minutes' => 8,
            ])
            ->assertRedirect();

        $this->assertSame(8, $sector->fresh()->sla_first_response_minutes);
    }
}