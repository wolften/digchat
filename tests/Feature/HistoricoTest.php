<?php

namespace Tests\Feature;

use App\Models\Contact;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\Sector;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class HistoricoTest extends TestCase
{
    use RefreshDatabase;

    public function test_atendente_can_access_historico_page(): void
    {
        $atendente = User::factory()->create(['role' => User::ROLE_ATENDENTE]);

        $this->actingAs($atendente)
            ->get('/historico')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Historico/Index')
                ->where('can_export', false)
            );
    }

    public function test_atendente_sees_only_own_closed_conversations(): void
    {
        $atendente = User::factory()->create(['role' => User::ROLE_ATENDENTE]);
        $other = User::factory()->create(['role' => User::ROLE_ATENDENTE]);

        $mine = $this->makeClosedConversation($atendente, 'Meu atendimento');
        $this->makeClosedConversation($other, 'Atendimento de outro');

        $response = $this->actingAs($atendente)->get('/historico');

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->has('conversations.data', 1)
            ->where('conversations.data.0.id', $mine->id)
        );
    }

    public function test_atendente_can_open_contact_history_with_anchor(): void
    {
        $atendente = User::factory()->create(['role' => User::ROLE_ATENDENTE]);
        $contact = Contact::create([
            'wa_id' => '5547999001122',
            'profile_name' => 'Cliente Histórico',
        ]);

        $past = $contact->conversations()->create([
            'status' => Conversation::STATUS_CLOSED,
            'assigned_user_id' => $other = User::factory()->create()->id,
            'last_message_at' => now()->subDay(),
        ]);
        $past->messages()->create([
            'direction' => Message::DIRECTION_IN,
            'type' => 'text',
            'body' => 'Mensagem antiga',
            'status' => 'received',
        ]);

        $current = $contact->conversations()->create([
            'status' => Conversation::STATUS_OPEN,
            'assigned_user_id' => $atendente->id,
            'last_message_at' => now(),
        ]);

        $this->actingAs($atendente)
            ->get("/historico?conversation={$past->id}&contact_id={$contact->id}&anchor={$current->id}")
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('selected.id', $past->id)
                ->where('contact_view', true)
                ->where('selected.messages.0.body', 'Mensagem antiga')
            );
    }

    public function test_atendente_cannot_export_historico(): void
    {
        $atendente = User::factory()->create(['role' => User::ROLE_ATENDENTE]);

        $this->actingAs($atendente)
            ->get('/historico/export')
            ->assertForbidden();
    }

    public function test_gestor_can_export_historico(): void
    {
        $gestor = User::factory()->create(['role' => User::ROLE_GESTOR]);
        $this->makeClosedConversation($gestor, 'Exportável');

        $this->actingAs($gestor)
            ->get('/historico/export')
            ->assertOk()
            ->assertHeader('content-type', 'text/csv; charset=UTF-8');
    }

    public function test_contact_view_lists_all_conversations_for_contact(): void
    {
        $atendente = User::factory()->create(['role' => User::ROLE_ATENDENTE]);
        $contact = Contact::create([
            'wa_id' => '5547999003344',
            'profile_name' => 'Cliente Lista',
        ]);

        $closed = $contact->conversations()->create([
            'status' => Conversation::STATUS_CLOSED,
            'assigned_user_id' => $atendente->id,
            'last_message_at' => now()->subHours(2),
        ]);

        $open = $contact->conversations()->create([
            'status' => Conversation::STATUS_OPEN,
            'assigned_user_id' => $atendente->id,
            'last_message_at' => now(),
        ]);

        $response = $this->actingAs($atendente)
            ->get("/historico?contact_id={$contact->id}&conversation={$open->id}&anchor={$open->id}");

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->has('conversations.data', 2)
            ->where('contact_view', true)
        );
    }

    public function test_atendente_in_sector_sees_sector_closed_conversations(): void
    {
        $sector = Sector::create(['name' => 'Suporte', 'is_active' => true]);
        $atendente = User::factory()->create(['role' => User::ROLE_ATENDENTE]);
        $sector->users()->attach($atendente->id);

        $other = User::factory()->create(['role' => User::ROLE_ATENDENTE]);
        $sector->users()->attach($other->id);

        $sectorConversation = $this->makeClosedConversation($other, 'Setor Suporte', $sector);
        $this->makeClosedConversation(User::factory()->create(), 'Fora do setor');

        $this->actingAs($atendente)
            ->get('/historico')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->has('conversations.data', 1)
                ->where('conversations.data.0.id', $sectorConversation->id)
            );
    }

    private function makeClosedConversation(
        User $assignee,
        string $contactName = 'Cliente',
        ?Sector $sector = null,
    ): Conversation {
        $contact = Contact::create([
            'wa_id' => '55'.fake()->numerify('4799999####'),
            'profile_name' => $contactName,
        ]);

        return $contact->conversations()->create([
            'status' => Conversation::STATUS_CLOSED,
            'assigned_user_id' => $assignee->id,
            'sector_id' => $sector?->id,
            'last_message_at' => now(),
            'created_at' => now()->startOfMonth(),
        ]);
    }
}