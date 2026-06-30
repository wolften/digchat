<?php

namespace App\Services\WhatsApp;

use App\Contracts\MessagingChannel;
use App\Models\Channel;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
use App\Services\Telegram\TelegramService;
use App\Services\WebChat\WebChatService;
use App\Services\WhatsApp\WhatsAppService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

class MessageSender
{
    public function __construct(private MessagingChannel $whatsApp)
    {
    }

    public static function forConversation(Conversation $conversation): self
    {
        $conversation->loadMissing('channel');
        $channel = $conversation->channel;

        $service = match ($channel?->type) {
            Channel::TYPE_TELEGRAM => new TelegramService($channel),
            Channel::TYPE_WEB      => new WebChatService($channel),
            Channel::TYPE_WHATSAPP => new WhatsAppService($channel),
            default                => new WhatsAppService(),
        };

        return new self($service);
    }

    public function lastErrorMessage(): ?string
    {
        return $this->whatsApp->getLastErrorMessage();
    }

    /**
     * Send a plain text message to the conversation's contact and persist it.
     */
    public function sendText(Conversation $conversation, string $body, ?User $sender = null): Message
    {
        $bodyForWhatsApp = $this->formatAttendantBody($body, $sender);
        $waMessageId = $this->whatsApp->sendText($conversation->contact->wa_id, $bodyForWhatsApp);

        return $this->record($conversation, 'text', $body, $waMessageId, $sender);
    }

    /**
     * Send reply buttons and persist the outbound message.
     *
     * @param  array<int, array{id: string, title: string}>  $buttons
     */
    public function sendButtons(Conversation $conversation, string $body, array $buttons, ?string $header = null): Message
    {
        $waMessageId = $this->whatsApp->sendButtons($conversation->contact->wa_id, $body, $buttons, $header);

        return $this->record($conversation, 'interactive', $body, $waMessageId, null, ['buttons' => $buttons]);
    }

    /**
     * Send a list message and persist the outbound message.
     *
     * @param  array<int, array{id: string, title: string, description?: string}>  $rows
     */
    public function sendList(Conversation $conversation, string $body, string $buttonText, array $rows, ?string $sectionTitle = null): Message
    {
        $waMessageId = $this->whatsApp->sendList($conversation->contact->wa_id, $body, $buttonText, $rows, $sectionTitle);

        return $this->record($conversation, 'interactive', $body, $waMessageId, null, ['rows' => $rows]);
    }

    /**
     * Send inline buttons arranged in a grid (Telegram) or fall back to reply buttons.
     *
     * @param  array<int, array{id: string, title: string}>  $buttons
     */
    public function sendButtonGrid(Conversation $conversation, string $body, array $buttons, int $columns = 3, ?string $header = null): Message
    {
        $waMessageId = method_exists($this->whatsApp, 'sendButtonGrid')
            ? $this->whatsApp->sendButtonGrid($conversation->contact->wa_id, $body, $buttons, $columns, $header)
            : $this->whatsApp->sendButtons($conversation->contact->wa_id, $body, $buttons, $header);

        return $this->record($conversation, 'interactive', $body, $waMessageId, null, ['buttons' => $buttons]);
    }

    /**
     * Send an uploaded attachment (image/video/document/audio) and persist it.
     */
    public function sendAttachment(
        Conversation $conversation,
        UploadedFile $file,
        ?string $caption = null,
        ?User $sender = null,
    ): Message {
        $type               = $this->detectMediaType($file);
        $captionForChannel  = $caption !== null ? $this->formatAttendantBody($caption, $sender) : null;

        $waMessageId = $this->whatsApp->sendFile(
            $conversation->contact->wa_id,
            $file,
            $type,
            $captionForChannel,
            $type === 'document' ? $file->getClientOriginalName() : null,
        );

        $outboundMeta = [
            'mime_type' => $file->getMimeType(),
            'filename'  => $file->getClientOriginalName(),
        ];

        if (! $this->whatsApp->supportsMediaFetch()) {
            $outboundMeta['local_path'] = Storage::putFile('channel-media', $file);
        }

        return $this->record(
            $conversation,
            $type,
            $caption ?: sprintf('[%s]', $type),
            $waMessageId,
            $sender,
            ['outbound_media' => $outboundMeta],
        );
    }

