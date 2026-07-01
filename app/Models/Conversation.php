<?php

namespace App\Models;

use App\Events\ConversationUpdated;
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
    public const ACTIVE_STATUSES = [
        self::STATUS_BOT,
        self::STATUS_QUEUED,
        self::STATUS_OPEN,
    ];

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

        static::saved(fn (Conversation $conversation) => ConversationUpdated::dispatch($conversation));
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
    ];

    protected function casts(): array
    {
        return [
            'last_message_at'     => 'datetime',
            'last_read_at'        => 'datetime',
            'queued_at'           => 'datetime',
            'first_response_at'   => 'datetime',
            'last_ooh_notified_at' => 'datetime',
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
        if ($this->status === self::STATUS_CLOSED) {
            return false;
        }

        return $this->assigned_user_id === $user->id;
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

    public function closeSiblingActiveConversations(): void
    {
        $this->contact()->firstOrFail()
            ->conversations()
            ->whereKeyNot($this->id)
            ->active()
            ->update([
                'status'           => self::STATUS_CLOSED,
                'assigned_user_id' => null,
                'sector_id'        => null,
            ]);
    }
}
