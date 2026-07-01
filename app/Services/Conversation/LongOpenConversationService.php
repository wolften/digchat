<?php

namespace App\Services\Conversation;

use App\Models\AppSetting;
use App\Models\Conversation;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;

class LongOpenConversationService
{
    private const DEFAULT_HOURS = 4;

    public function isEnabled(): bool
    {
        return AppSetting::bool('open_conversation_alert_enabled', true);
    }

    public function thresholdHours(): int
    {
        $hours = (int) AppSetting::get('open_conversation_alert_hours', self::DEFAULT_HOURS);

        return max(1, $hours ?: self::DEFAULT_HOURS);
    }

    public function openedBefore(?CarbonInterface $now = null): ?CarbonInterface
    {
        if (! $this->isEnabled()) {
            return null;
        }

        $now ??= now();

        return $now->copy()->subHours($this->thresholdHours());
    }

    public function baseQuery(?CarbonInterface $now = null): ?Builder
    {
        $cutoff = $this->openedBefore($now);
        if ($cutoff === null) {
            return null;
        }

        return Conversation::query()
            ->where('status', Conversation::STATUS_OPEN)
            ->whereRaw('COALESCE(first_response_at, updated_at) <= ?', [$cutoff]);
    }

    public function count(?CarbonInterface $now = null): int
    {
        $query = $this->baseQuery($now);

        return $query ? (int) $query->count() : 0;
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function list(int $limit = 50, ?CarbonInterface $now = null): array
    {
        $query = $this->baseQuery($now);
        if ($query === null) {
            return [];
        }

        $now ??= now();

        return $query
            ->with([
                'contact:id,wa_id,profile_name',
                'assignedUser:id,name,profile_photo_path',
                'sector:id,name',
                'channel:id,name,type',
            ])
            ->orderByRaw('COALESCE(first_response_at, updated_at) ASC')
            ->limit($limit)
            ->get()
            ->map(fn (Conversation $conversation) => $this->summarize($conversation, $now))
            ->values()
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    private function summarize(Conversation $conversation, CarbonInterface $now): array
    {
        $openedAt = $conversation->first_response_at ?? $conversation->updated_at;
        $openMinutes = $openedAt ? max(0, (int) $openedAt->diffInMinutes($now)) : 0;

        return [
            'id' => $conversation->id,
            'protocol_number' => $conversation->protocol_number,
            'contact_name' => $conversation->contact?->displayName() ?? 'Desconhecido',
            'assigned_user' => $conversation->assignedUser?->publicSummary(),
            'sector' => $conversation->sector?->only(['id', 'name']),
            'channel_type' => $conversation->channel?->type,
            'channel_name' => $conversation->channel?->name,
            'open_minutes' => $openMinutes,
            'opened_at' => $openedAt?->toIso8601String(),
            'last_message_at' => $conversation->last_message_at?->toIso8601String(),
        ];
    }
}