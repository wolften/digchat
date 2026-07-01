<?php

namespace App\Models;

use App\Events\ConversationUpdated;
use App\Jobs\DistributeQueuedConversation;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use App\Models\Channel;

class Conversation extends Model
{
    public const STATUS_BOT      = 'bot';
    public const STATUS_QUEUED   = 'queued';
    public const STATUS_OPEN     = 'open';
    public const STATUS_CLOSED   = 'closed';
    public const STATUS_SURVEYING = 'surveying';
    public const STATUS_SNOOZED   = 'snoozed';
    public const ACTIVE_STATUSES = [
        self::STATUS_BOT,
        self::STATUS_QUEUED,
        self::STATUS_OPEN,
    ];
    public const SESSION_STATUSES = [
        self::STATUS_BOT,
        self::STATUS_QUEUED,
        self::STATUS_OPEN,
        self::STATUS_SNOOZED,
    ];

    public ?string $snoozeWakeReason = null;

    protected static function booted(): void
    {
        static::creating(function (Conversation $conversation): void {
            if ($conversation->status === self::STATUS_QUEUED && $conversation->queued_at === null) {
                $conversation->queued_at = now();
            }
        });

        static::created(function (Conversation $conversation): void {
            $conversation->updateQuietly([
                'protocol_number' => str_pad((string) $conversation->id, 8, '0', STR_PAD_LEFT),
            ]);
        });

        static::updating(function (Conversation $conversation): void {
            if ($conversation->isDirty('status')) {
                $newStatus = $conversation->status;
                $oldStatus = $conversation->getOriginal('status');

                if ($newStatus === self::STATUS_QUEUED && $conversation->first_response_at === null) {
                    $conversation->queued_at = now();
                }

                if (
                    $newStatus === self::STATUS_OPEN
                    && $oldStatus === self::STATUS_QUEUED
                    && $conversation->first_response_at === null
                ) {
                    $conversation->first_response_at = now();
                }
            }
        });

        static::saved(function (Conversation $conversation): void {
            ConversationUpdated::dispatch($conversation);

            if (
                $conversation->status !== self::STATUS_QUEUED
                || $conversation->assigned_user_id !== null
                || ! AppSetting::bool('auto_assign_conversations_enabled')
            ) {
                return;
            }

            $shouldAttempt = $conversation->wasRecentlyCreated
                || $conversation->wasChanged('status')
                || $conversation->wasChanged('sector_id')
                || ($conversation->wasChanged('assigned_user_id') && $conversation->assigned_user_id === null);

            if ($shouldAttempt) {
                DistributeQueuedConversation::dispatch($conversation->id);
            }
        });
    }

    protected $fillable = [
        'contact_id',
        'channel_id',
        'status',
        'assigned_user_id',
        'sector_id',
        'flow_id',
        'current_node_id',
        'context',
        'survey_response_id',
        'last_message_at',
        'queued_at',
        'first_response_at',
        'last_ooh_notified_at',
        'protocol_number',
        'snoozed_until',
        'snoozed_by_user_id',
        'snooze_note',
    ];

    protected function casts(): array
    {
        return [
            'last_message_at'     => 'datetime',
            'last_read_at'        => 'datetime',
            'queued_at'           => 'datetime',
            'first_response_at'   => 'datetime',
            'last_ooh_notified_at' => 'datetime',
            'snoozed_until'       => 'datetime',
            'context'             => 'array',
        ];
    }

    public function channel(): BelongsTo
    {
        return $this->belongsTo(Channel::class);
    }

    public function contact(): BelongsTo
    {
        return $this->belongsTo(Contact::class);
    }

