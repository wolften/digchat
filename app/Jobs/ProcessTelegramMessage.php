<?php

namespace App\Jobs;

use App\Events\ConversationUpdated;
use App\Jobs\TranscribeAudioMessage;
use App\Models\AppSetting;
use App\Models\Channel;
use App\Models\Contact;
use App\Models\Conversation;
use App\Models\Flow;
use App\Models\Message;
use App\Services\Flow\FlowEngine;
use App\Services\OutOfHoursGate;
use App\Services\Survey\SurveyRunner;
use App\Services\Telegram\TelegramService;
use App\Services\WhatsApp\MessageSender;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Carbon;

class ProcessTelegramMessage implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        public readonly array $payload,
        public readonly int $channelId,
    ) {}

    public function handle(): void
    {
        $channel = Channel::find($this->channelId);
        if (! $channel) {
            return;
        }

        $telegram = new TelegramService($channel);

        if (isset($this->payload['message'])) {
            $this->handleMessage($this->payload['message'], $channel, $telegram);
        } elseif (isset($this->payload['callback_query'])) {
            $this->handleCallbackQuery($this->payload['callback_query'], $channel, $telegram);
        }
    }

    private function handleMessage(array $msg, Channel $channel, TelegramService $telegram): void
    {
        $chatId    = (string) ($msg['chat']['id'] ?? null);
        $messageId = (string) ($msg['message_id'] ?? null);

        if (! $chatId || ! $messageId) {
            return;
        }

        if (Message::where('wa_message_id', "tg_{$messageId}")->exists()) {
            return;
        }

        $profileName = trim(
            ($msg['from']['first_name'] ?? '') . ' ' . ($msg['from']['last_name'] ?? '')
        ) ?: ($msg['from']['username'] ?? null);

        $contact = $this->resolveContact($chatId, $profileName, $channel, $telegram);
        $conversation = $this->resolveConversation($contact, $channel);

        [$type, $body] = $this->extractContent($msg);

        $waTimestamp = isset($msg['date'])
            ? Carbon::createFromTimestamp($msg['date'])
            : now();

        $message = $conversation->messages()->create([
            'direction'     => Message::DIRECTION_IN,
            'type'          => $type,
            'body'          => $body,
            'wa_message_id' => "tg_{$messageId}",
            'payload'       => $msg,
            'created_at'    => $waTimestamp,
            'updated_at'    => $waTimestamp,
        ]);

        if ($type === 'audio' && AppSetting::bool('auto_transcribe_audio', true)) {
            TranscribeAudioMessage::dispatch($message->id, $this->channelId);
        }

        $conversation->forceFill(['last_message_at' => now()])->save();

        $this->markPreviousOutboundMessagesAsRead($conversation, $message);

        $rawMessage = ['text' => ['body' => $body]];

        if ($conversation->status === Conversation::STATUS_SURVEYING) {
            $telegram->sendChatAction($chatId);
            (new SurveyRunner(new MessageSender($telegram)))->handle($conversation, $body, $rawMessage);
        } elseif ($conversation->status === Conversation::STATUS_BOT) {
            if ((new OutOfHoursGate())->blocksBotFlow($conversation, $telegram)) {
                return;
            }
            $telegram->sendChatAction($chatId);
            (new FlowEngine($telegram))->run($conversation, $body, $rawMessage);
        }
    }

    private function handleCallbackQuery(array $cbq, Channel $channel, TelegramService $telegram): void
    {
        $chatId    = (string) ($cbq['message']['chat']['id'] ?? $cbq['from']['id'] ?? null);
        $queryId   = $cbq['id'] ?? null;
        $data      = $cbq['data'] ?? null;

        if (! $chatId || ! $data) {
            if ($queryId) {
                $telegram->answerCallbackQuery($queryId);
            }
            return;
        }

        // Gera um ID único para a entrada da mensagem (callback query não tem message_id próprio)
        $fakeMessageId = "tgcb_{$queryId}";

        if (Message::where('wa_message_id', $fakeMessageId)->exists()) {
            $telegram->answerCallbackQuery($queryId ?? '');
            return;
        }

        $profileName = ($cbq['from']['first_name'] ?? '') . ' ' . ($cbq['from']['last_name'] ?? '');
        $profileName = trim($profileName) ?: ($cbq['from']['username'] ?? null);

        // Recupera o rótulo visível do botão clicado a partir do inline_keyboard da mensagem original
        $buttonTitle = $data;
        foreach ($cbq['message']['reply_markup']['inline_keyboard'] ?? [] as $row) {
            foreach ($row as $btn) {
                if (($btn['callback_data'] ?? null) === $data) {
                    $buttonTitle = $btn['text'];
                    break 2;
                }
            }
        }

        $contact = $this->resolveContact($chatId, $profileName ?: null, $channel, $telegram);
        $conversation = $this->resolveConversation($contact, $channel);

        $message = $conversation->messages()->create([
            'direction'     => Message::DIRECTION_IN,
            'type'          => 'interactive',
            'body'          => $buttonTitle,
            'wa_message_id' => $fakeMessageId,
            'payload'       => $cbq,
        ]);

        $conversation->forceFill(['last_message_at' => now()])->save();

        $this->markPreviousOutboundMessagesAsRead($conversation, $message);

        $telegram->answerCallbackQuery($queryId ?? '');

        // Normaliza o callback_query para o formato que FlowEngine e SurveyRunner esperam
        $rawMessage = [
            'interactive' => [
                'button_reply' => [
                    'id'    => $data,        // ID interno — FlowEngine faz match por este campo
                    'title' => $buttonTitle, // Label visível — exibição no inbox
                ],
            ],
        ];

        if ($conversation->status === Conversation::STATUS_SURVEYING) {
            $telegram->sendChatAction($chatId);
            (new SurveyRunner(new MessageSender($telegram)))->handle($conversation, $data, $rawMessage);
        } elseif ($conversation->status === Conversation::STATUS_BOT) {
            if ((new OutOfHoursGate())->blocksBotFlow($conversation, $telegram)) {
                return;
            }
            $telegram->sendChatAction($chatId);
            (new FlowEngine($telegram))->run($conversation, $data, $rawMessage);
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

    private function resolveContact(string $chatId, ?string $profileName, Channel $channel, TelegramService $telegram): Contact
    {
        $contact = Contact::firstOrNew(['wa_id' => $chatId, 'channel_id' => $channel->id]);

        if ($profileName && ! $contact->profile_name) {
            $contact->profile_name = $profileName;
        }

        if (! data_get($contact->meta, 'avatar_url')) {
            $photoUrl = $telegram->getProfilePhotoUrl($chatId);
            if ($photoUrl) {
                $contact->meta = array_merge($contact->meta ?? [], ['avatar_url' => $photoUrl]);
            }
        }

        $contact->last_message_at = now();
        $contact->channel_id = $channel->id;
        $contact->save();

        return $contact;
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
            ->active()
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

    /**
     * @return array{0: string, 1: ?string}
     */
    private function extractContent(array $msg): array
    {
        if (isset($msg['text'])) {
            return ['text', $msg['text']];
        }
        if (isset($msg['photo'])) {
            return ['image', $msg['caption'] ?? '[imagem]'];
        }
        if (isset($msg['video'])) {
            return ['video', $msg['caption'] ?? '[vídeo]'];
        }
        if (isset($msg['audio']) || isset($msg['voice'])) {
            return ['audio', '[áudio]'];
        }
        if (isset($msg['document'])) {
            return ['document', $msg['caption'] ?? '[documento]'];
        }
        if (isset($msg['sticker'])) {
            return ['sticker', '[sticker]'];
        }
        if (isset($msg['location'])) {
            return ['location', '[localização]'];
        }

        return ['unknown', null];
    }
}
