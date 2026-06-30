<?php

namespace App\Http\Controllers;

use App\Jobs\ProcessWebChatMessage;
use App\Models\Channel;
use App\Models\Contact;
use App\Models\Conversation;
use App\Models\Flow;
use App\Models\Message;
use App\Services\Flow\FlowEngine;
use App\Services\OutOfHoursGate;
use App\Services\WebChat\WebChatService;
use App\Services\WhatsApp\MessageSender;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Storage;

class WebChatController extends Controller
{
    /** @return array<string, string> */
    private function corsHeaders(): array
    {
        return [
            'Access-Control-Allow-Origin'  => '*',
            'Access-Control-Allow-Methods' => 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers' => 'Content-Type, Accept',
            'Access-Control-Max-Age'       => '3600',
        ];
    }

    public function preflight(): Response
    {
        return response('', 204, $this->corsHeaders());
    }

    /**
     * Inicializa ou retoma a sessão de chat.
     * Recebe api_key + visitor_id, devolve session_token + mensagens existentes.
     */
    public function init(Request $request, Channel $channel): JsonResponse
    {
        if (! $channel->is_active || $channel->type !== Channel::TYPE_WEB) {
            return response()->json(['error' => 'Canal não disponível.'], 404)
                ->withHeaders($this->corsHeaders());
        }

        $apiKey = (string) $request->input('api_key', '');
        if ($apiKey !== ($channel->config['api_key'] ?? '')) {
            return response()->json(['error' => 'Chave inválida.'], 403)
                ->withHeaders($this->corsHeaders());
        }

        $visitorId = (string) $request->input('visitor_id', '');
        if ($visitorId === '' || strlen($visitorId) > 128) {
            return response()->json(['error' => 'Visitor ID inválido.'], 422)
                ->withHeaders($this->corsHeaders());
        }

        $rateLimitKey = 'wchat_init:' . $channel->id . ':' . substr($visitorId, 0, 32);
        if (RateLimiter::tooManyAttempts($rateLimitKey, 20)) {
            return response()->json(['error' => 'Muitas tentativas. Aguarde.'], 429)
                ->withHeaders($this->corsHeaders());
        }
        RateLimiter::hit($rateLimitKey, 3600);

        $visitorName = mb_substr(trim((string) $request->input('visitor_name', '')), 0, 128);

        $waId    = 'web_' . $visitorId;
        $contact = Contact::firstOrCreate(
            ['wa_id' => $waId, 'channel_id' => $channel->id],
            ['last_message_at' => now()],
        );

        $updates = ['last_message_at' => now()];
        if ($visitorName !== '' && empty($contact->name)) {
            $updates['name'] = $visitorName;
        }
        $contact->forceFill($updates)->save();

        $isNew        = false;
        $conversation = $contact->conversations()
            ->active()
            ->orderByDesc('last_message_at')
            ->first();

        if (! $conversation) {
            $isNew       = true;
            $defaultFlow = Flow::defaultFlow();

            $conversation = $contact->conversations()->create([
                'channel_id'      => $channel->id,
                'status'          => $defaultFlow ? Conversation::STATUS_BOT : Conversation::STATUS_QUEUED,
                'flow_id'         => $defaultFlow?->id,
                'last_message_at' => now(),
            ]);

            // Dispara o fluxo de forma síncrona para que a saudação já esteja na resposta do init.
            if ($conversation->status === Conversation::STATUS_BOT) {
                $webchat = new WebChatService($channel);
                if (! (new OutOfHoursGate())->blocksBotFlow($conversation, $webchat)) {
                    (new FlowEngine($webchat))->run($conversation, '', []);
                }
                $conversation->refresh();
            }
        }

        $sessionToken = Crypt::encryptString(json_encode([
            'contact_id'      => $contact->id,
            'channel_id'      => $channel->id,
            'conversation_id' => $conversation->id,
            'exp'             => now()->addDays(7)->timestamp,
        ]));

        $messages = $conversation->messages()
            ->orderBy('id')
            ->limit(60)
            ->get()
            ->map(fn (Message $m) => $this->serializeMessage($m, $channel->id))
            ->values();

        return response()->json([
            'session_token' => $sessionToken,
            'messages'      => $messages,
        ])->withHeaders($this->corsHeaders());
    }

    /**
     * Recebe uma mensagem do visitante (texto ou clique em botão).
     */
    public function send(Request $request, Channel $channel): JsonResponse
    {
        if (! $channel->is_active || $channel->type !== Channel::TYPE_WEB) {
            return response()->json(['error' => 'Canal não disponível.'], 404)
                ->withHeaders($this->corsHeaders());
        }

        [$contact, $conversation] = $this->resolveSession($request, $channel);
        if (! $contact || ! $conversation) {
            return response()->json(['error' => 'Sessão inválida ou expirada.'], 401)
                ->withHeaders($this->corsHeaders());
        }

        // Conversa encerrada pelo fluxo (ex: após envio de boleto): força o widget
        // a reinicializar via initSession(), que criará uma nova conversa.
        if ($conversation->status === Conversation::STATUS_CLOSED) {
            return response()->json(['error' => 'Sessão inválida ou expirada.'], 401)
                ->withHeaders($this->corsHeaders());
        }

        $rateLimitKey = 'wchat_send:' . $contact->id;
        if (RateLimiter::tooManyAttempts($rateLimitKey, 60)) {
            return response()->json(['error' => 'Muitas mensagens. Aguarde.'], 429)
                ->withHeaders($this->corsHeaders());
        }
        RateLimiter::hit($rateLimitKey, 60);

        $text        = trim((string) $request->input('text', ''));
        $buttonId    = $request->input('button_id') !== null ? (string) $request->input('button_id') : null;
        $buttonTitle = $request->input('button_title') !== null ? (string) $request->input('button_title') : null;

        if ($text === '' && $buttonId === null) {
            return response()->json(['error' => 'Mensagem vazia.'], 422)
                ->withHeaders($this->corsHeaders());
        }

        // Processa de forma síncrona para que as respostas do bot estejam imediatas no próximo poll.
        ProcessWebChatMessage::dispatchSync(
            $contact->id,
            $channel->id,
            $buttonId !== null ? $buttonId : $text,
            $buttonId,
            $buttonTitle,
        );

        return response()->json(['ok' => true])->withHeaders($this->corsHeaders());
    }

