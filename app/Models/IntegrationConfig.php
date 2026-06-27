<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class IntegrationConfig extends Model
{
    protected $fillable = [
        'type',
        'name',
        'base_url',
        'token',
'is_active',
    ];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    public function contacts(): HasMany
    {
        return $this->hasMany(Contact::class);
    }

    public static function activeIxc(): ?static
    {
        return static::where('type', 'ixc')->where('is_active', true)->first();
    }
}
