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
