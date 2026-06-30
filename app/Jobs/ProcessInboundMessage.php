<?php

namespace App\Jobs;

use App\Events\ConversationUpdated;
use App\Jobs\FetchContactAvatar;
use App\Jobs\TranscribeAudioMessage;
use App\Models\Channel;
use App\Models\Contact;
use App\Models\Conversation;
use App\Models\Flow;
use App\Models\Message;
use App\Models\AppSetting;
use App\Services\BusinessHoursService;
use App\Services\Flow\FlowEngine;
use App\Services\Survey\SurveyRunner;
use App\Services\WhatsApp\MessageSender;
use App\Services\WhatsApp\WhatsAppService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Carbon;

class ProcessInboundMessage implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * @param  array<string, mixed>  $payload    Raw WhatsApp webhook payload.
     * @param  int|null              $channelId  Canal de origem (null → fallback para AppSetting).
     */
    public function __construct(
        public readonly array $payload,
        public readonly ?int $channelId = null,
    ) {}

    public function handle(): void
    {
        $channel = $this->channelId ? Channel::find($this->channelId) : null;
        $whatsApp = new WhatsAppService($channel);

        foreach ($this->payload['entry'] ?? [] as $entry) {
            foreach ($entry['changes'] ?? [] as $change) {
                $value = $change['value'] ?? [];

                $profileNames   = $this->profileNames($value);
                $profileAvatars = $this->profileAvatars($value);

                foreach ($value['messages'] ?? [] as $waMessage) {
                    $this->handleInboundMessage($waMessage, $profileNames, $profileAvatars, $whatsApp, $channel);
                }

                foreach ($value['statuses'] ?? [] as $status) {
                    $this->handleStatus($status);
                }
            }
        }
    }

    /**
     * @param  array<string, mixed>  $waMessage
     * @param  array<string, string>  $profileNames
     * @param  array<string, string>  $profileAvatars
     */
    private function handleInboundMessage(
        array $waMessage,
        array $profileNames,
        array $profileAvatars,
        WhatsAppService $whatsApp,
        ?Channel $channel,
    ): void
    {
        $waId = $waMessage['from'] ?? null;
        $waMessageId = $waMessage['id'] ?? null;

        if (! $waId || ! $waMessageId) {
            return;
        }

        if (Message::where('wa_message_id', $waMessageId)->exists()) {
            return;
        }

        $contactQuery = ['wa_id' => $waId];
        if ($channel) {
            $contactQuery['channel_id'] = $channel->id;
        }

        $contact = Contact::firstOrNew($contactQuery);
        if (isset($profileNames[$waId])) {
            $contact->profile_name = $profileNames[$waId];
        }
        if ($channel) {
            $contact->channel_id = $channel->id;
        }
        $contact->last_message_at = now();

        // Persist avatar from webhook payload when available and not yet stored.
        $meta = $contact->meta ?? [];
        if (! isset($meta['avatar_url']) && isset($profileAvatars[$waId])) {
            $meta['avatar_url'] = $profileAvatars[$waId];
            $contact->meta = $meta;
        }

        $contact->save();

        // Dispatch a job to fetch avatar via API when none is available and not yet tried.
        // Throttle: skip if a recent auth-error was recorded (retry window: 6 h).
        $failedAt = data_get($meta, 'avatar_fetch_failed_at');
        $recentAuthFailure = $failedAt && Carbon::parse($failedAt)->diffInHours(now()) < 6;
        if (! isset($meta['avatar_url']) && ! isset($meta['avatar_fetch_attempted']) && ! $recentAuthFailure) {
            FetchContactAvatar::dispatch($contact->id);
        }

        $conversation = $this->resolveConversation($contact, $channel);

        [$type, $body] = $this->extractContent($waMessage);

        $waTimestamp = isset($waMessage['timestamp'])
            ? Carbon::createFromTimestamp($waMessage['timestamp'])
            : now();

        $message = $conversation->messages()->create([
            'direction' => Message::DIRECTION_IN,
            'type' => $type,
            'body' => $body,
            'wa_message_id' => $waMessageId,
            'payload' => $waMessage,
            'created_at' => $waTimestamp,
            'updated_at' => $waTimestamp,
        ]);

        if ($type === 'audio') {
            TranscribeAudioMessage::dispatch($message->id, $this->channelId);
        }

        $this->markPreviousOutboundMessagesAsRead($conversation, $message);

        $conversation->last_message_at = now();
        $conversation->save();

        $whatsApp->markAsRead($waMessageId);

        if ($conversation->status === Conversation::STATUS_SURVEYING) {
            (new SurveyRunner(new MessageSender($whatsApp)))->handle($conversation, $body, $waMessage);
        } elseif ($conversation->status === Conversation::STATUS_BOT) {
            $bhs = new BusinessHoursService();
            if (! $bhs->isOpen($conversation->sector_id)) {
                $oohMsg = $bhs->outOfHoursMessage($conversation->sector_id);
                if ($oohMsg) {
                    $lastNotified = $conversation->last_ooh_notified_at;
                    $intervalHours = (int) AppSetting::get('ooh_notify_interval_hours', 4);
                    $shouldNotify  = ! $lastNotified || now()->diffInHours($lastNotified) >= $intervalHours;
                    if ($shouldNotify) {
                        $waMessageId = $whatsApp->sendText($conversation->contact->wa_id, $oohMsg);
                        if ($waMessageId) {
                            $conversation->messages()->create([
                                'direction'     => Message::DIRECTION_OUT,
                                'type'          => 'text',
                                'body'          => $oohMsg,
                                'wa_message_id' => $waMessageId,
                                'status'        => 'sent',
                            ]);
                        }
                        $conversation->update(['last_ooh_notified_at' => now()]);
                    }
                }
                return;
            }
            (new FlowEngine($whatsApp))->run($conversation, $body, $waMessage);
        }
    }

    private function resolveConversation(Contact $contact, ?Channel $channel): Conversation
    {
        $surveying = $contact->conversations()
            ->where('status', Conversation::STATUS_SURVEYING)
            ->orderByDesc('last_message_at')
            ->orderByDesc('id')
            ->first();

        if ($surveying) {
            return $surveying;
        }

        $conversation = $contact->conversations()
            ->active()
            ->orderByDesc('last_message_at')
            ->orderByDesc('id')
            ->first();

        if (! $conversation) {
            $defaultFlow = Flow::defaultFlow();

            return $contact->conversations()->create([
                'channel_id'      => $channel?->id,
                'status'          => $defaultFlow ? Conversation::STATUS_BOT : Conversation::STATUS_QUEUED,
                'flow_id'         => $defaultFlow?->id,
                'last_message_at' => now(),
            ]);
        }

        $conversation->closeSiblingActiveConversations();

        return $conversation;
    }

    /**
     * @param  array<string, mixed>  $status
     */
    private function handleStatus(array $status): void
    {
        $waMessageId = $status['id'] ?? null;
        $state = $status['status'] ?? null;

        if (! $waMessageId || ! $state) {
            return;
        }

        $message = Message::where('wa_message_id', $waMessageId)->first();

        if (! $message || $message->status === $state) {
            return;
        }

        $message->forceFill(['status' => $state])->save();

        if ($message->conversation) {
            ConversationUpdated::dispatch($message->conversation);
        }
    }

    private function markPreviousOutboundMessagesAsRead(Conversation $conversation, Message $inboundMessage): void
    {
        $conversation->messages()
            ->where('direction', Message::DIRECTION_OUT)
            ->where('id', '<', $inboundMessage->id)
            ->whereIn('status', ['sent', 'accepted', 'delivered'])
            ->update(['status' => 'read']);
    }

    /**
     * Extract a normalized [type, body] from a WhatsApp message object.
     *
     * @param  array<string, mixed>  $waMessage
     * @return array{0: string, 1: ?string}
     */
    private function extractContent(array $waMessage): array
    {
        $type = $waMessage['type'] ?? 'unknown';

        return match ($type) {
            'text' => ['text', $waMessage['text']['body'] ?? null],
            'interactive' => ['interactive', $this->interactiveReply($waMessage['interactive'] ?? [])],
            'button' => ['button', $waMessage['button']['text'] ?? null],
            'image', 'video', 'audio', 'document', 'sticker' => [
                $type,
                $waMessage[$type]['caption'] ?? "[{$type}]",
            ],
            'location' => ['location', '[localização]'],
            default => [$type, null],
        };
    }

    /**
     * @param  array<string, mixed>  $interactive
     */
    private function interactiveReply(array $interactive): ?string
    {
        return $interactive['button_reply']['title']
            ?? $interactive['list_reply']['title']
            ?? null;
    }

    /**
     * Map wa_id => profile name from the webhook contacts array.
     *
     * @param  array<string, mixed>  $value
     * @return array<string, string>
     */
    private function profileNames(array $value): array
    {
        $names = [];

        foreach ($value['contacts'] ?? [] as $contact) {
            if (isset($contact['wa_id'])) {
                $names[$contact['wa_id']] = $contact['profile']['name'] ?? null;
            }
        }

        return array_filter($names);
    }

    /**
     * Map wa_id => profile picture URL from the webhook contacts array.
     * The Cloud API may include this field depending on business tier and privacy settings.
     *
     * @param  array<string, mixed>  $value
     * @return array<string, string>
     */
    private function profileAvatars(array $value): array
    {
        $avatars = [];

        foreach ($value['contacts'] ?? [] as $contact) {
            if (! isset($contact['wa_id'])) {
                continue;
            }

            $url = $contact['profile']['profile_picture_url']
                ?? $contact['profile']['avatar']
                ?? null;

            if (is_string($url) && str_starts_with($url, 'http')) {
                $avatars[$contact['wa_id']] = $url;
            }
        }

        return $avatars;
    }
}
