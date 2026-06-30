<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Channel extends Model
{
    public const TYPE_WHATSAPP = 'whatsapp';
    public const TYPE_TELEGRAM = 'telegram';
    public const TYPE_WEB      = 'web';

    protected $fillable = ['type', 'name', 'config', 'is_active'];

    protected function casts(): array
    {
        return [
            'config'    => 'array',
            'is_active' => 'boolean',
        ];
    }

    public function conversations(): HasMany
    {
        return $this->hasMany(Conversation::class);
    }

    public function contacts(): HasMany
    {
        return $this->hasMany(Contact::class);
    }

    public static function firstActiveWhatsapp(): ?self
    {
        return static::where('type', self::TYPE_WHATSAPP)->where('is_active', true)->first();
    }

    public function configValue(string $key, mixed $default = null): mixed
    {
        return $this->config[$key] ?? $default;
    }

    public function webhookUrl(): string
    {
        if ($this->type === self::TYPE_TELEGRAM) {
            $base = rtrim($this->config['webhook_base_url'] ?? config('app.url'), '/');
            return $base . '/api/webhooks/telegram/' . $this->id;
        }

        if ($this->type === self::TYPE_WEB) {
            return rtrim(config('app.url'), '/') . '/webchat/widget.js';
        }

        return route('webhooks.whatsapp');
    }
}
