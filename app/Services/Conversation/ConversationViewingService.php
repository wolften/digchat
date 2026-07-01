<?php

namespace App\Services\Conversation;

use App\Models\Conversation;
use App\Models\User;
use Illuminate\Support\Facades\Cache;

class ConversationViewingService
{
    private const STALE_SECONDS = 45;

    private function cacheKey(int $conversationId): string
    {
        return "conversation:viewers:{$conversationId}";
    }

    /**
     * @return array<int, array{user_id: int, user_name: string, profile_photo_url: string|null, last_seen_at: int}>
     */
    private function allViewers(int $conversationId): array
    {
        return Cache::get($this->cacheKey($conversationId), []);
    }

    /**
     * @param  array<int, array{user_id: int, user_name: string, profile_photo_url: string|null, last_seen_at: int}>  $viewers
     * @return array<int, array{user_id: int, user_name: string, profile_photo_url: string|null, last_seen_at: int}>
     */
    private function pruneStale(array $viewers): array
    {
        $cutoff = now()->subSeconds(self::STALE_SECONDS)->timestamp;

        return array_filter(
            $viewers,
            fn (array $viewer): bool => ($viewer['last_seen_at'] ?? 0) >= $cutoff,
        );
    }

    public function markViewing(Conversation $conversation, User $user): void
    {
        $viewers = $this->pruneStale($this->allViewers($conversation->id));

        $viewers[$user->id] = [
            'user_id' => $user->id,
            'user_name' => $user->name,
            'profile_photo_url' => $user->profile_photo_url,
            'last_seen_at' => now()->timestamp,
        ];

        Cache::put(
            $this->cacheKey($conversation->id),
            $viewers,
            now()->addSeconds(self::STALE_SECONDS * 3),
        );
    }

    public function markNotViewing(Conversation $conversation, User $user): void
    {
        $viewers = $this->pruneStale($this->allViewers($conversation->id));
        unset($viewers[$user->id]);

        Cache::put(
            $this->cacheKey($conversation->id),
            $viewers,
            now()->addSeconds(self::STALE_SECONDS * 3),
        );
    }

    /**
     * @return array<int, array{user_id: int, user_name: string, profile_photo_url: string|null}>
     */
    public function viewersFor(Conversation $conversation, ?User $except = null): array
    {
        $viewers = $this->pruneStale($this->allViewers($conversation->id));

        if ($except !== null) {
            unset($viewers[$except->id]);
        }

        return array_values(array_map(
            fn (array $viewer): array => [
                'user_id' => $viewer['user_id'],
                'user_name' => $viewer['user_name'],
                'profile_photo_url' => $viewer['profile_photo_url'],
            ],
            $viewers,
        ));
    }
}