<?php

namespace App\Events;

use App\Models\InternalConversation;
use App\Models\User;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class InternalConversationUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public InternalConversation $conversation,
        public User $viewer,
    ) {}

    /**
     * @return array<int, PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return [new PrivateChannel('internal-conversations')];
    }

    public function broadcastAs(): string
    {
        return 'conversation.updated';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        $lastMessage = $this->conversation->messages()->latest()->with('user:id,name')->first();

        return [
            'conversation' => [
                'id' => $this->conversation->id,
                'type' => $this->conversation->type,
                'last_message' => $lastMessage?->body,
                'last_message_user_name' => $lastMessage?->user?->name,
                'last_message_at' => $this->conversation->last_message_at?->toIso8601String(),
            ],
        ];
    }
}