<?php

namespace Tests\Feature;

use App\Enums\ActivityEvent;
use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuditoriaTest extends TestCase
{
    use RefreshDatabase;

    public function test_atendente_cannot_access_auditoria(): void
    {
        $atendente = User::factory()->create(['role' => User::ROLE_ATENDENTE]);

        $this->actingAs($atendente)
            ->get('/auditoria')
            ->assertForbidden();
    }

    public function test_gestor_can_access_auditoria_with_filters(): void
    {
        $gestor = User::factory()->create(['role' => User::ROLE_GESTOR]);
        $actor = User::factory()->create(['name' => 'Maria Silva']);

        ActivityLog::factory()->create([
            'event' => ActivityEvent::AuthLogin->value,
            'actor_user_id' => $actor->id,
            'description' => 'Maria Silva entrou no sistema.',
            'created_at' => now(),
        ]);

        ActivityLog::factory()->create([
            'event' => ActivityEvent::ConversationAssigned->value,
            'actor_user_id' => $actor->id,
            'description' => 'Maria assumiu atendimento.',
            'properties' => ['protocol_number' => 'ABC123'],
            'created_at' => now()->subDay(),
        ]);

        $this->actingAs($gestor)
            ->get('/auditoria?event='.ActivityEvent::AuthLogin->value.'&search=Maria')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Auditoria/Index')
                ->where('can_export', true)
                ->has('logs.data', 1)
                ->where('logs.data.0.event', ActivityEvent::AuthLogin->value)
            );
    }

    public function test_auditoria_export_returns_csv(): void
    {
        $gestor = User::factory()->create(['role' => User::ROLE_GESTOR]);

        ActivityLog::factory()->create([
            'event' => ActivityEvent::AuthLogout->value,
            'description' => 'Usuário saiu.',
            'created_at' => now(),
        ]);

        $response = $this->actingAs($gestor)->get('/auditoria/export');

        $response->assertOk();
        $response->assertHeader('content-type', 'text/csv; charset=UTF-8');
        $this->assertStringContainsString('Data/Hora,Evento,Ator,Descrição', $response->getContent());
        $this->assertStringContainsString('Usuário saiu.', $response->getContent());
    }
}