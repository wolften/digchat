<?php

namespace Database\Factories;

use App\Enums\ActivityEvent;
use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ActivityLog>
 */
class ActivityLogFactory extends Factory
{
    protected $model = ActivityLog::class;

    public function definition(): array
    {
        return [
            'event' => ActivityEvent::AuthLogin->value,
            'actor_user_id' => User::factory(),
            'subject_type' => null,
            'subject_id' => null,
            'properties' => [],
            'description' => fake()->sentence(),
            'created_at' => now(),
        ];
    }
}