<?php

namespace App\Services\WhatsApp;

use App\Contracts\MessagingChannel;
use App\Models\AppSetting;
use App\Models\Channel;
use Illuminate\Http\UploadedFile;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class WhatsAppService implements MessagingChannel
{
    private string $apiVersion;
    private ?string $phoneNumberId;
    private ?string $accessToken;
    private ?string $lastErrorMessage = null;

    /**
     * @param  Channel|array{api_version?: string|null, phone_number_id?: string|null, access_token?: string|null}|null  $channelOrOverrides
     */
    public function __construct(Channel|array|null $channelOrOverrides = null)
    {
        if ($channelOrOverrides instanceof Channel) {
            $config = $channelOrOverrides->config ?? [];
            $this->apiVersion    = ($config['api_version'] ?? null) ?: 'v21.0';
            $this->phoneNumberId = $config['phone_number_id'] ?? null;
            $this->accessToken   = $config['access_token'] ?? null;

            return;
        }

        $overrides = $channelOrOverrides;
        $this->apiVersion = ($overrides['api_version'] ?? AppSetting::get('whatsapp_api_version'))
            ?: (string) config('services.whatsapp.api_version', 'v21.0');
        $this->phoneNumberId = ($overrides['phone_number_id'] ?? AppSetting::get('whatsapp_phone_number_id'))
            ?: config('services.whatsapp.phone_number_id');
        $this->accessToken = ($overrides['access_token'] ?? AppSetting::get('whatsapp_access_token'))
            ?: config('services.whatsapp.access_token');
    }

    public function isConfigured(): bool
    {
        return ! empty($this->phoneNumberId) && ! empty($this->accessToken);
    }

    public function getLastErrorMessage(): ?string
    {
        return $this->lastErrorMessage;
    }

    /**
     * Test whether the configured token can read the configured phone number.
     *
     * @return array{status: string, title: string, message: string, details: array<string, mixed>}
     */
    public function healthCheck(): array
    {
        $this->lastErrorMessage = null;

        if (! $this->isConfigured()) {
            return [
                'status' => 'error',
                'title' => 'WhatsApp não configurado',
                'message' => 'Informe o Access Token e o Phone Number ID antes de testar a conexão.',
                'details' => [
                    'api_version' => $this->apiVersion,
                    'phone_number_id' => $this->phoneNumberId,
                    'missing' => array_values(array_filter([
                        empty($this->accessToken) ? 'access_token' : null,
                        empty($this->phoneNumberId) ? 'phone_number_id' : null,
                    ])),
                ],
            ];
        }

        try {
            $response = Http::withToken($this->accessToken)
                ->acceptJson()
                ->timeout(15)
                ->get(sprintf(
                    'https://graph.facebook.com/%s/%s',
                    $this->apiVersion,
                    $this->phoneNumberId,
                ), [
                    'fields' => 'id,display_phone_number,verified_name',
                ]);
        } catch (\Throwable $e) {
            Log::warning('WhatsApp health check connection failed', [
                'phone_number_id' => $this->phoneNumberId,
                'error' => $e->getMessage(),
            ]);

            return [
                'status' => 'error',
                'title' => 'Falha ao conectar com a Meta',
                'message' => 'Não foi possível alcançar a Graph API. Verifique a rede do servidor e tente novamente.',
                'details' => [
                    'api_version' => $this->apiVersion,
                    'phone_number_id' => $this->phoneNumberId,
                ],
            ];
        }

        if ($response->successful()) {
            $displayPhone = $response->json('display_phone_number');
            $verifiedName = $response->json('verified_name');

            return [
                'status' => 'ok',
                'title' => 'Conexão ativa',
                'message' => 'A Meta aceitou o token e retornou os dados do número configurado.',
                'details' => [
                    'api_version' => $this->apiVersion,
                    'phone_number_id' => $response->json('id') ?: $this->phoneNumberId,
                    'display_phone_number' => is_string($displayPhone) ? $displayPhone : null,
                    'verified_name' => is_string($verifiedName) ? $verifiedName : null,
                ],
            ];
        }

        $authMessage = $this->authenticationErrorMessage($response);
        if ($authMessage) {
            return [
                'status' => 'error',
                'title' => 'Token inválido ou expirado',
                'message' => $authMessage,
                'details' => $this->responseDiagnosticDetails($response),
            ];
        }

        $message = $this->extractErrorMessage($response)
            ?? 'A Meta recusou o teste de conexão. Verifique Phone Number ID, versão da API e permissões do token.';

        return [
            'status' => 'error',
            'title' => 'Falha no teste de conexão',
            'message' => $message,
            'details' => $this->responseDiagnosticDetails($response),
        ];
    }

    /**
     * Send a plain text message. Returns the WhatsApp message id on success.
     */
    public function sendText(string $to, string $body): ?string
    {
        return $this->send($to, [
            'type' => 'text',
            'text' => ['preview_url' => true, 'body' => $body],
        ]);
    }

    /**
     * Send an already-uploaded media by WhatsApp media id.
     */
    public function sendMediaById(
        string $to,
        string $type,
        string $mediaId,
        ?string $caption = null,
        ?string $filename = null,
    ): ?string {
        $media = ['id' => $mediaId];

        if ($caption && in_array($type, ['image', 'video', 'document'], true)) {
            $media['caption'] = $caption;
        }

        if ($filename && $type === 'document') {
            $media['filename'] = $filename;
        }

        return $this->send($to, [
            'type' => $type,
            $type => $media,
        ]);
    }

    public function sendFile(string $to, UploadedFile $file, string $type, ?string $caption = null, ?string $filename = null, ?string $forcedMimeType = null): ?string
    {
        $mediaId = $this->uploadMedia($file, $forcedMimeType);
        if (! $mediaId) {
            return null;
        }

        return $this->sendMediaById($to, $type, $mediaId, $caption, $filename);
    }

    public function supportsMediaFetch(): bool
    {
        return true;
    }

    /**
     * Send an interactive reply-buttons message (max 3 buttons).
     *
     * @param  array<int, array{id: string, title: string}>  $buttons
     */
    public function sendButtons(string $to, string $body, array $buttons, ?string $header = null): ?string
    {
        $action = [
            'buttons' => collect($buttons)->take(3)->map(fn ($b) => [
                'type' => 'reply',
                'reply' => [
                    'id' => (string) $b['id'],
                    'title' => mb_substr((string) $b['title'], 0, 20),
                ],
            ])->values()->all(),
        ];

        $interactive = [
            'type' => 'button',
            'body' => ['text' => $body],
            'action' => $action,
        ];

        if ($header) {
            $interactive['header'] = ['type' => 'text', 'text' => mb_substr($header, 0, 60)];
        }

        return $this->send($to, [
            'type' => 'interactive',
            'interactive' => $interactive,
        ]);
    }

    /**
     * Send an interactive list message.
     *
     * @param  array<int, array{id: string, title: string, description?: string}>  $rows
     */
    public function sendList(string $to, string $body, string $buttonText, array $rows, ?string $sectionTitle = null): ?string
    {
        return $this->send($to, [
            'type' => 'interactive',
            'interactive' => [
                'type' => 'list',
                'body' => ['text' => $body],
                'action' => [
                    'button' => mb_substr($buttonText, 0, 20),
                    'sections' => [[
                        'title' => mb_substr($sectionTitle ?? 'Opções', 0, 24),
                        'rows' => collect($rows)->take(10)->map(fn ($r) => array_filter([
                            'id' => (string) $r['id'],
                            'title' => mb_substr((string) $r['title'], 0, 24),
                            'description' => isset($r['description'])
                                ? mb_substr((string) $r['description'], 0, 72)
                                : null,
                        ]))->values()->all(),
                    ]],
                ],
            ],
        ]);
    }

    /**
     * Send a pre-approved template message.
     *
     * @param  array<int, mixed>  $components
     */
    public function sendTemplate(string $to, string $template, string $language = 'pt_BR', array $components = []): ?string
    {
        $payload = [
            'type' => 'template',
            'template' => [
                'name' => $template,
                'language' => ['code' => $language],
            ],
        ];

        if (! empty($components)) {
            $payload['template']['components'] = $components;
        }

        return $this->send($to, $payload);
    }

    /**
     * Mark an inbound message as read (blue ticks).
     */
    public function markAsRead(string $waMessageId): bool
    {
        $response = $this->request([
            'messaging_product' => 'whatsapp',
            'status' => 'read',
            'message_id' => $waMessageId,
        ]);

        return $response?->successful() ?? false;
    }

    /**
     * Mark an inbound message as read and show typing indicator to the user.
     */
    public function markAsReadWithTypingIndicator(string $waMessageId): bool
    {
        $response = $this->request([
            'messaging_product' => 'whatsapp',
            'status' => 'read',
            'message_id' => $waMessageId,
            'typing_indicator' => [
                'type' => 'text',
            ],
        ]);

        return $response?->successful() ?? false;
    }

    /**
     * Low-level send. Returns the resulting WhatsApp message id, or null on failure.
     *
     * @param  array<string, mixed>  $message
     */
    private function send(string $to, array $message): ?string
    {
        $this->lastErrorMessage = null;

        $response = $this->request(array_merge([
            'messaging_product' => 'whatsapp',
            'recipient_type' => 'individual',
            'to' => $this->normalizeNumber($to),
        ], $message));

        if (! $response || ! $response->successful()) {
            $this->lastErrorMessage = $this->extractErrorMessage($response)
                ?? 'Falha ao enviar mensagem para o WhatsApp.';

            Log::error('WhatsApp send failed', [
                'to' => $to,
                'status' => $response?->status(),
                'body' => $response?->json(),
            ]);

            return null;
        }

        return $response->json('messages.0.id');
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function request(array $payload): ?Response
    {
        if (! $this->isConfigured()) {
            $this->lastErrorMessage = 'Integração WhatsApp não configurada (token ou phone number id ausente).';
            Log::warning('WhatsApp não configurado (phone_number_id/access_token ausentes).');

            return null;
        }

        return Http::withToken($this->accessToken)
            ->acceptJson()
            ->timeout(15)
            ->post($this->endpointUrl('messages'), $payload);
    }

    private function normalizeNumber(string $number): string
    {
        return preg_replace('/[^0-9]/', '', $number) ?: $number;
    }

    /**
     * Fetch a media binary by WhatsApp media id.
     *
     * @return array{content: string, mime_type: string, filename: ?string}|null
     */
    public function fetchMedia(string $mediaId): ?array
    {
        if (! $this->isConfigured()) {
            $this->lastErrorMessage = 'Integração WhatsApp não configurada (token ou phone number id ausente).';
            return null;
        }

        $metaUrl = sprintf('https://graph.facebook.com/%s/%s', $this->apiVersion, $mediaId);
        $metaResponse = Http::withToken($this->accessToken)
            ->acceptJson()
            ->timeout(15)
            ->get($metaUrl);

        if (! $metaResponse->successful()) {
            $this->lastErrorMessage = $this->extractErrorMessage($metaResponse)
                ?? 'Falha ao buscar metadados da mídia no WhatsApp.';

            Log::warning('WhatsApp media metadata fetch failed', [
                'media_id' => $mediaId,
                'status' => $metaResponse->status(),
                'body' => $metaResponse->json(),
            ]);

            return null;
        }

        $downloadUrl = $metaResponse->json('url');
        if (! is_string($downloadUrl) || $downloadUrl === '') {
            $this->lastErrorMessage = 'A Meta não retornou a URL de download da mídia.';

            return null;
        }

        $mimeType = (string) ($metaResponse->json('mime_type') ?? 'application/octet-stream');
        $filename = $metaResponse->json('filename');
        if (! is_string($filename)) {
            $filename = null;
        }

        $mediaResponse = Http::withToken($this->accessToken)
            ->timeout(30)
            ->get($downloadUrl);

        if (! $mediaResponse->successful()) {
            $this->lastErrorMessage = $this->extractErrorMessage($mediaResponse)
                ?? 'Falha ao baixar mídia do WhatsApp.';

            Log::warning('WhatsApp media download failed', [
                'media_id' => $mediaId,
                'status' => $mediaResponse->status(),
            ]);

            return null;
        }

        return [
            'content' => $mediaResponse->body(),
            'mime_type' => $mimeType,
            'filename' => $filename,
        ];
    }

    /**
     * Upload media to WhatsApp and return the resulting media id.
     */
    public function uploadMedia(UploadedFile $file, ?string $forcedMimeType = null): ?string
    {
        $this->lastErrorMessage = null;

        if (! $this->isConfigured()) {
            $this->lastErrorMessage = 'Integração WhatsApp não configurada (token ou phone number id ausente).';
            return null;
        }

        $stream = fopen($file->getRealPath(), 'r');
        if ($stream === false) {
            return null;
        }

        $mimeType = $forcedMimeType ?: $this->normalizeUploadMimeType($file);

        try {
            $response = Http::withToken($this->accessToken)
                ->acceptJson()
                ->timeout(30)
                ->attach(
                    'file',
                    $stream,
                    $file->getClientOriginalName(),
                    ['Content-Type' => $mimeType],
                )
                ->post($this->endpointUrl('media'), [
                    'messaging_product' => 'whatsapp',
                    'type' => $mimeType,
                ]);
        } finally {
            fclose($stream);
        }

        if (! $response->successful()) {
            $this->lastErrorMessage = $this->extractErrorMessage($response)
                ?? 'Falha ao subir mídia para o WhatsApp.';

            Log::warning('WhatsApp media upload failed', [
                'status' => $response->status(),
                'body' => $response->json(),
                'filename' => $file->getClientOriginalName(),
                'mime_type' => $mimeType,
            ]);

            return null;
        }

        $mediaId = $response->json('id');

        return is_string($mediaId) && $mediaId !== '' ? $mediaId : null;
    }

    public function uploadMediaBytes(string $content, string $filename, string $mimeType): ?string
    {
        $this->lastErrorMessage = null;

        if (! $this->isConfigured()) {
            $this->lastErrorMessage = 'Integração WhatsApp não configurada (token ou phone number id ausente).';

            return null;
        }

        $response = Http::withToken($this->accessToken)
            ->acceptJson()
            ->timeout(30)
            ->attach(
                'file',
                $content,
                $filename,
                ['Content-Type' => $mimeType],
            )
            ->post($this->endpointUrl('media'), [
                'messaging_product' => 'whatsapp',
                'type' => $mimeType,
            ]);

        if (! $response->successful()) {
            $this->lastErrorMessage = $this->extractErrorMessage($response)
                ?? 'Falha ao subir mídia para o WhatsApp.';

            Log::warning('WhatsApp media upload by bytes failed', [
                'status' => $response->status(),
                'body' => $response->json(),
                'filename' => $filename,
                'mime_type' => $mimeType,
            ]);

            return null;
        }

        $mediaId = $response->json('id');

        return is_string($mediaId) && $mediaId !== '' ? $mediaId : null;
    }

    private function normalizeUploadMimeType(UploadedFile $file): string
    {
        $serverMime = strtolower((string) $file->getMimeType());
        $clientMime = strtolower((string) $file->getClientMimeType());
        $extension = strtolower((string) $file->getClientOriginalExtension());
        $name = strtolower((string) $file->getClientOriginalName());

        if (
            str_starts_with($serverMime, 'video/webm') ||
            str_starts_with($clientMime, 'video/webm') ||
            $extension === 'webm'
        ) {
            // Alguns navegadores gravam áudio como WebM e marcam como video/webm.
            // A Cloud API não aceita video/webm para áudio.
            if (str_contains($name, 'audio-')) {
                return 'audio/opus';
            }
        }

        return $serverMime !== '' ? $serverMime : ($clientMime !== '' ? $clientMime : 'application/octet-stream');
    }

    /**
     * Attempt to retrieve a WhatsApp contact's profile picture URL via the Graph API.
     *
     * Returns null when not configured, contact has no photo, or the request fails.
     * On authentication errors sets $this->lastErrorMessage so callers can detect
     * token expiration and avoid marking the attempt as permanent.
     */
    public function getContactProfilePictureUrl(string $waId): ?string
    {
        $this->lastErrorMessage = null;

        if (! $this->isConfigured()) {
            return null;
        }

        try {
            $response = Http::withToken($this->accessToken)
                ->acceptJson()
                ->timeout(10)
                ->get(sprintf(
                    'https://graph.facebook.com/%s/%s/contacts',
                    $this->apiVersion,
                    $this->phoneNumberId,
                ), [
                    'wa_ids' => json_encode([$waId]),
                    'fields' => 'profile_picture_url',
                ]);

            if ($response->ok()) {
                $url = data_get($response->json(), 'data.0.profile_picture_url')
                    ?? data_get($response->json(), '0.profile_picture_url');

                return is_string($url) && str_starts_with($url, 'http') ? $url : null;
            }

            // Propagate auth errors so the job can skip marking the attempt as permanent.
            $authMsg = $this->authenticationErrorMessage($response);
            if ($authMsg) {
                $this->lastErrorMessage = $authMsg;
                return null;
            }

            Log::warning('WhatsApp: getContactProfilePictureUrl non-OK response', [
                'wa_id'  => $waId,
                'status' => $response->status(),
                'body'   => $response->json(),
            ]);
        } catch (\Throwable $e) {
            Log::warning('WhatsApp: getContactProfilePictureUrl exception', [
                'wa_id' => $waId,
                'error' => $e->getMessage(),
            ]);
        }

        return null;
    }

    private function endpointUrl(string $resource): string
    {
        return sprintf(
            'https://graph.facebook.com/%s/%s/%s',
            $this->apiVersion,
            $this->phoneNumberId,
            ltrim($resource, '/'),
        );
    }

    private function extractErrorMessage(?Response $response): ?string
    {
        if (! $response) {
            return $this->lastErrorMessage;
        }

        $authMessage = $this->authenticationErrorMessage($response);
        if ($authMessage) {
            return $authMessage;
        }

        $body = $response->json();
        if (! is_array($body)) {
            return null;
        }

        $details = data_get($body, 'error.error_data.details');
        if (is_string($details) && trim($details) !== '') {
            return trim($details);
        }

        $message = data_get($body, 'error.message');
        if (is_string($message) && trim($message) !== '') {
            return trim($message);
        }

        return null;
    }

    private function authenticationErrorMessage(?Response $response): ?string
    {
        if (! $response) {
            return null;
        }

        $code = data_get($response->json(), 'error.code');
        $type = data_get($response->json(), 'error.type');

        if (
            $response->status() === 401 ||
            (is_numeric($code) && (int) $code === 190) ||
            $type === 'OAuthException'
        ) {
            return 'WhatsApp recusou a autenticação: token inválido ou expirado. Gere um novo token permanente de System User com permissão whatsapp_business_messaging, salve em Configurações e rode o teste de conexão novamente.';
        }

        return null;
    }

    /**
     * @return array<string, mixed>
     */
    private function responseDiagnosticDetails(Response $response): array
    {
        return [
            'http_status' => $response->status(),
            'meta_code' => data_get($response->json(), 'error.code'),
            'meta_type' => data_get($response->json(), 'error.type'),
            'meta_subcode' => data_get($response->json(), 'error.error_subcode'),
            'fbtrace_id' => data_get($response->json(), 'error.fbtrace_id'),
            'api_version' => $this->apiVersion,
            'phone_number_id' => $this->phoneNumberId,
        ];
    }
}
