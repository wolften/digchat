<?php

namespace App\Http\Controllers;

use App\Events\InternalConversationTyping;
use App\Models\InternalConversation;
use App\Models\InternalMessage;
use App\Services\InternalChat\InternalChatService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Inertia\Inertia;
use Inertia\Response;

class InternalChatController extends Controller
{
    public function __construct(private InternalChatService $chat) {}

    public function index(Request $request): Response|RedirectResponse
    {
        $user = $request->user();
        $conversations = $this->chat->listConversationsFor($user);

        $selected = null;
        if ($request->filled('conversation')) {
            $conversation = InternalConversation::query()->find((int) $request->integer('conversation'));
            if ($conversation) {
                $selected = $this->chat->loadConversation($conversation, $user);
            }
            if ($selected === null) {
                return redirect()->route('chat-interno.index');
            }
        }

        return Inertia::render('InternalChat/Index', [
            'conversations' => $conversations,
            'selected' => $selected,
            'users' => $this->chat->listActiveUsersExcept($user),
        ]);
    }

    public function show(Request $request, InternalConversation $conversation): Response|RedirectResponse
    {
        return $this->index($request->merge(['conversation' => $conversation->id]));
    }

    public function storeDirect(Request $request): RedirectResponse
    {
        $data = $request->validate(['user_id' => 'required|integer|exists:users,id']);
        $conversation = $this->chat->findOrCreateDirect($request->user(), (int) $data['user_id']);

        return redirect()->route('chat-interno.show', $conversation);
    }

    public function storeMessage(Request $request, InternalConversation $conversation): JsonResponse
    {
        $data = $request->validate(['body' => 'required|string|max:2000']);
        $message = $this->chat->sendMessage($conversation, $request->user(), $data['body']);

        return response()->json($this->chat->formatMessage($message), 201);
    }

    public function markRead(Request $request, InternalConversation $conversation): JsonResponse
    {
        $participant = $this->chat->markAsRead($conversation, $request->user());

        return response()->json([
            'last_read_at' => $participant?->last_read_at?->toIso8601String(),
        ]);
    }

    public function seenBy(Request $request, InternalConversation $conversation, InternalMessage $message): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->isManager(), 403);
        abort_unless($conversation->isParticipant($user), 403);
        abort_if($message->internal_conversation_id !== $conversation->id, 404);

        return response()->json($this->chat->seenBy($message));
    }

    public function typing(Request $request, InternalConversation $conversation): JsonResponse
    {
        abort_unless($conversation->isParticipant($request->user()), 403);

        $data = $request->validate(['typing' => 'required|boolean']);

        $key = sprintf(
            'internal-chat-typing:%d:%d',
            $request->user()->id,
            $conversation->id,
        );

        if (RateLimiter::tooManyAttempts($key, 40)) {
            return response()->json(['ok' => true]);
        }

        RateLimiter::hit($key, 60);

        InternalConversationTyping::dispatch(
            $conversation,
            $request->user(),
            $data['typing'],
        );

        return response()->json(['ok' => true]);
    }
}