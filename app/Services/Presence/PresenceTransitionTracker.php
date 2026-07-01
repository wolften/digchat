<?php

namespace App\Services\Presence;

use App\Models\User;
use App\Services\Audit\ActivityLogger;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class PresenceTransitionTracker
{
    public function __construct(
        private PresenceResolver $resolver,
        private ActivityLogger $activity,
    ) {
    }

    public function markOnline(User $user): void
    {
        $previous = Cache::get($this->cacheKey($user->id), PresenceResolver::STATE_OFFLINE);

        if ($previous !== PresenceResolver::STATE_ONLINE) {
            $this->activity->presenceChanged($user, (string) $previous, PresenceResolver::STATE_ONLINE);
        }

        Cache::forever($this->cacheKey($user->id), PresenceResolver::STATE_ONLINE);
    }

    public function markOffline(User $user): void
    {
        $previous = Cache::get($this->cacheKey($user->id), PresenceResolver::STATE_ONLINE);

        if ($previous !== PresenceResolver::STATE_OFFLINE) {
            $this->activity->presenceChanged($user, (string) $previous, PresenceResolver::STATE_OFFLINE);
        }

        Cache::forever($this->cacheKey($user->id), PresenceResolver::STATE_OFFLINE);
    }

    public function syncUser(User $user): bool
    {
        if (! $user->is_active) {
            Cache::forever($this->cacheKey($user->id), PresenceResolver::STATE_INACTIVE);

            return false;
        }

        $sessionTs = (int) (DB::table(config('session.table', 'sessions'))
            ->where('user_id', $user->id)
            ->max('last_activity') ?? 0);

        $current = $this->resolver->resolveForUser($user, $sessionTs);
        $previous = Cache::get($this->cacheKey($user->id));

        if ($previous === null) {
            Cache::forever($this->cacheKey($user->id), $current);

            return false;
        }

        if ($previous === $current) {
            return false;
        }

        $this->activity->presenceChanged($user, (string) $previous, $current);
        Cache::forever($this->cacheKey($user->id), $current);

        return true;
    }

    /** @return int Number of transitions logged */
    public function syncAll(): int
    {
        $logged = 0;

        User::query()
            ->orderBy('id')
            ->chunkById(200, function ($users) use (&$logged): void {
                foreach ($users as $user) {
                    if ($this->syncUser($user)) {
                        $logged++;
                    }
                }
            });

        return $logged;
    }

    private function cacheKey(int $userId): string
    {
        return "presence:last:{$userId}";
    }
}