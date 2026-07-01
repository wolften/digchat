<?php

namespace Tests\Feature;

use App\Events\InternalConversationRead;
use App\Events\InternalConversationTyping;
use App\Events\InternalConversationUpdated;
use App\Events\InternalMessageCreated;
use App\Models\InternalConversation;
use App\Models\InternalConversationParticipant;
use App\Models\InternalMessage;
use App\Models\User;
use App\Services\InternalChat\InternalChatService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class InternalChatTest extends TestCase
{
    use RefreshDatabase;

    private InternalChatService $chat;

    protected function setUp(): void
    {
        parent::setUp();
        $this->chat = app(InternalChatService::class);
    }

    public function test_user_can_view_internal_chat_page(): void
    {
        $user = User::factory()->create(['role' => User::ROLE_ATENDENTE]);

        $this->actingAs($user)
            ->get('/chat-interno')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('InternalChat/Index')
                ->has('conversations')
                ->has('users'));
    }

    public function test_list_includes_general_room(): void
    {
        $user = User::factory()->create(['role' => User::ROLE_ATENDENTE]);

        $conversations = $this->chat->listConversationsFor($user);

        $this->assertNotEmpty($conversations);
        $this->assertSame(InternalConversation::TYPE_GENERAL, $conversations[0]['type']);
        $this->assertSame('Chat Geral', $conversations[0]['title']);
    }

    public function test_direct_conversation_is_idempotent(): void
    {
        $userA = User::factory()->create();
        $userB = User::factory()->create();

        $first = $this->chat->findOrCreateDirect($userA, $userB->id);
        $second = $this->chat->findOrCreateDirect($userA, $userB->id);

        $this->assertSame($first->id, $second->id);
        $this->assertSame(1, InternalConversation::where('type', InternalConversation::TYPE_DIRECT)->count());
    }

    public function test_user_can_send_message_in_general_room(): void
    {
        Event::fake([InternalMessageCreated::class, InternalConversationUpdated::class]);

        $user = User::factory()->create();
        $general = $this->chat->generalConversation();
        $this->chat->ensureGeneralRoomMembership($user);

        $message = $this->chat->sendMessage($general, $user, 'Olá equipe');

        $this->assertDatabaseHas('internal_messages', [
            'id' => $message->id,
            'internal_conversation_id' => $general->id,
            'user_id' => $user->id,
            'body' => 'Olá equipe',
        ]);

        Event::assertDispatched(InternalMessageCreated::class);
        Event::assertDispatched(InternalConversationUpdated::class);
    }

    public function test_non_participant_cannot_send_message(): void
    {
        $owner = User::factory()->create();
        $intruder = User::factory()->create();
        $other = User::factory()->create();

        $conversation = $this->chat->findOrCreateDirect($owner, $other->id);

        $this->actingAs($intruder)
            ->postJson(route('chat-interno.messages.store', $conversation), ['body' => 'hack'])
            ->assertForbidden();
    }

    public function test_mark_as_read_clears_unread_count(): void
    {
        Event::fake([InternalConversationRead::class, InternalConversationUpdated::class]);

        $userA = User::factory()->create();
        $userB = User::factory()->create();
        $conversation = $this->chat->findOrCreateDirect($userA, $userB->id);

        $this->chat->sendMessage($conversation, $userA, 'Mensagem para B');

        $participantB = InternalConversationParticipant::query()
            ->where('internal_conversation_id', $conversation->id)
            ->where('user_id', $userB->id)
            ->first();

        $this->assertGreaterThan(0, $this->chat->unreadCountFor($participantB));

        $this->chat->markAsRead($conversation->fresh(), $userB);

        $participantB->refresh();
        $this->assertSame(0, $this->chat->unreadCountFor($participantB));

        Event::assertDispatched(InternalConversationRead::class);
    }

    public function test_store_direct_redirects_to_conversation(): void
    {
        $userA = User::factory()->create();
        $userB = User::factory()->create();

        $this->actingAs($userA)
            ->post(route('chat-interno.direct'), ['user_id' => $userB->id])
            ->assertRedirect();

        $conversation = InternalConversation::where('type', InternalConversation::TYPE_DIRECT)->first();
        $this->assertNotNull($conversation);

        $this->actingAs($userA)
            ->get(route('chat-interno.show', $conversation))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('InternalChat/Index')
                ->where('selected.id', $conversation->id));
    }

    public function test_cannot_start_direct_chat_with_self(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->post(route('chat-interno.direct'), ['user_id' => $user->id])
            ->assertSessionHasErrors('user_id');
    }

    public function test_total_unread_count_sums_across_conversations(): void
    {
        $userA = User::factory()->create();
        $userB = User::factory()->create();
        $userC = User::factory()->create();

        $dm1 = $this->chat->findOrCreateDirect($userA, $userB->id);
        $dm2 = $this->chat->findOrCreateDirect($userA, $userC->id);

        $this->chat->sendMessage($dm1, $userB, 'Oi A');
        $this->chat->sendMessage($dm2, $userC, 'Oi A também');

        $this->assertSame(2, $this->chat->totalUnreadCount($userA));
    }

    public function test_participant_can_broadcast_typing_indicator(): void
    {
        Event::fake([InternalConversationTyping::class]);

        $userA = User::factory()->create();
        $userB = User::factory()->create();
        $conversation = $this->chat->findOrCreateDirect($userA, $userB->id);

        $this->actingAs($userA)
            ->postJson(route('chat-interno.typing', $conversation), ['typing' => true])
            ->assertOk()
            ->assertJson(['ok' => true]);

        Event::assertDispatched(InternalConversationTyping::class, function ($event) use ($userA, $conversation) {
            return $event->user->id === $userA->id
                && $event->conversation->id === $conversation->id
                && $event->typing === true;
        });
    }

    public function test_non_participant_cannot_send_typing_indicator(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $intruder = User::factory()->create();
        $conversation = $this->chat->findOrCreateDirect($owner, $other->id);

        $this->actingAs($intruder)
            ->postJson(route('chat-interno.typing', $conversation), ['typing' => true])
            ->assertForbidden();
    }

    public function test_existing_messages_are_linked_to_general_room(): void
    {
        $user = User::factory()->create();
        $general = $this->chat->generalConversation();

        InternalMessage::create([
            'internal_conversation_id' => $general->id,
            'user_id' => $user->id,
            'body' => 'Legado',
        ]);

        $this->assertDatabaseHas('internal_messages', [
            'body' => 'Legado',
            'internal_conversation_id' => $general->id,
        ]);
    }
}