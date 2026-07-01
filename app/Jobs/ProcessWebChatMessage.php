<?php

namespace App\Jobs;

use App\Events\ConversationUpdated;
use App\Models\Channel;
use App\Models\Contact;
use App\Models\Conversation;
use App\Models\Flow;
use App\Models\Message;
use App\Services\Conversation\ConversationSnoozeService;
use App\Services\Flow\FlowEngine;
use App\Services\OutOfHoursGate;
use App\Services\Survey\SurveyRunner;
use App\Services\WebChat\WebChatService;
use App\Services\WhatsApp\MessageSender;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class ProcessWebChatMessage implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        public readonly int $contactId,
        public readonly int $channelId,
        public readonly string $text,
        public readonly ?string $buttonId = null,
        public readonly ?string $buttonTitle = null,
    ) {}

    public function handle(): void
    {
        $channel = Channel::find($this->channelId);
        if (! $channel) {
            return;
        }

        $contact = Contact::find($this->contactId);
        if (! $contact) {
            return;
        }

        $webchat      = new WebChatService($channel);
        $conversation = $this->resolveConversation($contact, $channel);

        $isButton = $this->buttonId !== null;
        $type     = $isButton ? 'interactive' : 'text';
        $body     = $isButton ? ($this->buttonTitle ?? $this->buttonId) : $this->text;

        // Skip duplicate messages (can happen on double-click / retry)
        if ($body !== '' || ! $isButton) {
            $payload = $isButton ? [
                'interactive' => [
                    'button_reply' => [
                        'id'    => $this->buttonId,
                        'title' => $this->buttonTitle ?? $this->buttonId,
                    ],
                ],
            ] : null;

            $message = $conversation->messages()->create([
                'direction'     => Message::DIRECTION_IN,
                'type'          => $type,
                'body'          => $body,
                'wa_message_id' => 'web_in_' . uniqid(),
                'payload'       => $payload,
            ]);

            $conversation->forceFill(['last_message_at' => now()])->save();
            $conversation = app(ConversationSnoozeService::class)->wakeOnInboundIfNeeded($conversation);
            $this->markPreviousOutboundMessagesAsRead($conversation, $message);
        }

        $rawMessage = $isButton ? [
            'interactive' => [
                'button_reply' => [
                    'id'    => $this->buttonId,
                    'title' => $this->buttonTitle ?? $this->buttonId,
                ],
            ],
        ] : [
            'text' => ['body' => $this->text],
        ];

        $inputValue = $isButton ? $this->buttonId : $this->text;

        if ($conversation->status === Conversation::STATUS_SURVEYING) {
            (new SurveyRunner(new MessageSender($webchat)))->handle($conversation, $inputValue, $rawMessage);
        } elseif ($conversation->status === Conversation::STATUS_BOT) {
            if ((new OutOfHoursGate())->blocksBotFlow($conversation, $webchat)) {
                return;
            }
            (new FlowEngine($webchat))->run($conversation, $inputValue, $rawMessage);
        }
    }

    private function markPreviousOutboundMessagesAsRead(Conversation $conversation, Message $inboundMessage): void
    {
        $updated = $conversation->messages()
            ->where('direction', Message::DIRECTION_OUT)
            ->where('id', '<', $inboundMessage->id)
            ->whereIn('status', ['sent', 'accepted', 'delivered'])
            ->update(['status' => 'read']);

        if ($updated > 0) {
            ConversationUpdated::dispatch($conversation);
        }
    }

    private function resolveConversation(Contact $contact, Channel $channel): Conversation
    {
        $surveying = $contact->conversations()
            ->where('status', Conversation::STATUS_SURVEYING)
            ->orderByDesc('last_message_at')
            ->first();

        if ($surveying) {
            return $surveying;
        }

        $conversation = $contact->conversations()
            ->session()
            ->orderByDesc('last_message_at')
            ->first();

        if (! $conversation) {
            $defaultFlow = Flow::defaultFlow();

            return $contact->conversations()->create([
                'channel_id'      => $channel->id,
                'status'          => $defaultFlow ? Conversation::STATUS_BOT : Conversation::STATUS_QUEUED,
                'flow_id'         => $defaultFlow?->id,
                'last_message_at' => now(),
            ]);
        }

        $conversation->closeSiblingActiveConversations();

        return $conversation;
    }
}
