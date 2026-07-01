<?php

namespace App\Services\Presence;

use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class PresenceResolver
{
    public const STATE_ONLINE = 'online';
    public const STATE_AWAY = 'away';
    public const STATE_OFFLINE = 'offline';
    public const STATE_INACTIVE = 'inactive';

    /** @return Collection<int, int> user_id => last_activity timestamp */
    public function sessionActivityByUser(): Collection
    {
        return DB::table(config('session.table', 'sessions'))
            ->select('user_id', DB::raw('MAX(last_activity) as last_activity'))
            ->whereNotNull('user_id')
            ->groupBy('user_id')
            ->get()
            ->mapWithKeys(fn ($row) => [(int) $row->user_id => (int) $row->last_activity]);
    }

    public function resolveForUser(User $user, ?int $sessionActivityTs = null): string
    {
        if (! $user->is_active) {
            return self::STATE_INACTIVE;
        }

        $sessionActivityTs ??= 0;
        $onlineAfter = now()->subMinutes(5)->timestamp;
        $awayAfter = now()->subMinutes(30)->timestamp;

        return match (true) {
            $sessionActivityTs >= $onlineAfter => self::STATE_ONLINE,
            $sessionActivityTs >= $awayAfter => self::STATE_AWAY,
            default => self::STATE_OFFLINE,
        };
    }

    /**
     * @return array<int, string> user_id => presence state
     */
    public function resolveAll(): array
    {
        $sessionActivity = $this->sessionActivityByUser();
        $states = [];

        User::query()
            ->orderBy('id')
            ->chunkById(200, function ($users) use ($sessionActivity, &$states): void {
                foreach ($users as $user) {
                    $sessionTs = (int) ($sessionActivity->get($user->id) ?? 0);
                    $states[$user->id] = $this->resolveForUser($user, $sessionTs);
                }
            });

        return $states;
    }
}