<?php

namespace Tests\Unit;

use App\Enums\ActivityEvent;
use App\Models\ActivityLog;
use App\Models\Contact;
use App\Models\Conversation;
use App\Models\User;
use App\Services\Audit\ActivityLogger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ActivityLoggerTest extends TestCase
{
    use RefreshDatabase;

    private ActivityLogger $logger;

    protected function setUp(): void
    {
        parent::setUp();
        $this->logger = app(ActivityLogger::class);
    }

    public function test_user_logged_in_writes_description_and_event(): void
    {
        $user = User::factory()->create(['name' => 'Ana']);

        $log = $this->logger->userLoggedIn($user);

        $this->assertSame(ActivityEvent::AuthLogin->value, $log->event);
        $this->assertStringContainsString('Ana entrou no sistema.', $log->description);
        $this->assertSame($user->id, $log->actor_user_id);
    }

    public function test_conversation_assigned_with_system_actor(): void
    {
        $assignee = User::factory()->create(['name' => 'Carlos']);
        $contact = Contact::create(['wa_id' => '5547999000010']);
        $conversation = Conversation::create([
            'contact_id' => $contact->id,
            'status' => Conversation::STATUS_QUEUED,
        ]);

        $log = $this->logger->conversationAssigned(null, $conversation, $assignee, 'auto_assign');

        $this->assertNull($log->actor_user_id);
        $this->assertSame('auto_assign', $log->properties['trigger']);
        $this->assertSame($conversation->protocol_number, $log->properties['protocol_number']);
    }

    public function test_presence_changed_maps_to_correct_event(): void
    {
        $user = User::factory()->create(['name' => 'Paula']);

        $log = $this->logger->presenceChanged($user, 'online', 'away');

        $this->assertSame(ActivityEvent::PresenceAway->value, $log->event);
        $this->assertDatabaseCount('activity_logs', 1);
        $this->assertInstanceOf(ActivityLog::class, $log);
    }

    public function test_settings_updated_truncates_long_description(): void
    {
        $user = User::factory()->create(['name' => 'Administrador FIBRON']);

        $keys = [
            'app_name',
            'app_subtitle',
            'notify_customer_on_transfer',
            'auto_close_inactive_conversations_enabled',
            'auto_close_inactive_conversations_minutes',
            'survey_on_close_enabled',
            'survey_on_close_survey_id',
            'survey_on_inactivity_close_enabled',
            'ooh_notify_interval_hours',
            'auto_assign_conversations_enabled',
            'auto_assign_strategy',
            'auto_assign_online_only',
            'auto_assign_max_open_per_agent',
            'sla_first_response_minutes',
            'open_conversation_alert_enabled',
            'open_conversation_alert_hours',
        ];

        $log = $this->logger->settingsUpdated($user, $keys, 'system');

        $this->assertSame(ActivityEvent::SettingsUpdated->value, $log->event);
        $this->assertLessThanOrEqual(500, mb_strlen($log->description));
        $this->assertStringContainsString('e mais 13', $log->description);
        $this->assertSame($keys, $log->properties['keys']);
    }
}