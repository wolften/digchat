<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class InternalConversation extends Model
{
    public const TYPE_GENERAL = 'general';

    public const TYPE_DIRECT = 'direct';

    protected $fillable = [
        'type',
        'last_message_at',
    ];

    protected function casts(): array
    {
        return [
            'last_message_at' => 'datetime',
        ];
    }

    public function participants(): HasMany
    {
        return $this->hasMany(InternalConversationParticipant::class);
    }

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'internal_conversation_participants')
            ->withPivot(['last_read_at'])
            ->withTimestamps();
    }

    public function messages(): HasMany
    {
        return $this->hasMany(InternalMessage::class);
    }

    public function isParticipant(User $user): bool
    {
        if (! $user->is_active) {
            return false;
        }

        return $this->participants()->where('user_id', $user->id)->exists();
    }

    public function isDirect(): bool
    {
        return $this->type === self::TYPE_DIRECT;
    }

    public function isGeneral(): bool
    {
        return $this->type === self::TYPE_GENERAL;
    }
}