    /**
     * Send a recorded/uploaded audio file and persist it as audio.
     */
    public function sendAudio(Conversation $conversation, UploadedFile $audio, ?User $sender = null): Message
    {
        $clientMime = strtolower((string) $audio->getClientMimeType());
        $serverMime = strtolower((string) $audio->getMimeType());
        $extension = strtolower((string) $audio->getClientOriginalExtension());

        // Gravações de navegador podem chegar como video/webm (áudio Opus dentro de WebM).
        // Forçamos MIME aceito pela Cloud API para o endpoint de áudio.
        $forcedMimeType = (
            str_starts_with($clientMime, 'video/webm') ||
            str_starts_with($serverMime, 'video/webm') ||
            $extension === 'webm'
        ) ? 'audio/opus' : null;

        $waMessageId = $this->whatsApp->sendFile(
            $conversation->contact->wa_id,
            $audio,
            'audio',
            null,
            null,
            $forcedMimeType,
        );

        $outboundMeta = [
            'mime_type' => $audio->getMimeType(),
            'filename'  => $audio->getClientOriginalName(),
        ];

        if (! $this->whatsApp->supportsMediaFetch()) {
            $outboundMeta['local_path'] = Storage::putFile('channel-media', $audio);
        }

        return $this->record(
            $conversation,
            'audio',
            '[audio]',
            $waMessageId,
            $sender,
            ['outbound_media' => $outboundMeta],
        );
    }

    /**
     * Persist an outbound message row and bump the conversation timestamp.
     *
     * @param  array<string, mixed>|null  $payload
     */
    private function record(
        Conversation $conversation,
        string $type,
        ?string $body,
        ?string $waMessageId,
        ?User $sender = null,
        ?array $payload = null,
    ): Message {
        if ($waMessageId !== null && Message::query()->where('wa_message_id', $waMessageId)->exists()) {
            $waMessageId = null;
        }

        $message = $conversation->messages()->create([
            'direction' => Message::DIRECTION_OUT,
            'type' => $type,
            'body' => $body,
            'wa_message_id' => $waMessageId,
            'status' => $waMessageId ? 'sent' : 'failed',
            'sender_user_id' => $sender?->id,
            'payload' => $payload,
        ]);

        $conversation->forceFill(['last_message_at' => now()])->save();

        return $message;
    }

    private function detectMediaType(UploadedFile $file): string
    {
        $clientMime = strtolower((string) $file->getClientMimeType());
        $serverMime = strtolower((string) $file->getMimeType());
        $extension = strtolower((string) $file->getClientOriginalExtension());

        $audioExtensions = ['aac', 'amr', 'mp3', 'm4a', 'mp4', 'ogg', 'oga', 'opus', 'wav', 'webm'];

        if (str_starts_with($clientMime, 'audio/')) {
            return 'audio';
        }

        if (str_starts_with($serverMime, 'audio/')) {
            return 'audio';
        }

        if (in_array($extension, $audioExtensions, true) && str_contains($clientMime, 'audio')) {
            return 'audio';
        }

        if (str_starts_with($clientMime, 'image/') || str_starts_with($serverMime, 'image/')) {
            return 'image';
        }

        if (str_starts_with($clientMime, 'video/') || str_starts_with($serverMime, 'video/')) {
            return 'video';
        }

        return 'document';
    }

    private function formatAttendantBody(string $body, ?User $sender): string
    {
        if (! $sender) {
            return $body;
        }

        return sprintf('*%s:*'."\n".'%s', $sender->name, $body);
    }
}
