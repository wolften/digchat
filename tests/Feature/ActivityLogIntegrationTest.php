<?php

namespace Tests\Feature;

use App\Enums\ActivityEvent;
use App\Models\ActivityLog;
use App\Models\Contact;
use App\Models\Conversation;
use App\Models\Sector;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ActivityLogIntegrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_login_creates_activity_log(): void
    {
        $user = User::factory()->create([
            'email' => 'audit@test.com',
            'password' => bcrypt('password'),
        ]);

        $this->post('/login', [
            'email' => 'audit@test.com',
            'password' => 'password',
        ])->assertRedirect();

        $this->assertDatabaseHas('activity_logs', [
            'event' => ActivityEvent::AuthLogin->value,
            'actor_user_id' => $user->id,
        ]);

        $this->assertDatabaseHas('activity_logs', [
            'event' => ActivityEvent::PresenceOnline->value,
            'actor_user_id' => $user->id,
        ]);
    }

    public function test_assign_conversation_creates_activity_log(): void
    {
        $atendente = User::factory()->create(['role' => User::ROLE_ATENDENTE]);
        $contact = Contact::create(['wa_id' => '5547999000001', 'profile_name' => 'Cliente']);
        $conversation = Conversation::create([
            'contact_id' => $contact->id,
            'status' => Conversation::STATUS_QUEUED,
            'protocol_number' => 'P-100',
        ]);

        $this->actingAs($atendente)
            ->post(route('inbox.assign', $conversation))
            ->assertRedirect();

        $this->assertDatabaseHas('activity_logs', [
            'event' => ActivityEvent::ConversationAssigned->value,
            'actor_user_id' => $atendente->id,
            'subject_type' => Conversation::class,
            'subject_id' => $conversation->id,
        ]);
    }

    public function test_transfer_to_user_creates_activity_log(): void
    {
        $actor = User::factory()->create(['role' => User::ROLE_GESTOR]);
        $target = User::factory()->create(['role' => User::ROLE_ATENDENTE, 'name' => 'João']);
        $contact = Contact::create(['wa_id' => '5547999000002', 'profile_name' => 'Cliente 2']);
        $conversation = Conversation::create([
            'contact_id' => $contact->id,
            'status' => Conversation::STATUS_OPEN,
            'assigned_user_id' => $actor->id,
            'protocol_number' => 'P-200',
        ]);

        $this->actingAs($actor)
            ->post(route('inbox.transfer', $conversation), ['user_id' => $target->id])
            ->assertRedirect();

        $log = ActivityLog::where('event', ActivityEvent::ConversationTransferred->value)->first();

        $this->assertNotNull($log);
        $this->assertSame($actor->id, $log->actor_user_id);
        $this->assertSame('user', $log->properties['mode'] ?? null);
        $this->assertSame($target->id, $log->properties['to_user_id'] ?? null);
    }

    public function test_user_created_logs_admin_action(): void
    {
        $gestor = User::factory()->create(['role' => User::ROLE_GESTOR]);

        $this->actingAs($gestor)
            ->post(route('users.store'), [
                'name' => 'Novo Atendente',
                'email' => 'novo@test.com',
                'role' => User::ROLE_ATENDENTE,
                'is_active' => true,
                'password' => 'password',
                'password_confirmation' => 'password',
            ])
            ->assertRedirect();

        $this->assertDatabaseHas('activity_logs', [
            'event' => ActivityEvent::UserCreated->value,
            'actor_user_id' => $gestor->id,
        ]);
    }

    public function test_sector_created_logs_admin_action(): void
    {
        $gestor = User::factory()->create(['role' => User::ROLE_GESTOR]);

        $this->actingAs($gestor)
            ->post(route('setores.store'), [
                'name' => 'Suporte',
                'description' => 'Setor de suporte',
                'is_active' => true,
            ])
            ->assertRedirect();

        $this->assertDatabaseHas('activity_logs', [
            'event' => ActivityEvent::SectorCreated->value,
            'actor_user_id' => $gestor->id,
        ]);
    }
}