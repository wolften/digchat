<?php

namespace App\Models;

use App\Enums\ActivityEvent;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class ActivityLog extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $fillable = [
        'event',
        'actor_user_id',
        'subject_type',
        'subject_id',
        'properties',
        'description',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'properties' => 'array',
            'created_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (ActivityLog $log): void {
            if ($log->created_at === null) {
                $log->created_at = now();
            }
        });
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_user_id');
    }

    public function subject(): MorphTo
    {
        return $this->morphTo();
    }

    public function eventEnum(): ?ActivityEvent
    {
        return ActivityEvent::tryFrom($this->event);
    }

    /**
     * @param  Builder<ActivityLog>  $query
     */
    public function scopeFilter(
        Builder $query,
        ?string $dateFrom = null,
        ?string $dateTo = null,
        ?string $event = null,
        ?int $actorUserId = null,
        ?int $sectorId = null,
        ?string $search = null,
    ): Builder {
        return $query
            ->when($dateFrom, fn (Builder $q) => $q->whereDate('created_at', '>=', $dateFrom))
            ->when($dateTo, fn (Builder $q) => $q->whereDate('created_at', '<=', $dateTo))
            ->when($event, fn (Builder $q) => $q->where('event', $event))
            ->when($actorUserId, fn (Builder $q) => $q->where('actor_user_id', $actorUserId))
            ->when($sectorId, fn (Builder $q) => $q->where(function (Builder $q2) use ($sectorId): void {
                $q2->where('properties->sector_id', $sectorId)
                    ->orWhere('properties->from_sector_id', $sectorId)
                    ->orWhere('properties->to_sector_id', $sectorId);
            }))
            ->when($search, fn (Builder $q) => $q->where(function (Builder $q2) use ($search): void {
                $q2->where('description', 'like', "%{$search}%")
                    ->orWhere('properties->protocol_number', 'like', "%{$search}%")
                    ->orWhere('properties->contact_name', 'like', "%{$search}%");
            }));
    }
}