    /**
     * Retorna mensagens novas (polling de longa duração leve — sem sleep, simples).
     */
    public function poll(Request $request, Channel $channel): JsonResponse
    {
        if (! $channel->is_active || $channel->type !== Channel::TYPE_WEB) {
            return response()->json(['error' => 'Canal não disponível.'], 404)
                ->withHeaders($this->corsHeaders());
        }

        [$contact, $conversation] = $this->resolveSession($request, $channel);
        if (! $contact || ! $conversation) {
            return response()->json(['error' => 'Sessão inválida ou expirada.'], 401)
                ->withHeaders($this->corsHeaders());
        }

        $after = max(0, (int) $request->input('after', 0));

        $messages = $conversation->messages()
            ->where('id', '>', $after)
            ->orderBy('id')
            ->limit(30)
            ->get()
            ->map(fn (Message $m) => $this->serializeMessage($m, $channel->id))
            ->values();

        return response()->json(['messages' => $messages])->withHeaders($this->corsHeaders());
    }

    /**
     * Serve um arquivo de mídia de saída para o visitante (ex: boleto PDF).
     */
    public function media(Request $request, Channel $channel, Message $message): Response
    {
        if (! $channel->is_active || $channel->type !== Channel::TYPE_WEB) {
            abort(404);
        }

        [$contact, $conversation] = $this->resolveSession($request, $channel);
        if (! $contact || ! $conversation) {
            abort(403);
        }

        // Autoriza se a mensagem pertence a qualquer conversa do mesmo contato
        // no mesmo canal. Necessário quando a sessão foi reiniciada após o
        // encerramento da conversa original (ex: após envio de boleto).
        $msgConv = $message->conversation;
        if (! $msgConv
            || $msgConv->contact_id !== $contact->id
            || $msgConv->channel_id !== $channel->id
        ) {
            abort(403);
        }

        $localPath = data_get($message->payload, 'outbound_media.local_path');
        if (! is_string($localPath) || $localPath === '' || ! Storage::exists($localPath)) {
            abort(404);
        }

        $mimeType = data_get($message->payload, 'outbound_media.mime_type', 'application/octet-stream');
        $filename = data_get($message->payload, 'outbound_media.filename', 'media');

        return response(Storage::get($localPath), 200, [
            'Content-Type'        => $mimeType,
            'Content-Disposition' => 'inline; filename="' . $filename . '"',
            'Cache-Control'       => 'private, max-age=300',
        ] + $this->corsHeaders());
    }

    // ─── Helpers ────────────────────────────────────────────────────────────────

    /** @return array{0: Contact|null, 1: Conversation|null} */
    private function resolveSession(Request $request, Channel $channel): array
    {
        $token = (string) $request->input('session', '');
        if ($token === '') {
            return [null, null];
        }

        try {
            $data = json_decode(Crypt::decryptString($token), true);
        } catch (\Throwable) {
            return [null, null];
        }

        if (
            ! is_array($data)
            || ! isset($data['contact_id'], $data['channel_id'], $data['conversation_id'], $data['exp'])
            || (int) $data['channel_id'] !== $channel->id
            || (int) $data['exp'] < now()->timestamp
        ) {
            return [null, null];
        }

        $contact      = Contact::find($data['contact_id']);
        $conversation = Conversation::find($data['conversation_id']);

        if (! $contact || ! $conversation) {
            return [null, null];
        }

        // Se a conversa foi encerrada, tenta encontrar uma irmã ativa.
        // Não cria nova conversa aqui — isso cabe ao init() para garantir que
        // o widget veja as mensagens da conversa encerrada (ex: boleto enviado)
        // antes de qualquer reinicialização.
        if ($conversation->status === Conversation::STATUS_CLOSED) {
            $active = $contact->conversations()->active()->orderByDesc('last_message_at')->first();

            if ($active) {
                $conversation = $active;
            }
            // Sem irmã ativa: mantém $conversation apontando para a encerrada.
            // poll() e media() ainda servem as mensagens existentes;
            // send() retornará 401 e o widget reinicializará via initSession().
        }

        return [$contact, $conversation];
    }

    /** @return array<string, mixed> */
    private function serializeMessage(Message $message, int $channelId): array
    {
        $payload   = $message->payload ?? [];
        $buttons   = $payload['buttons'] ?? null;
        $rows      = $payload['rows'] ?? null;
        $mediaUrl  = null;

        if (
            in_array($message->type, ['document', 'image', 'audio', 'video'], true)
            && is_string(data_get($payload, 'outbound_media.local_path'))
            && data_get($payload, 'outbound_media.local_path') !== ''
        ) {
            $mediaUrl = route('webchat.media', [
                'channel' => $channelId,
                'message' => $message->id,
            ]);
        }

        return [
            'id'         => $message->id,
            'direction'  => $message->direction,
            'type'       => $message->type,
            'body'       => $message->body,
            'status'     => $message->status,
            'created_at' => $message->created_at?->toIso8601String(),
            'buttons'    => $buttons,
            'rows'       => $rows,
            'media_url'  => $mediaUrl,
            'filename'   => data_get($payload, 'outbound_media.filename'),
        ];
    }
}
