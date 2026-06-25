<?php

namespace App\Services\Telegram;

use App\Contracts\MessagingChannel;
use App\Models\Channel;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class TelegramService implements MessagingChannel
{
    private string $botToken;
    private ?string $lastErrorMessage = null;

    public function __construct(Channel $channel)
    {
        $this->botToken = (string) ($channel->config['bot_token'] ?? '');
    }

    public function isConfigured(): bool
    {
        return $this->botToken !== '';
    }

    public function getLastErrorMessage(): ?string
    {
        return $this->lastErrorMessage;
    }

    public function sendText(string $to, string $body): ?string
    {
        return $this->callApi('sendMessage', [
            'chat_id'    => $to,
            'text'       => $body,
            'parse_mode' => 'Markdown',
        ]);
    }

    /**
     * @param  array<int, array{id: string, title: string}>  $buttons
     */
    public function sendButtons(string $to, string $body, array $buttons, ?string $header = null): ?string
    {
        $text = $header ? "*{$header}*\n{$body}" : $body;

        $keyboard = array_map(
            fn ($b) => [['text' => mb_substr((string) $b['title'], 0, 64), 'callback_data' => (string) $b['id']]],
            array_slice($buttons, 0, 10),
        );

        return $this->callApi('sendMessage', [
            'chat_id'      => $to,
            'text'         => $text,
            'parse_mode'   => 'Markdown',
            'reply_markup' => ['inline_keyboard' => $keyboard],
        ]);
    }

    /**
     * @param  array<int, array{id: string, title: string, description?: string}>  $rows
     */
    public function sendList(string $to, string $body, string $buttonText, array $rows, ?string $sectionTitle = null): ?string
    {
        // Telegram não tem lista nativa — usa inline keyboard (1 botão por linha)
        $keyboard = array_map(
            fn ($r) => [['text' => mb_substr((string) $r['title'], 0, 64), 'callback_data' => (string) $r['id']]],
            array_slice($rows, 0, 10),
        );

        return $this->callApi('sendMessage', [
            'chat_id'      => $to,
            'text'         => $body,
            'parse_mode'   => 'Markdown',
            'reply_markup' => ['inline_keyboard' => $keyboard],
        ]);
    }

    public function sendFile(string $to, UploadedFile $file, string $type, ?string $caption = null, ?string $filename = null, ?string $forcedMimeType = null): ?string
    {
        $this->lastErrorMessage = null;

        if (! $this->isConfigured()) {
            $this->lastErrorMessage = 'Bot Token não configurado.';
            return null;
        }

        $method = match ($type) {
            'image'    => 'sendPhoto',
            'audio'    => 'sendAudio',
            'video'    => 'sendVideo',
            default    => 'sendDocument',
        };

        $field = match ($type) {
            'image'    => 'photo',
            'audio'    => 'audio',
            'video'    => 'video',
            default    => 'document',
        };

        $originalName = $filename ?? $file->getClientOriginalName();
        $mimeType     = $forcedMimeType ?? $file->getMimeType() ?? 'application/octet-stream';
        $params       = ['chat_id' => $to];

        if ($caption !== null && $caption !== '') {
            $params['caption'] = $caption;
        }

        try {
            $content  = file_get_contents($file->getRealPath());
            $response = Http::acceptJson()
                ->timeout(60)
                ->attach($field, $content, $originalName, ['Content-Type' => $mimeType])
                ->post($this->apiUrl($method), $params);
        } catch (\Throwable $e) {
            $this->lastErrorMessage = 'Falha ao enviar arquivo para o Telegram.';
            Log::error('Telegram sendFile error', ['method' => $method, 'error' => $e->getMessage()]);
            return null;
        }

        $body = $response->json();

        if (! $response->successful() || ! ($body['ok'] ?? false)) {
            $this->lastErrorMessage = $body['description'] ?? 'Erro ao enviar arquivo.';
            Log::error('Telegram sendFile API error', ['method' => $method, 'status' => $response->status(), 'body' => $body]);
            return null;
        }

        $result = $body['result'] ?? null;
        if (is_array($result) && isset($result['message_id'])) {
            return (string) $result['message_id'];
        }

        return 'ok';
    }

    public function supportsMediaFetch(): bool
    {
        return false;
    }

    /**
     * Busca um arquivo do Telegram via file_id.
     *
     * @return array{content: string, mime_type: string, filename: string}|null
     */
    public function fetchMedia(string $fileId): ?array
    {
        if (! $this->isConfigured()) {
            return null;
        }

        try {
            $fileInfo = Http::acceptJson()
                ->timeout(15)
                ->get($this->apiUrl('getFile'), ['file_id' => $fileId]);
        } catch (\Throwable) {
            return null;
        }

        $filePath = $fileInfo->json('result.file_path');
        if (! is_string($filePath) || $filePath === '') {
            return null;
        }

        try {
            $download = Http::timeout(60)
                ->get("https://api.telegram.org/file/bot{$this->botToken}/{$filePath}");
        } catch (\Throwable) {
            return null;
        }

        if (! $download->successful()) {
            return null;
        }

        return [
            'content'   => $download->body(),
            'mime_type' => $download->header('Content-Type') ?? 'application/octet-stream',
            'filename'  => basename($filePath),
        ];
    }

    public function sendChatAction(string $chatId, string $action = 'typing'): void
    {
        $this->callApi('sendChatAction', [
            'chat_id' => $chatId,
            'action'  => $action,
        ]);
    }

    public function markAsRead(string $messageId): bool
    {
        // Telegram não tem leitura confirmada para mensagens normais.
        // callback_query é respondido separadamente via answerCallbackQuery.
        return true;
    }

    public function answerCallbackQuery(string $callbackQueryId, string $text = ''): bool
    {
        $result = $this->callApi('answerCallbackQuery', [
            'callback_query_id' => $callbackQueryId,
            'text'              => $text,
        ]);

        return $result !== null;
    }

    /**
     * Registra o webhook do bot no Telegram.
     */
    public function setWebhook(string $url, ?string $secretToken = null): bool
    {
        $params = ['url' => $url];
        if ($secretToken) {
            $params['secret_token'] = $secretToken;
        }

        $result = $this->callApi('setWebhook', $params);

        return $result !== null;
    }

    public function deleteWebhook(): bool
    {
        $result = $this->callApi('deleteWebhook', []);

        return $result !== null;
    }

    /**
     * Verifica conexão com getMe.
     *
     * @return array{status: string, title: string, message: string, details: array<string, mixed>}
     */
    public function healthCheck(): array
    {
        $this->lastErrorMessage = null;

        if (! $this->isConfigured()) {
            return [
                'status'  => 'error',
                'title'   => 'Telegram não configurado',
                'message' => 'Informe o Bot Token antes de testar a conexão.',
                'details' => [],
            ];
        }

        try {
            $response = Http::acceptJson()
                ->timeout(15)
                ->get($this->apiUrl('getMe'));
        } catch (\Throwable $e) {
            return [
                'status'  => 'error',
                'title'   => 'Falha ao conectar com o Telegram',
                'message' => 'Não foi possível alcançar a API do Telegram. Verifique a rede e tente novamente.',
                'details' => [],
            ];
        }

        $body = $response->json();

        if ($response->successful() && ($body['ok'] ?? false)) {
            $bot = $body['result'] ?? [];

            return [
                'status'  => 'ok',
                'title'   => 'Conexão ativa',
                'message' => 'O Telegram aceitou o token e retornou os dados do bot.',
                'details' => [
                    'bot_id'    => $bot['id'] ?? null,
                    'username'  => '@' . ($bot['username'] ?? ''),
                    'bot_name'  => $bot['first_name'] ?? null,
                ],
            ];
        }

        $errorDesc = $body['description'] ?? 'Token inválido ou expirado.';

        return [
            'status'  => 'error',
            'title'   => 'Falha no teste de conexão',
            'message' => $errorDesc,
            'details' => ['http_status' => $response->status()],
        ];
    }

    /**
     * Executa uma chamada à Bot API e retorna o message_id (string) do resultado, ou null em erro.
     *
     * @param  array<string, mixed>  $params
     */
    private function callApi(string $method, array $params): ?string
    {
        $this->lastErrorMessage = null;

        if (! $this->isConfigured()) {
            $this->lastErrorMessage = 'Bot Token não configurado.';

            return null;
        }

        try {
            $response = Http::acceptJson()
                ->timeout(15)
                ->post($this->apiUrl($method), $params);
        } catch (\Throwable $e) {
            $this->lastErrorMessage = 'Falha ao conectar com a API do Telegram.';
            Log::error('Telegram API connection error', ['method' => $method, 'error' => $e->getMessage()]);

            return null;
        }

        $body = $response->json();

        if (! $response->successful() || ! ($body['ok'] ?? false)) {
            $this->lastErrorMessage = $body['description'] ?? 'Erro desconhecido na API do Telegram.';
            Log::error('Telegram API error', [
                'method' => $method,
                'status' => $response->status(),
                'body'   => $body,
            ]);

            return null;
        }

        // Para sendMessage/sendButtons/sendList: retorna o message_id como string
        $result = $body['result'] ?? null;
        if (is_array($result) && isset($result['message_id'])) {
            return (string) $result['message_id'];
        }

        // Para outros métodos (setWebhook, answerCallbackQuery): retorna 'ok'
        return 'ok';
    }

    private function apiUrl(string $method): string
    {
        return "https://api.telegram.org/bot{$this->botToken}/{$method}";
    }
}
