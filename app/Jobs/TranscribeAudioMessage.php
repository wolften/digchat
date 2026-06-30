<?php

namespace App\Jobs;

use App\Events\ConversationUpdated;
use App\Models\Channel;
use App\Models\Message;
use App\Services\Telegram\TelegramService;
use App\Services\Transcription\GroqTranscriptionService;
use App\Services\WhatsApp\WhatsAppService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class TranscribeAudioMessage implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;
    public int $timeout = 120;

    public function __construct(
        public readonly int $messageId,
        public readonly ?int $channelId = null,
    ) {}

    public function handle(GroqTranscriptionService $groq): void
    {
        if (! $groq->isConfigured()) {
            return;
        }

        $message = Message::find($this->messageId);
        if (! $message || $message->type !== 'audio') {
            return;
        }

        $channel = $this->channelId ? Channel::find($this->channelId) : null;

        $media = $channel?->type === 'telegram'
            ? $this->fetchTelegram($message, $channel)
            : $this->fetchWhatsApp($message, $channel);

        if (! $media) {
            return;
        }

        $mimeType = $media['mime_type'];
        $filename = sprintf('audio-%d.%s', $this->messageId, $this->extensionFromMime($mimeType));

        $transcription = $groq->transcribe($media['content'], $mimeType, $filename);
        if (! $transcription) {
            return;
        }

        $message->forceFill(['transcription' => $transcription])->save();

        if ($message->conversation) {
            ConversationUpdated::dispatch($message->conversation);
        }
    }

    /** @return array{content: string, mime_type: string, filename: ?string}|null */
    private function fetchWhatsApp(Message $message, ?Channel $channel): ?array
    {
        $mediaId = data_get($message->payload, 'audio.id');
        if (! $mediaId) {
            Log::warning('TranscribeAudio: no audio.id in WhatsApp payload', ['message_id' => $this->messageId]);
            return null;
        }

        $service = new WhatsAppService($channel);
        $media   = $service->fetchMedia((string) $mediaId);

        if (! $media) {
            Log::warning('TranscribeAudio: WhatsApp fetchMedia failed', [
                'message_id' => $this->messageId,
                'error'      => $service->getLastErrorMessage(),
            ]);
        }

        return $media;
    }

    /** @return array{content: string, mime_type: string, filename: ?string}|null */
    private function fetchTelegram(Message $message, Channel $channel): ?array
    {
        // Telegram sends audio as 'audio' or voice messages as 'voice'
        $fileId = data_get($message->payload, 'audio.file_id')
               ?? data_get($message->payload, 'voice.file_id');

        if (! $fileId) {
            Log::warning('TranscribeAudio: no file_id in Telegram payload', ['message_id' => $this->messageId]);
            return null;
        }

        $service = new TelegramService($channel);
        $media   = $service->fetchMedia((string) $fileId);

        if (! $media) {
            Log::warning('TranscribeAudio: Telegram fetchMedia failed', ['message_id' => $this->messageId]);
        }

        return $media;
    }

    private function extensionFromMime(string $mimeType): string
    {
        return match (true) {
            str_contains($mimeType, 'ogg')  => 'ogg',
            str_contains($mimeType, 'webm') => 'webm',
            str_contains($mimeType, 'mp4') || str_contains($mimeType, 'm4a') => 'm4a',
            str_contains($mimeType, 'mpeg') || str_contains($mimeType, 'mp3') => 'mp3',
            str_contains($mimeType, 'wav')  => 'wav',
            default                          => 'ogg',
        };
    }
}
