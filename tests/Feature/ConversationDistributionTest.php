<?php

namespace Tests\Feature;

use App\Models\AppSetting;
use App\Models\Contact;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\Sector;
use App\Models\User;
use App\Services\Conversation\ConversationDistributionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class ConversationDistributionTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Config::set('services.whatsapp.phone_number_id', '123456');
        Config::set('services.whatsapp.access_token', 'token');
        Config::set('queue.default', 'sync');
    }

    private function makeQueuedConversation(?Sector $sector = null): Conversation
    {
        $contact = Contact::create([
            'wa_id' => '55'.fake()->numerify('4799999####'),
            'profile_name' => 'Cliente Fila',
        ]);

        return $contact->conversations()->create([
            'status' => Conversation::STATUS_QUEUED,
            'sector_id' => $sector?->id,
            'last_message_at' => now(),
        ]);
    }

    private function markUserOnline(User $user): void
    {
        DB::table(config('session.table', 'sessions'))->insert([
            'id' => 'session-'.$user->id,
            'user_id' => $user->id,
            'ip_address' => '127.0.0.1',
            'user_agent' => 'PHPUnit',
            'payload' => base64_encode(serialize([])),
            'last_activity' => now()->timestamp,
        ]);
    }

    public function test_disabled_distribution_leaves_conversation_in_queue(): void
    {
        AppSetting::set('auto_assign_conversations_enabled', '0');

        $sector = Sector::create(['name' => 'Suporte', 'is_active' => true]);
        $agent = User::factory()->create(['role' => User::ROLE_ATENDENTE]);
        $sector->users()->attach($agent->id);
        $this->markUserOnline($agent);

        $conversation = $this->makeQueuedConversation($sector);

        $conversation->refresh();
        $this->assertSame(Conversation::STATUS_QUEUED, $conversation->status);
        $this->assertNull($conversation->assigned_user_id);
    }

    public function test_least_busy_assigns_agent_with_fewer_open_conversations(): void
    {
        Http::fake([
            'graph.facebook.com/*' => Http::response(['messages' => [['id' => 'wamid.AUTO']]], 200),
        ]);

        AppSetting::set('auto_assign_conversations_enabled', '1');
        AppSetting::set('auto_assign_strategy', 'least_busy');
        AppSetting::set('auto_assign_online_only', '1');

        $sector = Sector::create(['name' => 'Suporte', 'is_active' => true]);
        $busy = User::factory()->create(['role' => User::ROLE_ATENDENTE, 'name' => 'Ocupado']);
        $free = User::factory()->create(['role' => User::ROLE_ATENDENTE, 'name' => 'Livre']);
        $sector->users()->attach([$busy->id, $free->id]);
        $this->markUserOnline($busy);
        $this->markUserOnline($free);

        $this->makeQueuedConversation($sector)->forceFill([
            'status' => Conversation::STATUS_OPEN,
            'assigned_user_id' => $busy->id,
        ])->save();

        $conversation = $this->makeQueuedConversation($sector);

        $conversation->refresh();
        $this->assertSame(Conversation::STATUS_OPEN, $conversation->status);
        $this->assertSame($free->id, $conversation->assigned_user_id);

        $this->assertDatabaseHas('messages', [
            'conversation_id' => $conversation->id,
            'direction' => Message::DIRECTION_OUT,
            'body' => 'Usuário Livre assumiu seu atendimento.',
        ]);
    }

    public function test_round_robin_rotates_between_eligible_agents(): void
    {
        Http::fake([
            'graph.facebook.com/*' => Http::response(['messages' => [['id' => 'wamid.RR']]], 200),
        ]);

        AppSetting::set('auto_assign_conversations_enabled', '1');
        AppSetting::set('auto_assign_strategy', 'round_robin');
        AppSetting::set('auto_assign_online_only', '0');

        $sector = Sector::create(['name' => 'Financeiro', 'is_active' => true]);
        $first = User::factory()->create(['role' => User::ROLE_ATENDENTE, 'name' => 'Ana']);
        $second = User::factory()->create(['role' => User::ROLE_ATENDENTE, 'name' => 'Bruno']);
        $sector->users()->attach([$first->id, $second->id]);

        $service = app(ConversationDistributionService::class);

        $one = Conversation::withoutEvents(fn () => $this->makeQueuedConversation($sector));
        $service->tryAssign($one);
        $this->assertSame($first->id, $one->fresh()->assigned_user_id);

        $two = Conversation::withoutEvents(fn () => $this->makeQueuedConversation($sector));
        $service->tryAssign($two);
        $this->assertSame($second->id, $two->fresh()->assigned_user_id);

        $three = Conversation::withoutEvents(fn () => $this->makeQueuedConversation($sector));
        $service->tryAssign($three);
        $this->assertSame($first->id, $three->fresh()->assigned_user_id);
    }

    public function test_online_only_skips_offline_agents(): void
    {
        AppSetting::set('auto_assign_conversations_enabled', '1');
        AppSetting::set('auto_assign_strategy', 'least_busy');
        AppSetting::set('auto_assign_online_only', '1');

        $sector = Sector::create(['name' => 'Suporte', 'is_active' => true]);
        $offline = User::factory()->create(['role' => User::ROLE_ATENDENTE]);
        $sector->users()->attach($offline->id);

        $conversation = $this->makeQueuedConversation($sector);

        $conversation->refresh();
        $this->assertSame(Conversation::STATUS_QUEUED, $conversation->status);
        $this->assertNull($conversation->assigned_user_id);
    }

    public function test_max_open_limit_excludes_busy_agents(): void
    {
        AppSetting::set('auto_assign_conversations_enabled', '1');
        AppSetting::set('auto_assign_strategy', 'least_busy');
        AppSetting::set('auto_assign_online_only', '0');
        AppSetting::set('auto_assign_max_open_per_agent', '1');

        $sector = Sector::create(['name' => 'Suporte', 'is_active' => true]);
        $agent = User::factory()->create(['role' => User::ROLE_ATENDENTE]);
        $sector->users()->attach($agent->id);

        $this->makeQueuedConversation($sector)->forceFill([
            'status' => Conversation::STATUS_OPEN,
            'assigned_user_id' => $agent->id,
        ])->save();

        $conversation = $this->makeQueuedConversation($sector);

        $conversation->refresh();
        $this->assertSame(Conversation::STATUS_QUEUED, $conversation->status);
        $this->assertNull($conversation->assigned_user_id);
    }

    public function test_distribute_queued_command_assigns_backlog(): void
    {
        Http::fake([
            'graph.facebook.com/*' => Http::response(['messages' => [['id' => 'wamid.CMD']]], 200),
        ]);

        AppSetting::set('auto_assign_conversations_enabled', '1');
        AppSetting::set('auto_assign_online_only', '0');

        $sector = Sector::create(['name' => 'Suporte', 'is_active' => true]);
        $agent = User::factory()->create(['role' => User::ROLE_ATENDENTE]);
        $sector->users()->attach($agent->id);

        $conversation = Conversation::withoutEvents(fn () => $this->makeQueuedConversation($sector));

        $this->artisan('conversations:distribute-queued')->assertSuccessful();

        $conversation->refresh();
        $this->assertSame(Conversation::STATUS_OPEN, $conversation->status);
        $this->assertSame($agent->id, $conversation->assigned_user_id);
    }

    public function test_admin_can_save_auto_assign_settings(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);

        $this->actingAs($admin)
            ->post('/configuracoes/sistema', [
                'app_name' => 'DigChat',
                'notify_customer_on_transfer' => '1',
                'auto_close_inactive_conversations_minutes' => 60,
                'auto_assign_conversations_enabled' => '1',
                'auto_assign_strategy' => 'round_robin',
                'auto_assign_online_only' => '0',
                'auto_assign_max_open_per_agent' => 5,
            ])
            ->assertRedirect();

        $this->assertSame('1', AppSetting::get('auto_assign_conversations_enabled'));
        $this->assertSame('round_robin', AppSetting::get('auto_assign_strategy'));
        $this->assertSame('0', AppSetting::get('auto_assign_online_only'));
        $this->assertSame('5', AppSetting::get('auto_assign_max_open_per_agent'));
    }
}