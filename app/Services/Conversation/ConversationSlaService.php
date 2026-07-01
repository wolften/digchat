<?php

namespace App\Services\Conversation;

use App\Models\AppSetting;
use App\Models\Conversation;
use App\Models\Sector;
use Carbon\CarbonInterface;

class ConversationSlaService
{
    public const STATUS_OK = 'ok';
    public const STATUS_AT_RISK = 'at_risk';
    public const STATUS_BREACHED = 'breached';

    private const DEFAULT_TARGET_MINUTES = 5;
    private const AT_RISK_THRESHOLD = 0.8;

    public function defaultTargetMinutes(): int
    {
        $configured = (int) AppSetting::get('sla_first_response_minutes', self::DEFAULT_TARGET_MINUTES);

        return max(1, $configured ?: self::DEFAULT_TARGET_MINUTES);
    }

    public function targetMinutesFor(?Sector $sector): int
    {
        if ($sector?->sla_first_response_minutes !== null) {
            return max(1, (int) $sector->sla_first_response_minutes);
        }

        return $this->defaultTargetMinutes();
    }

    /**
     * @return array<string, mixed>|null
     */
    public function evaluate(Conversation $conversation, ?CarbonInterface $now = null): ?array
    {
        if (
            $conversation->status !== Conversation::STATUS_QUEUED
            || $conversation->first_response_at !== null
            || $conversation->queued_at === null
        ) {
            return null;
        }

        $now ??= now();
        $queuedAt = $conversation->queued_at;
        $sector = $conversation->relationLoaded('sector')
            ? $conversation->sector
            : ($conversation->sector_id ? Sector::find($conversation->sector_id) : null);

        $targetMinutes = $this->targetMinutesFor($sector);
        $waitSeconds = max(0, (int) $queuedAt->diffInSeconds($now));
        $targetSeconds = $targetMinutes * 60;
        $ratio = $targetSeconds > 0 ? $waitSeconds / $targetSeconds : 0;

        $status = self::STATUS_OK;
        if ($ratio >= 1) {
            $status = self::STATUS_BREACHED;
        } elseif ($ratio >= self::AT_RISK_THRESHOLD) {
            $status = self::STATUS_AT_RISK;
        }

        return [
            'status' => $status,
            'wait_seconds' => $waitSeconds,
            'target_minutes' => $targetMinutes,
            'remaining_seconds' => max(0, $targetSeconds - $waitSeconds),
            'queued_at' => $queuedAt->toIso8601String(),
        ];
    }
}