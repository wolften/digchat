<?php

namespace App\Events;

use App\Models\Message;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class MessageCreated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public Message $message)
    {
    }

    /**
     * @return array<int, PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('conversations'),
            new PrivateChannel('conversation.' . $this->message->conversation_id),
        ];
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
        $this->message->loadMissing('sender:id,name,profile_photo_path');

        $conversation = $this->message->conversation;
        $contact = $conversation?->contact;
        $type = $this->message->type;

        return [
            'message' => [
                'id' => $this->message->id,
                'conversation_id' => $this->message->conversation_id,
                'direction' => $this->message->direction,
                'type' => $type,
                'body' => $this->message->body,
                'media_url' => in_array($type, ['image', 'audio', 'video', 'document'], true)
                    ? route('inbox.messages.media', $this->message)
                    : null,
                'status' => $this->message->status,
                'is_internal' => $this->message->is_internal,
                'sender_user_id' => $this->message->sender_user_id,
                'sender' => $this->message->sender?->publicSummary(),
                'created_at' => $this->message->created_at?->toIso8601String(),
            ],
            'conversation' => [
                'status' => $conversation?->status,
                'assigned_user_id' => $conversation?->assigned_user_id,
            ],
            'contact' => [
                'name' => $contact?->displayName(),
            ],
        ];
    }
}
