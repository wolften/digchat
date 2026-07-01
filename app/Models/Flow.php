<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Flow extends Model
{
    protected $fillable = [
        'name',
        'description',
        'definition',
        'is_active',
        'is_default',
        'sector_id',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'definition' => 'array',
            'is_active'  => 'boolean',
            'is_default' => 'boolean',
        ];
    }

    public function conversations(): HasMany
    {
        return $this->hasMany(Conversation::class);
    }

    /** Convenience: get nodes from the definition JSON. */
    public function getNodesAttribute(): array
    {
        return $this->definition['nodes'] ?? [];
    }

    /** Convenience: get edges from the definition JSON. */
    public function getEdgesAttribute(): array
    {
        return $this->definition['edges'] ?? [];
    }

    public static function defaultFlow(): ?self
    {
        return self::where('is_active', true)
            ->where('is_default', true)
            ->first();
    }

    public function hasBusinessHoursCheck(): bool
    {
        return collect($this->definition['nodes'] ?? [])
            ->contains(fn ($n) => ($n['type'] ?? null) === 'business_hours_check');
    }
}
