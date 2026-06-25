<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class QuickReply extends Model
{
    protected $fillable = ['trigger', 'title', 'content', 'is_active'];

    protected $casts = ['is_active' => 'boolean'];
}
