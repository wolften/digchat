<?php

namespace Tests\Feature;

use App\Models\Contact;
use App\Models\Conversation;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DashboardTmeTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    private function makeContact(): Contact
    {
        return Contact::create([
            'wa_id'        => '5547999990001',
            'profile_name' => 'Cliente TME',
        ]);
    }

    public function test_creating_conversation_in_queue_sets_queued_at(): void
    {
        $conversation = $this->makeContact()->conversations()->create([
            'status'          => Conversation::STATUS_QUEUED,
            'last_message_at' => now(),
        ]);

        $this->assertNotNull($conversation->fresh()->queued_at);
    }

    public function test_requeue_does_not_reset_queued_at_after_first_response(): void
    {
        $conversation = $this->makeContact()->conversations()->create([
            'status'          => Conversation::STATUS_QUEUED,
            'last_message_at' => now(),
        ]);

        $originalQueuedAt = $conversation->fresh()->queued_at;

        Carbon::setTestNow(now()->addMinutes(10));
        $conversation->update(['status' => Conversation::STATUS_OPEN]);
        $firstResponseAt = $conversation->fresh()->first_response_at;

        Carbon::setTestNow(now()->addMinutes(5));
        $conversation->update([
            'status'           => Conversation::STATUS_QUEUED,
            'assigned_user_id' => null,
        ]);

        $conversation->refresh();

        $this->assertTrue($originalQueuedAt->equalTo($conversation->queued_at));
        $this->assertTrue($firstResponseAt->equalTo($conversation->first_response_at));
    }

    public function test_dashboard_tme_uses_first_response_in_period_and_queue_timestamps(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-06-30 10:00:00'));

        $user = User::factory()->create(['role' => User::ROLE_GESTOR]);
        $contact = $this->makeContact();

        $conversation = $contact->conversations()->create([
            'status'          => Conversation::STATUS_QUEUED,
            'last_message_at' => now(),
        ]);

        Carbon::setTestNow(now()->addMinutes(15));
        $conversation->update(['status' => Conversation::STATUS_OPEN]);

        Carbon::setTestNow(now()->addHour());
        $conversation->update(['status' => Conversation::STATUS_CLOSED]);

        $response = $this->actingAs($user)
            ->get('/dashboard?period=today')
            ->assertOk();

        $response->assertInertia(fn ($page) => $page
            ->component('Dashboard')
            ->where('stats.avg_tme_mins', 15)
        );
    }

    public function test_dashboard_live_queue_wait_uses_queued_at(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-06-30 14:00:00'));

        $user = User::factory()->create(['role' => User::ROLE_GESTOR]);

        $this->makeContact()->conversations()->create([
            'status'          => Conversation::STATUS_QUEUED,
            'queued_at'       => now()->subMinutes(20),
            'last_message_at' => now(),
        ]);

        $response = $this->actingAs($user)
            ->get('/dashboard')
            ->assertOk();

        $response->assertInertia(fn ($page) => $page
            ->component('Dashboard')
            ->where('stats.avg_wait_mins', 20)
        );
    }
}