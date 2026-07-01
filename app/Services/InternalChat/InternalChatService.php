<?php

namespace App\Services\InternalChat;

use App\Events\InternalConversationRead;
use App\Events\InternalConversationUpdated;
use App\Events\InternalMessageCreated;
use App\Models\InternalConversation;
use App\Models\InternalConversationParticipant;
use App\Models\InternalMessage;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class InternalChatService
{
    public const GENERAL_CONVERSATION_TITLE = 'Chat Geral';
    public function ensureGeneralRoomMembership(User $user): void
    {
        if (! $user->is_active) {
            return;
        }

        $general = $this->generalConversation();

        InternalConversationParticipant::firstOrCreate(
            [
                'internal_conversation_id' => $general->id,
                'user_id' => $user->id,
            ],
            ['last_read_at' => now()],
        );
    }

    public function generalConversation(): InternalConversation
    {
        $general = InternalConversation::query()
            ->where('type', InternalConversation::TYPE_GENERAL)
            ->first();

        if ($general) {
            return $general;
        }

        return InternalConversation::create([
            'type' => InternalConversation::TYPE_GENERAL,
            'last_message_at' => null,
        ]);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function listConversationsFor(User $user): array
    {
        $this->ensureGeneralRoomMembership($user);

        $participantRows = InternalConversationParticipant::query()
            ->where('user_id', $user->id)
            ->with([
                'conversation.messages' => fn ($q) => $q->latest()->limit(1)->with('user:id,name,profile_photo_path'),
                'conversation.participants.user:id,name,profile_photo_path',
            ])
            ->get()
            ->sortByDesc(fn (InternalConversationParticipant $p) => $p->conversation?->last_message_at ?? $p->created_at)
            ->values();

        return $participantRows
            ->map(fn (InternalConversationParticipant $participant) => $this->formatConversationSummary(
                $participant->conversation,
                $user,
                $participant,
            ))
            ->filter()
            ->values()
            ->all();
    }

    /**
     * @return array<int, array{id: int, name: string}>
     */
    public function listActiveUsersExcept(User $user): array
    {
        return User::query()
            ->where('is_active', true)
            ->whereKeyNot($user->id)
            ->orderBy('name')
            ->get(['id', 'name', 'profile_photo_path'])
            ->map(fn (User $u) => $u->publicSummary())
            ->values()
            ->all();
    }

    public function findOrCreateDirect(User $me, int $otherUserId): InternalConversation
    {
        if ($otherUserId === $me->id) {
            throw ValidationException::withMessages([
                'user_id' => 'Não é possível iniciar conversa consigo mesmo.',
            ]);
        }

        $other = User::query()
            ->whereKey($otherUserId)
            ->where('is_active', true)
            ->first();

        if (! $other) {
            throw ValidationException::withMessages([
                'user_id' => 'Usuário não encontrado ou inativo.',
            ]);
        }

        $existing = InternalConversation::query()
            ->where('type', InternalConversation::TYPE_DIRECT)
            ->whereHas('participants', fn ($q) => $q->where('user_id', $me->id))
            ->whereHas('participants', fn ($q) => $q->where('user_id', $otherUserId))
            ->whereRaw(
                '(select count(*) from internal_conversation_participants p where p.internal_conversation_id = internal_conversations.id) = 2',
            )
            ->first();

        if ($existing) {
            return $existing;
        }

        return DB::transaction(function () use ($me, $otherUserId) {
            $conversation = InternalConversation::create([
                'type' => InternalConversation::TYPE_DIRECT,
                'last_message_at' => null,
            ]);

            foreach ([$me->id, $otherUserId] as $userId) {
                InternalConversationParticipant::create([
                    'internal_conversation_id' => $conversation->id,
                    'user_id' => $userId,
                    'last_read_at' => null,
                ]);
            }

            InternalConversationUpdated::dispatch(
                $conversation->fresh(['participants.user', 'messages.user']),
                $me,
            );

            return $conversation;
        });
    }

    public function sendMessage(InternalConversation $conversation, User $user, string $body): InternalMessage
    {
        abort_unless($conversation->isParticipant($user), 403);

        $message = InternalMessage::create([
            'internal_conversation_id' => $conversation->id,
            'user_id' => $user->id,
            'body' => $body,
        ]);

        $conversation->update(['last_message_at' => $message->created_at]);
        $message->load('user:id,name,profile_photo_path');

        InternalMessageCreated::dispatch($message);
        InternalConversationUpdated::dispatch($conversation->fresh(['participants.user', 'messages.user']), $user);

        return $message;
    }

    public function markAsRead(InternalConversation $conversation, User $user): ?InternalConversationParticipant
    {
        abort_unless($conversation->isParticipant($user), 403);

        $participant = InternalConversationParticipant::query()
            ->where('internal_conversation_id', $conversation->id)
            ->where('user_id', $user->id)
            ->first();

        if (! $participant) {
            return null;
        }

        if ($participant->last_read_at && $participant->last_read_at->diffInSeconds(now()) <= 30) {
            return $participant;
        }

        $participant->update(['last_read_at' => now()]);

        InternalConversationRead::dispatch($conversation, $user, $participant->last_read_at);
        InternalConversationUpdated::dispatch($conversation->fresh(['participants.user', 'messages.user']), $user);

        return $participant->fresh();
    }

    public function totalUnreadCount(User $user): int
    {
        $this->ensureGeneralRoomMembership($user);

        return (int) InternalConversationParticipant::query()
            ->where('user_id', $user->id)
            ->get()
            ->sum(fn (InternalConversationParticipant $participant) => $this->unreadCountFor($participant));
    }

    /**
     * @return array<string, mixed>|null
     */
    public function loadConversation(InternalConversation $conversation, User $user): ?array
    {
        if (! $conversation->isParticipant($user)) {
            return null;
        }

        $participant = $this->markAsRead($conversation, $user);

        $messages = $conversation->messages()
            ->with('user:id,name,profile_photo_path')
            ->latest()
            ->limit(80)
            ->get()
            ->reverse()
            ->values()
            ->map(fn (InternalMessage $m) => $this->formatMessage($m));

        $otherParticipant = $conversation->isDirect()
            ? $conversation->participants()->with('user:id,name,profile_photo_path')->where('user_id', '!=', $user->id)->first()
            : null;

        return [
            'id' => $conversation->id,
            'type' => $conversation->type,
            'title' => $this->conversationTitle($conversation, $user),
            'other_user' => $otherParticipant?->user?->publicSummary(),
            'other_last_read_at' => $otherParticipant?->last_read_at?->toIso8601String(),
            'unread_count' => 0,
            'messages' => $messages,
            'my_last_read_at' => $participant?->last_read_at?->toIso8601String(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function formatMessage(InternalMessage $message): array
    {
        return [
            'id' => $message->id,
            'body' => $message->body,
            'user_id' => $message->user_id,
            'user_name' => $message->user?->name,
            'user_profile_photo_url' => $message->user?->profile_photo_url,
            'created_at' => $message->created_at->toIso8601String(),
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    public function formatConversationSummary(
        ?InternalConversation $conversation,
        User $user,
        ?InternalConversationParticipant $participant = null,
    ): ?array {
        if (! $conversation) {
            return null;
        }

        $participant ??= InternalConversationParticipant::query()
            ->where('internal_conversation_id', $conversation->id)
            ->where('user_id', $user->id)
            ->first();

        if (! $participant) {
            return null;
        }

        $lastMessage = $conversation->messages()->latest()->with('user:id,name,profile_photo_path')->first();
        $otherParticipant = $conversation->isDirect()
            ? $conversation->participants()->with('user:id,name,profile_photo_path')->where('user_id', '!=', $user->id)->first()
            : null;

        return [
            'id' => $conversation->id,
            'type' => $conversation->type,
            'title' => $this->conversationTitle($conversation, $user),
            'other_user' => $otherParticipant?->user?->publicSummary(),
            'last_message' => $lastMessage?->body,
            'last_message_user_name' => $lastMessage?->user?->name,
            'last_message_at' => $conversation->last_message_at?->toIso8601String(),
            'unread_count' => $this->unreadCountFor($participant),
            'other_last_read_at' => $otherParticipant?->last_read_at?->toIso8601String(),
        ];
    }

    public function conversationTitle(InternalConversation $conversation, User $user): string
    {
        if ($conversation->isGeneral()) {
            return self::GENERAL_CONVERSATION_TITLE;
        }

        $other = $conversation->participants()
            ->with('user:id,name,profile_photo_path')
            ->where('user_id', '!=', $user->id)
            ->first();

        return $other?->user?->name ?? 'Conversa';
    }

    public function unreadCountFor(InternalConversationParticipant $participant): int
    {
        return InternalMessage::query()
            ->where('internal_conversation_id', $participant->internal_conversation_id)
            ->where('user_id', '!=', $participant->user_id)
            ->when(
                $participant->last_read_at,
                fn ($q) => $q->where('created_at', '>', $participant->last_read_at),
            )
            ->count();
    }

    /**
     * @return array{viewers: array<int, array<string, mixed>>, pending: array<int, array<string, mixed>>}
     */
    public function seenBy(InternalMessage $message): array
    {
        $format = fn (InternalConversationParticipant $p) => [
            'user_id' => $p->user_id,
            'name' => $p->user?->name,
            'profile_photo_url' => $p->user?->profile_photo_url,
            'seen_at' => $p->last_read_at?->toIso8601String(),
        ];

        [$viewers, $pending] = InternalConversationParticipant::query()
            ->where('internal_conversation_id', $message->internal_conversation_id)
            ->where('user_id', '!=', $message->user_id)
            ->with('user:id,name,profile_photo_path')
            ->get()
            ->partition(fn (InternalConversationParticipant $p) => $p->last_read_at?->gte($message->created_at) ?? false);

        return [
            'viewers' => $viewers->sortByDesc('last_read_at')->map($format)->values()->all(),
            'pending' => $pending->sortBy(fn (InternalConversationParticipant $p) => $p->user?->name)->map($format)->values()->all(),
        ];
    }

    /**
     * @return Collection<int, User>
     */
    public function recipientsFor(InternalMessage $message, User $sender): Collection
    {
        return User::query()
            ->whereIn(
                'id',
                InternalConversationParticipant::query()
                    ->where('internal_conversation_id', $message->internal_conversation_id)
                    ->where('user_id', '!=', $sender->id)
                    ->pluck('user_id'),
            )
            ->where('is_active', true)
            ->get();
    }
}