    public function assignedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_user_id');
    }

    public function snoozedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'snoozed_by_user_id');
    }

    public function sector(): BelongsTo
    {
        return $this->belongsTo(Sector::class);
    }

    public function messages(): HasMany
    {
        return $this->hasMany(Message::class);
    }

    public function surveyResponse(): HasOne
    {
        return $this->hasOne(SurveyResponse::class);
    }

    public function isHandledByBot(): bool
    {
        return $this->status === self::STATUS_BOT;
    }

    public function canBeViewedBy(User $user): bool
    {
        if ($user->isManager()) {
            return true;
        }

        if ($this->status === self::STATUS_BOT) {
            return true;
        }

        if ($this->status === self::STATUS_QUEUED) {
            if ($this->sector_id === null) {
                return true;
            }
            return $user->sectors->contains('id', $this->sector_id);
        }

        return $this->assigned_user_id === $user->id;
    }

    public function canBeActedOnBy(User $user): bool
    {
        if ($this->status === self::STATUS_CLOSED || $this->status === self::STATUS_SNOOZED) {
            return false;
        }

        return $this->assigned_user_id === $user->id;
    }

    public function canSendInternalNoteBy(User $user): bool
    {
        if (! in_array($this->status, [self::STATUS_OPEN, self::STATUS_SNOOZED], true)) {
            return false;
        }

        if ($this->assigned_user_id === null) {
            return false;
        }

        if (! $this->canBeViewedBy($user)) {
            return false;
        }

        return $user->isManager() || $this->assigned_user_id === $user->id;
    }

    public function canBeSnoozedBy(User $user): bool
    {
        return $this->status === self::STATUS_OPEN
            && $this->assigned_user_id === $user->id;
    }

    public function canBeWokenBy(User $user): bool
    {
        if ($this->status !== self::STATUS_SNOOZED) {
            return false;
        }

        return $this->assigned_user_id === $user->id || $user->isManager();
    }

    public function canBeAssignedBy(User $user): bool
    {
        if (
            $this->status === self::STATUS_OPEN
            && $this->assigned_user_id !== null
            && $this->assigned_user_id !== $user->id
            && ! $user->isManager()
        ) {
            return false;
        }

        if (
            $this->status === self::STATUS_QUEUED
            && $this->sector_id !== null
            && ! $user->isManager()
        ) {
            return $user->sectors->contains('id', $this->sector_id);
        }

        return true;
    }

    public function canBeTransferredBy(User $user): bool
    {
        if ($user->isManager()) {
            return true;
        }

        return $this->assigned_user_id === $user->id;
    }

    public function canBeViewedInHistoricoBy(User $user, ?self $anchor = null): bool
    {
        if ($anchor && $anchor->contact_id === $this->contact_id && $anchor->canBeViewedBy($user)) {
            return true;
        }

        if ($user->isManager()) {
            return true;
        }

        if ($this->canBeViewedBy($user)) {
            return true;
        }

        if (! in_array($this->status, [self::STATUS_CLOSED, self::STATUS_SURVEYING], true)) {
            return false;
        }

        if ($this->assigned_user_id === $user->id) {
            return true;
        }

        if ($this->sector_id !== null) {
            return $user->sectors()->where('sectors.id', $this->sector_id)->exists();
        }

        return false;
    }

    public function scopeHistoricoVisibleTo(Builder $query, User $user): Builder
    {
        if ($user->isManager()) {
            return $query;
        }

        $sectorIds = $user->sectors()->pluck('sectors.id');

        return $query->where(function (Builder $visible) use ($user, $sectorIds): void {
            $visible
                ->where('assigned_user_id', $user->id)
                ->orWhereIn('sector_id', $sectorIds);
        });
    }

    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        if ($user->isManager()) {
            return $query;
        }

        $userSectorIds = $user->sectors()->pluck('sectors.id');

        return $query->where(function (Builder $visible) use ($user, $userSectorIds): void {
            $visible
                ->where('status', self::STATUS_BOT)
                ->orWhere(function (Builder $q) use ($userSectorIds): void {
                    $q->where('status', self::STATUS_QUEUED)
                        ->where(function (Builder $q2) use ($userSectorIds): void {
                            $q2->whereNull('sector_id')
                                ->orWhereIn('sector_id', $userSectorIds);
                        });
                })
                ->orWhere('assigned_user_id', $user->id);
        });
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->whereIn('status', self::ACTIVE_STATUSES);
    }

    public function scopeSession(Builder $query): Builder
    {
        return $query->whereIn('status', self::SESSION_STATUSES);
    }

    public function closeSiblingActiveConversations(): void
    {
        $this->contact()->firstOrFail()
            ->conversations()
            ->whereKeyNot($this->id)
            ->session()
            ->update([
                'status'           => self::STATUS_CLOSED,
                'assigned_user_id' => null,
                'sector_id'        => null,
            ]);
    }
}
