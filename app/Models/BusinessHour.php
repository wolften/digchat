<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BusinessHour extends Model
{
    protected $fillable = ['sector_id', 'weekday', 'opens_at', 'closes_at', 'is_active'];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'weekday'   => 'integer',
        ];
    }

    public function sector(): BelongsTo
    {
        return $this->belongsTo(Sector::class);
    }
}
