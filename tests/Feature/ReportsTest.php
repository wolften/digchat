<?php

namespace Tests\Feature;

use App\Models\Contact;
use App\Models\Conversation;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReportsTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function makeContact(string $waId = '5547999990001'): Contact
    {
        return Contact::create([
            'wa_id'        => $waId,
            'profile_name' => 'Cliente Teste',
        ]);
    }

    public function test_gestor_can_access_reports_page(): void
    {
        $user = User::factory()->create(['role' => User::ROLE_GESTOR]);

        $this->actingAs($user)
            ->get(route('relatorios.index'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Relatorios/Index')
                ->has('atendimentos')
                ->has('atendentes')
                ->has('clientes')
            );
    }

    public function test_atendente_cannot_access_reports_page(): void
    {
        $user = User::factory()->create(['role' => User::ROLE_ATENDENTE]);

        $this->actingAs($user)
            ->get(route('relatorios.index'))
            ->assertForbidden();
    }

    public function test_reports_count_conversations_in_period(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-07-01 12:00:00'));

        $gestor = User::factory()->create(['role' => User::ROLE_GESTOR]);
        $contact = $this->makeContact();

        $contact->conversations()->create([
            'status'          => Conversation::STATUS_CLOSED,
            'last_message_at' => now(),
        ]);

        $otherContact = $this->makeContact('5547999990099');
        $old = $otherContact->conversations()->create([
            'status'          => Conversation::STATUS_OPEN,
            'last_message_at' => now(),
        ]);
        $old->forceFill([
            'created_at' => Carbon::parse('2026-05-01 10:00:00'),
            'updated_at' => Carbon::parse('2026-05-01 10:00:00'),
        ])->saveQuietly();

        $response = $this->actingAs($gestor)->get(route('relatorios.index', [
            'date_from' => '2026-06-01',
            'date_to'   => '2026-07-01',
        ]));

        $response->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('atendimentos.total_created', 1)
                ->where('atendimentos.closed', 1)
            );
    }

    public function test_reports_tme_uses_queue_and_first_response_timestamps(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-07-01 10:00:00'));

        $gestor = User::factory()->create(['role' => User::ROLE_GESTOR]);
        $attendant = User::factory()->create(['role' => User::ROLE_ATENDENTE]);
        $contact = $this->makeContact('5547999990002');

        $conversation = $contact->conversations()->create([
            'status'          => Conversation::STATUS_QUEUED,
            'last_message_at' => now(),
        ]);

        Carbon::setTestNow(now()->addMinutes(20));
        $conversation->update([
            'status'             => Conversation::STATUS_OPEN,
            'assigned_user_id'   => $attendant->id,
        ]);

        Carbon::setTestNow(now()->addMinutes(10));
        $conversation->update(['status' => Conversation::STATUS_CLOSED]);

        $this->actingAs($gestor)
            ->get(route('relatorios.index', [
                'date_from' => '2026-07-01',
                'date_to'   => '2026-07-01',
            ]))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('atendimentos.avg_tme_mins', 20)
                ->where('atendimentos.closed', 1)
            );
    }

    public function test_reports_export_atendimentos_csv(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-07-01 10:00:00'));

        $gestor = User::factory()->create(['role' => User::ROLE_GESTOR]);
        $contact = $this->makeContact('5547999990003');

        $contact->conversations()->create([
            'status'          => Conversation::STATUS_CLOSED,
            'last_message_at' => now(),
        ]);

        $response = $this->actingAs($gestor)->get(route('relatorios.export', [
            'tab'       => 'atendimentos',
            'date_from' => '2026-07-01',
            'date_to'   => '2026-07-01',
        ]));

        $response->assertOk();
        $response->assertHeader('content-type', 'text/csv; charset=UTF-8');

        $content = $response->getContent();
        $this->assertStringContainsString('Protocolo,Contato', $content);
        $this->assertStringContainsString('Cliente Teste', $content);
    }

    public function test_reports_export_atendentes_csv(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-07-01 10:00:00'));

        $gestor = User::factory()->create(['role' => User::ROLE_GESTOR]);
        $attendant = User::factory()->create(['role' => User::ROLE_ATENDENTE, 'name' => 'Maria Atendente']);
        $contact = $this->makeContact('5547999990004');

        $contact->conversations()->create([
            'status'           => Conversation::STATUS_CLOSED,
            'assigned_user_id' => $attendant->id,
            'last_message_at'  => now(),
        ]);

        $response = $this->actingAs($gestor)->get(route('relatorios.export', [
            'tab'       => 'atendentes',
            'date_from' => '2026-07-01',
            'date_to'   => '2026-07-01',
        ]));

        $response->assertOk();
        $content = $response->getContent();
        $this->assertStringContainsString('Atendente,Encerrados', $content);
        $this->assertStringContainsString('Maria Atendente', $content);
    }
}