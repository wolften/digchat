<?php

namespace App\Events;

use App\Models\InternalMessage;
use App\Services\InternalChat\InternalChatService;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class InternalMessageCreated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public InternalMessage $message) {}

    /**
     * @return array<int, PrivateChannel>
     */
    public function broadcastOn(): array
    {
        $channels = [
            new PrivateChannel('internal-conversation.'.$this->message->internal_conversation_id),
            new PrivateChannel('internal-conversations'),
        ];

        $service = app(InternalChatService::class);
        $sender = $this->message->user;

        if ($sender) {
            foreach ($service->recipientsFor($this->message, $sender) as $recipient) {
                $channels[] = new PrivateChannel('user.'.$recipient->id);
            }
        }

        return $channels;
    }

    public function broadcastAs(): string
    {
        return 'message.created';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        $conversation = $this->message->conversation;

        return [
            'message' => [
                'id' => $this->message->id,
                'internal_conversation_id' => $this->message->internal_conversation_id,
                'body' => $this->message->body,
                'user_id' => $this->message->user_id,
                'user_name' => $this->message->user?->name,
                'created_at' => $this->message->created_at->toIso8601String(),
            ],
            'conversation' => [
                'id' => $conversation?->id,
                'type' => $conversation?->type,
                'last_message_at' => $conversation?->last_message_at?->toIso8601String(),
            ],
        ];
    }
}