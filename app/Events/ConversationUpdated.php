<?php

namespace App\Events;

use App\Models\Conversation;
use App\Services\Conversation\ConversationSlaService;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ConversationUpdated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public Conversation $conversation)
    {
    }

    /**
     * @return array<int, PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('conversations'),
            new PrivateChannel('conversation.' . $this->conversation->id),
        ];
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
        $sla = app(ConversationSlaService::class)->evaluate($this->conversation);

        return [
            'conversation' => [
                'id' => $this->conversation->id,
                'status' => $this->conversation->status,
                'assigned_user_id' => $this->conversation->assigned_user_id,
                'last_message_at' => $this->conversation->last_message_at?->toIso8601String(),
                'snoozed_until' => $this->conversation->snoozed_until?->toIso8601String(),
                'snooze_note' => $this->conversation->snooze_note,
                'snooze_wake_reason' => $this->conversation->snoozeWakeReason,
                'sla' => $sla,
            ],
        ];
    }
}
