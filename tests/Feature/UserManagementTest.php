<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_registration_is_disabled(): void
    {
        $this->get('/register')->assertNotFound();
    }

    public function test_guests_are_redirected_to_login_from_users(): void
    {
        $this->get('/users')->assertRedirect('/login');
    }

    public function test_atendente_cannot_access_user_management(): void
    {
        $atendente = User::factory()->create(['role' => User::ROLE_ATENDENTE]);

        $this->actingAs($atendente)->get('/users')->assertForbidden();
    }

    public function test_gestor_can_access_user_management(): void
    {
        $gestor = User::factory()->create(['role' => User::ROLE_GESTOR]);

        $this->actingAs($gestor)->get('/users')->assertOk();
    }

    public function test_admin_can_create_a_user(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);

        $this->actingAs($admin)->post('/users', [
            'name' => 'Novo Atendente',
            'email' => 'atendente@fibron.com.br',
            'role' => User::ROLE_ATENDENTE,
            'is_active' => true,
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ])->assertRedirect();

        $this->assertDatabaseHas('users', [
            'email' => 'atendente@fibron.com.br',
            'role' => User::ROLE_ATENDENTE,
        ]);
    }

    public function test_gestor_cannot_assign_admin_role(): void
    {
        $gestor = User::factory()->create(['role' => User::ROLE_GESTOR]);

        $this->actingAs($gestor)->post('/users', [
            'name' => 'Tentativa Admin',
            'email' => 'hacker@fibron.com.br',
            'role' => User::ROLE_ADMIN,
            'is_active' => true,
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ])->assertForbidden();

        $this->assertDatabaseMissing('users', ['email' => 'hacker@fibron.com.br']);
    }

    public function test_inactive_user_is_blocked_by_role_middleware(): void
    {
        $admin = User::factory()->create([
            'role' => User::ROLE_ADMIN,
            'is_active' => false,
        ]);

        $this->actingAs($admin)->get('/users')->assertForbidden();
    }

    public function test_user_cannot_delete_themselves(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);

        $this->actingAs($admin)->delete("/users/{$admin->id}");

        $this->assertDatabaseHas('users', ['id' => $admin->id]);
    }
}
