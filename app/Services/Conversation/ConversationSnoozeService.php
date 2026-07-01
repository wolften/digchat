<?php

namespace App\Services\Conversation;

use App\Models\Conversation;
use App\Models\User;
use App\Services\Audit\ActivityLogger;
use Carbon\CarbonInterface;
use Illuminate\Validation\ValidationException;

class ConversationSnoozeService
{
    public function __construct(private ActivityLogger $activity)
    {
    }
    public const WAKE_MANUAL = 'manual';
    public const WAKE_EXPIRED = 'expired';
    public const WAKE_CUSTOMER_MESSAGE = 'customer_message';

    public function snooze(
        Conversation $conversation,
        User $user,
        CarbonInterface $until,
        ?string $note = null,
    ): Conversation {
        // Frontend sends UTC ISO strings; DB datetimes are stored in app timezone.
        $until = $until->timezone(config('app.timezone'));

        if (! $conversation->canBeSnoozedBy($user)) {
            throw ValidationException::withMessages([
                'snoozed_until' => 'Esta conversa não pode ser adiada no momento.',
            ]);
        }

        if ($until->lessThanOrEqualTo(now()->addMinutes(4))) {
            throw ValidationException::withMessages([
                'snoozed_until' => 'O lembrete deve ser pelo menos 5 minutos no futuro.',
            ]);
        }

        $conversation->snoozeWakeReason = null;
        $conversation->forceFill([
            'status' => Conversation::STATUS_SNOOZED,
            'snoozed_until' => $until,
            'snoozed_by_user_id' => $user->id,
            'snooze_note' => $note ? trim($note) : null,
        ])->save();

        $this->activity->conversationSnoozed($user, $conversation, $until, $note);

        return $conversation->fresh();
    }

    public function wake(
        Conversation $conversation,
        string $reason = self::WAKE_MANUAL,
        ?User $actor = null,
    ): Conversation {
        if ($conversation->status !== Conversation::STATUS_SNOOZED) {
            return $conversation;
        }

        $conversation->snoozeWakeReason = $reason;
        $conversation->forceFill([
            'status' => Conversation::STATUS_OPEN,
            'snoozed_until' => null,
            'snoozed_by_user_id' => null,
            'snooze_note' => null,
        ])->save();

        $this->activity->conversationWoken($conversation, $reason, $actor);

        return $conversation->fresh();
    }

    public function wakeOnInboundIfNeeded(Conversation $conversation): Conversation
    {
        if ($conversation->status !== Conversation::STATUS_SNOOZED) {
            return $conversation;
        }

        return $this->wake($conversation, self::WAKE_CUSTOMER_MESSAGE);
    }

    public function wakeExpired(): int
    {
        $woken = 0;

        Conversation::query()
            ->where('status', Conversation::STATUS_SNOOZED)
            ->whereNotNull('snoozed_until')
            ->where('snoozed_until', '<=', now())
            ->chunkById(100, function ($conversations) use (&$woken): void {
                foreach ($conversations as $conversation) {
                    $this->wake($conversation, self::WAKE_EXPIRED);
                    $woken++;
                }
            });

        return $woken;
    }

    public function clearSnoozeFields(Conversation $conversation): void
    {
        if (
            $conversation->status !== Conversation::STATUS_SNOOZED
            && $conversation->snoozed_until === null
            && $conversation->snoozed_by_user_id === null
            && $conversation->snooze_note === null
        ) {
            return;
        }

        $conversation->snoozeWakeReason = null;
        $conversation->forceFill([
            'snoozed_until' => null,
            'snoozed_by_user_id' => null,
            'snooze_note' => null,
        ]);
    }
}