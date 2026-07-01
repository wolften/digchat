<?php

namespace Tests\Feature;

use App\Events\ConversationViewing;
use App\Models\Contact;
use App\Models\Conversation;
use App\Models\User;
use App\Services\Conversation\ConversationViewingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class InboxViewingTest extends TestCase
{
    use RefreshDatabase;

    private function makeConversation(array $overrides = []): Conversation
    {
        $contact = Contact::create([
            'wa_id' => '5547999990001',
            'profile_name' => 'Cliente',
        ]);

        return $contact->conversations()->create(array_merge([
            'status' => Conversation::STATUS_QUEUED,
            'last_message_at' => now(),
        ], $overrides));
    }

    public function test_agent_can_announce_viewing_and_see_other_viewers(): void
    {
        Event::fake([ConversationViewing::class]);

        $viewer = User::factory()->create(['role' => User::ROLE_ATENDENTE, 'name' => 'Maria']);
        $observer = User::factory()->create(['role' => User::ROLE_ATENDENTE, 'name' => 'João']);
        $conversation = $this->makeConversation();

        app(ConversationViewingService::class)->markViewing($conversation, $viewer);

        $this->actingAs($observer)
            ->postJson(route('inbox.viewing', $conversation), ['viewing' => true])
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('viewers.0.user_name', 'Maria');

        Event::assertDispatched(ConversationViewing::class, function (ConversationViewing $event) use ($conversation, $viewer, $observer): bool {
            return $event->conversation->id === $conversation->id
                && count($event->viewers) === 2
                && collect($event->viewers)->pluck('user_id')->sort()->values()->all()
                    === collect([$viewer->id, $observer->id])->sort()->values()->all();
        });
    }

    public function test_agent_can_stop_viewing(): void
    {
        Event::fake([ConversationViewing::class]);

        $user = User::factory()->create(['role' => User::ROLE_ATENDENTE]);
        $conversation = $this->makeConversation();
        $service = app(ConversationViewingService::class);

        $service->markViewing($conversation, $user);

        $this->actingAs($user)
            ->postJson(route('inbox.viewing', $conversation), ['viewing' => false])
            ->assertOk()
            ->assertJsonPath('viewers', []);

        $this->assertSame([], $service->viewersFor($conversation));
    }

    public function test_user_without_access_cannot_announce_viewing(): void
    {
        $owner = User::factory()->create(['role' => User::ROLE_ATENDENTE]);
        $intruder = User::factory()->create(['role' => User::ROLE_ATENDENTE]);
        $conversation = $this->makeConversation([
            'status' => Conversation::STATUS_OPEN,
            'assigned_user_id' => $owner->id,
        ]);

        $this->actingAs($intruder)
            ->postJson(route('inbox.viewing', $conversation), ['viewing' => true])
            ->assertForbidden();
    }
}