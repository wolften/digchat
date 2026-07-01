<?php

namespace Tests\Feature;

use App\Models\AppSetting;
use App\Models\Contact;
use App\Models\Conversation;
use App\Models\User;
use App\Services\Conversation\LongOpenConversationService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LongOpenConversationTest extends TestCase
{
    use RefreshDatabase;

    private LongOpenConversationService $service;

    protected function setUp(): void
    {
        parent::setUp();

        $this->service = app(LongOpenConversationService::class);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    private function makeOpenConversation(
        ?User $assignedUser = null,
        ?\DateTimeInterface $firstResponseAt = null,
    ): Conversation {
        $contact = Contact::create([
            'wa_id' => '55'.fake()->numerify('4799999####'),
            'profile_name' => 'Cliente Longo',
        ]);

        return $contact->conversations()->create([
            'status' => Conversation::STATUS_OPEN,
            'assigned_user_id' => $assignedUser?->id,
            'first_response_at' => $firstResponseAt ?? now()->subHours(6),
            'last_message_at' => now(),
        ]);
    }

    public function test_service_counts_open_conversations_above_threshold(): void
    {
        AppSetting::set('open_conversation_alert_enabled', '1');
        AppSetting::set('open_conversation_alert_hours', '4');

        $this->makeOpenConversation(firstResponseAt: now()->subHours(6));
        $this->makeOpenConversation(firstResponseAt: now()->subHours(2));

        $this->assertSame(1, $this->service->count());
    }

    public function test_service_returns_empty_when_disabled(): void
    {
        AppSetting::set('open_conversation_alert_enabled', '0');
        AppSetting::set('open_conversation_alert_hours', '4');

        $this->makeOpenConversation(firstResponseAt: now()->subHours(10));

        $this->assertSame(0, $this->service->count());
        $this->assertSame([], $this->service->list());
    }

    public function test_gestor_dashboard_includes_long_open_alert(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-07-01 12:00:00'));

        AppSetting::set('open_conversation_alert_enabled', '1');
        AppSetting::set('open_conversation_alert_hours', '4');

        $gestor = User::factory()->create(['role' => User::ROLE_GESTOR]);
        $atendente = User::factory()->create(['role' => User::ROLE_ATENDENTE]);
        $conversation = $this->makeOpenConversation($atendente, now()->subHours(5));

        $this->actingAs($gestor)
            ->get('/dashboard')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Dashboard')
                ->where('canViewAnalytics', true)
                ->where('longOpenAlert.enabled', true)
                ->where('longOpenAlert.hours', 4)
                ->where('longOpenAlert.count', 1)
                ->has('longOpenAlert.conversations', 1)
                ->where('longOpenAlert.conversations.0.id', $conversation->id)
            );
    }

    public function test_atendente_dashboard_does_not_include_long_open_alert(): void
    {
        AppSetting::set('open_conversation_alert_enabled', '1');
        AppSetting::set('open_conversation_alert_hours', '4');

        $atendente = User::factory()->create(['role' => User::ROLE_ATENDENTE]);
        $this->makeOpenConversation($atendente, now()->subHours(8));

        $this->actingAs($atendente)
            ->get('/dashboard')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Dashboard')
                ->where('canViewAnalytics', false)
                ->where('longOpenAlert', null)
                ->missing('stats.closed')
            );
    }

    public function test_atendente_dashboard_only_includes_live_status_counts(): void
    {
        $atendente = User::factory()->create(['role' => User::ROLE_ATENDENTE]);

        Contact::create([
            'wa_id' => '5547999993333',
            'profile_name' => 'Cliente',
        ])->conversations()->create([
            'status' => Conversation::STATUS_QUEUED,
            'last_message_at' => now(),
        ]);

        $this->actingAs($atendente)
            ->get('/dashboard')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Dashboard')
                ->where('canViewAnalytics', false)
                ->where('stats.queued', 1)
                ->where('topAttendants', [])
                ->where('volumeData', [])
            );
    }

    public function test_admin_can_save_long_open_alert_settings(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);

        $this->actingAs($admin)
            ->post('/configuracoes/sistema', [
                'app_name' => 'DigChat',
                'notify_customer_on_transfer' => '1',
                'auto_close_inactive_conversations_minutes' => 60,
                'open_conversation_alert_enabled' => '1',
                'open_conversation_alert_hours' => 8,
            ])
            ->assertRedirect();

        $this->assertSame('1', AppSetting::get('open_conversation_alert_enabled'));
        $this->assertSame('8', AppSetting::get('open_conversation_alert_hours'));
    }
}