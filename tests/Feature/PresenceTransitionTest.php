<?php

namespace Tests\Feature;

use App\Enums\ActivityEvent;
use App\Models\ActivityLog;
use App\Models\User;
use App\Services\Presence\PresenceResolver;
use App\Services\Presence\PresenceTransitionTracker;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

class PresenceTransitionTest extends TestCase
{
    use RefreshDatabase;

    public function test_command_logs_presence_transition(): void
    {
        $user = User::factory()->create(['is_active' => true]);

        Cache::forever("presence:last:{$user->id}", PresenceResolver::STATE_ONLINE);

        $this->mock(PresenceResolver::class, function ($mock) use ($user): void {
            $mock->shouldReceive('resolveForUser')
                ->andReturn(PresenceResolver::STATE_AWAY);
        });

        $this->artisan('presence:track-transitions')->assertSuccessful();

        $this->assertDatabaseHas('activity_logs', [
            'event' => ActivityEvent::PresenceAway->value,
            'actor_user_id' => $user->id,
        ]);

        $this->assertSame(
            PresenceResolver::STATE_AWAY,
            Cache::get("presence:last:{$user->id}"),
        );
    }

    public function test_mark_online_logs_when_user_was_offline(): void
    {
        $user = User::factory()->create(['is_active' => true]);

        Cache::forever("presence:last:{$user->id}", PresenceResolver::STATE_OFFLINE);

        app(PresenceTransitionTracker::class)->markOnline($user);

        $this->assertDatabaseHas('activity_logs', [
            'event' => ActivityEvent::PresenceOnline->value,
            'actor_user_id' => $user->id,
        ]);
    }
}