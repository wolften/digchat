<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    public const ROLE_ADMIN = 'admin';
    public const ROLE_GESTOR = 'gestor';
    public const ROLE_ATENDENTE = 'atendente';

    public const ROLES = [
        self::ROLE_ADMIN,
        self::ROLE_GESTOR,
        self::ROLE_ATENDENTE,
    ];

    public const COLOR_THEME_GREEN = 'green';
    public const COLOR_THEME_BLUE = 'blue';
    public const COLOR_THEME_RED = 'red';
    public const COLOR_THEME_YELLOW = 'yellow';
    public const COLOR_THEME_ORANGE = 'orange';
    public const COLOR_THEME_PURPLE = 'purple';
    public const COLOR_THEME_TURQUOISE = 'turquoise';
    public const COLOR_THEME_GRAPHITE = 'graphite';
    public const COLOR_THEME_PINK = 'pink';
    public const COLOR_THEME_INDIGO = 'indigo';
    public const COLOR_THEME_CORAL = 'coral';
    public const COLOR_THEME_AMBER = 'amber';
    public const COLOR_THEME_LIME = 'lime';
    public const COLOR_THEME_CYAN = 'cyan';
    public const COLOR_THEME_WINE = 'wine';

    public const COLOR_THEMES = [
        self::COLOR_THEME_GREEN,
        self::COLOR_THEME_BLUE,
        self::COLOR_THEME_RED,
        self::COLOR_THEME_YELLOW,
        self::COLOR_THEME_ORANGE,
        self::COLOR_THEME_PURPLE,
        self::COLOR_THEME_TURQUOISE,
        self::COLOR_THEME_GRAPHITE,
        self::COLOR_THEME_PINK,
        self::COLOR_THEME_INDIGO,
        self::COLOR_THEME_CORAL,
        self::COLOR_THEME_AMBER,
        self::COLOR_THEME_LIME,
        self::COLOR_THEME_CYAN,
        self::COLOR_THEME_WINE,
    ];

    public const COLOR_THEME_DEFAULT = self::COLOR_THEME_GREEN;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'color_theme',
        'is_active',
        'last_seen_at',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_seen_at'      => 'datetime',
            'password'          => 'hashed',
            'is_active'         => 'boolean',
        ];
    }

    public function isAdmin(): bool
    {
        return $this->role === self::ROLE_ADMIN;
    }

    public function isGestor(): bool
    {
        return $this->role === self::ROLE_GESTOR;
    }

    public function isAtendente(): bool
    {
        return $this->role === self::ROLE_ATENDENTE;
    }

    /** Admins and gestores can manage the platform. */
    public function isManager(): bool
    {
        return in_array($this->role, [self::ROLE_ADMIN, self::ROLE_GESTOR], true);
    }

    /**
     * Conversations currently assigned to this user (agent).
     */
    public function conversations(): HasMany
    {
        return $this->hasMany(Conversation::class, 'assigned_user_id');
    }

    public function sectors(): BelongsToMany
    {
        return $this->belongsToMany(Sector::class);
    }
}
