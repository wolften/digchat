<?php

namespace App\Services\WebChat;

use App\Contracts\MessagingChannel;
use App\Models\Channel;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;

class WebChatService implements MessagingChannel
{
    public function __construct(private Channel $channel) {}

    public function isConfigured(): bool
    {
        return ! empty($this->channel->config['api_key']);
    }

    public function getLastErrorMessage(): ?string
    {
        return null;
    }

    public function sendText(string $to, string $body): ?string
    {
        return 'web_' . Str::random(16);
    }

    /** @param array<int, array{id: string, title: string}> $buttons */
    public function sendButtons(string $to, string $body, array $buttons, ?string $header = null): ?string
    {
        return 'web_' . Str::random(16);
    }

    /** @param array<int, array{id: string, title: string, description?: string}> $rows */
    public function sendList(string $to, string $body, string $buttonText, array $rows, ?string $sectionTitle = null): ?string
    {
        return 'web_' . Str::random(16);
    }

    public function sendFile(string $to, UploadedFile $file, string $type, ?string $caption = null, ?string $filename = null, ?string $forcedMimeType = null): ?string
    {
        return 'web_' . Str::random(16);
    }

    public function supportsMediaFetch(): bool
    {
        return false;
    }

    public function markAsRead(string $messageId): bool
    {
        return true;
    }

    public function healthCheck(): array
    {
        return [
            'status'  => $this->isConfigured() ? 'ok' : 'error',
            'title'   => $this->isConfigured() ? 'Canal Web ativo' : 'Canal Web sem chave',
            'message' => $this->isConfigured()
                ? 'O canal Web Chat está configurado e pronto para uso.'
                : 'Gere uma chave de API para ativar o canal.',
            'details' => ['api_key_set' => $this->isConfigured()],
        ];
    }
}
