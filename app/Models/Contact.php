<?php

namespace App\Models;

use App\Models\Channel;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Contact extends Model
{
    protected $fillable = [
        'wa_id',
        'channel_id',
        'name',
        'profile_name',
        'last_message_at',
        'meta',
        'notes',
        'ixc_customer_id',
        'ixc_customer_name',
        'ixc_document',
        'integration_config_id',
    ];

    protected function casts(): array
    {
        return [
            'last_message_at' => 'datetime',
            'meta' => 'array',
        ];
    }

    public function channel(): BelongsTo
    {
        return $this->belongsTo(Channel::class);
    }

    public function conversations(): HasMany
    {
        return $this->hasMany(Conversation::class);
    }

    public function integrationConfig(): BelongsTo
    {
        return $this->belongsTo(IntegrationConfig::class);
    }

    public function displayName(): string
    {
        return $this->name ?: ($this->profile_name ?: $this->wa_id);
    }
}
