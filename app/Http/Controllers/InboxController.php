<?php

namespace App\Http\Controllers;

use App\Models\AppSetting;
use App\Models\Channel;
use App\Models\Conversation;
use App\Models\IntegrationConfig;
use App\Models\Message;
use App\Models\QuickReply;
use App\Models\Sector;
use App\Models\Survey;
use App\Models\SurveyResponse;
use App\Models\User;
use App\Services\Telegram\TelegramService;
use App\Services\WhatsApp\MessageSender;
use App\Services\WhatsApp\WhatsAppService;
use Illuminate\Http\UploadedFile;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class InboxController extends Controller
{
    public function index(Request $request): Response
    {
        $filter = $request->string('filter', 'all')->toString();
        $sectorId = $request->integer('sector_id') ?: null;
        $filterUserId = $request->integer('user_id') ?: null;
        $sort = in_array($request->string('sort')->toString(), ['oldest']) ? 'oldest' : 'newest';
        $user = $request->user();
        $userId = $user->id;

        $conversations = Conversation::query()
            ->with(['contact', 'assignedUser:id,name', 'sector:id,name', 'channel:id,name,type'])
            ->where('status', '!=', Conversation::STATUS_CLOSED)
            ->visibleTo($user)
            ->when($filter === 'mine', fn ($q) => $q->where('assigned_user_id', $userId))
            ->when($filter === 'bot', fn ($q) => $q->where('status', Conversation::STATUS_BOT))
            ->when($filter === 'queued', fn ($q) => $q->where('status', Conversation::STATUS_QUEUED))
            ->when($filter === 'open', fn ($q) => $q->where('status', Conversation::STATUS_OPEN))
            ->when($sectorId !== null, fn ($q) => $q->where('sector_id', $sectorId))
            ->when($filterUserId !== null, fn ($q) => $q->where('assigned_user_id', $filterUserId))
            ->when($sort === 'oldest', fn ($q) => $q->orderBy('last_message_at'), fn ($q) => $q->orderByDesc('last_message_at'))
            ->limit(100)
            ->get()
            ->map(fn (Conversation $c) => $this->summarize($c, $user));

        $selected = null;
        if ($request->filled('conversation')) {
            $selected = $this->loadConversation((int) $request->integer('conversation'), $user);
        }

        $sectors = Sector::where('is_active', true)->orderBy('name')->get(['id', 'name']);
        $users = $user->isManager()
            ? User::where('is_active', true)->orderBy('name')->get(['id', 'name'])
            : collect();

        return Inertia::render('Inbox/Index', [
            'conversations' => $conversations,
            'selected' => $selected,
            'filter' => $filter,
            'sort' => $sort,
            'sector_id' => $sectorId,
            'user_id' => $filterUserId,
            'sectors' => $sectors,
            'users' => $users,
            'counts' => [
                'bot' => Conversation::query()->visibleTo($user)
                    ->where('status', Conversation::STATUS_BOT)->count(),
                'queued' => Conversation::query()->visibleTo($user)
                    ->where('status', Conversation::STATUS_QUEUED)->count(),
                'mine' => Conversation::where('assigned_user_id', $userId)
                    ->where('status', Conversation::STATUS_OPEN)->count(),
            ],
            'auto_close_enabled' => AppSetting::bool('auto_close_inactive_conversations_enabled'),
            'auto_close_minutes' => max(1, (int) AppSetting::get('auto_close_inactive_conversations_minutes', 60)),
            'quick_replies' => QuickReply::where('is_active', true)->orderBy('trigger')->get(['id', 'trigger', 'title', 'content']),
            'has_ixc' => IntegrationConfig::where('type', 'ixc')->where('is_active', true)->exists(),
        ]);
    }

    public function show(Request $request, Conversation $conversation): Response
    {
        return $this->index($request->merge(['conversation' => $conversation->id]));
    }

    public function assign(Request $request, Conversation $conversation): RedirectResponse
    {
        $sender = $this->senderFor($conversation);
        abort_unless(
            $conversation->canBeAssignedBy($request->user()),
            403,
            'Conversa atribuída a outro atendente.',
        );

        $assignee = $request->user();

        $conversation->forceFill([
            'assigned_user_id' => $assignee->id,
            'status' => Conversation::STATUS_OPEN,
        ])->save();
        $conversation->closeSiblingActiveConversations();

        $sender->sendText(
            $conversation,
            sprintf('Usuário %s assumiu seu atendimento.', $assignee->name),
        );

        return back()->with('success', 'Conversa atribuída a você.');
    }

    public function sendMessage(Request $request, Conversation $conversation): RedirectResponse
    {
        $sender = $this->senderFor($conversation);
        $validated = $request->validate([
            'body' => ['nullable', 'string', 'max:4096'],
            'attachment' => ['nullable', 'file', 'max:16384'],
            'audio' => [
                'nullable',
                'file',
                'max:16384',
                function (string $attribute, mixed $value, \Closure $fail): void {
                    if (! $value instanceof UploadedFile) {
                        return;
                    }

                    $allowedExtensions = ['aac', 'amr', 'mp3', 'm4a', 'mp4', 'ogg', 'oga', 'opus', 'wav', 'webm'];
                    $allowedMimes = ['audio/aac', 'audio/amr', 'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/opus', 'audio/wav', 'audio/webm', 'video/webm'];

                    $extension = strtolower((string) $value->getClientOriginalExtension());
                    $clientMime = strtolower((string) $value->getClientMimeType());
                    $serverMime = strtolower((string) $value->getMimeType());

                    if (
                        in_array($extension, $allowedExtensions, true) ||
                        in_array($clientMime, $allowedMimes, true) ||
                        in_array($serverMime, $allowedMimes, true)
                    ) {
                        return;
                    }

                    $fail('Formato de áudio inválido.');
                },
            ],
        ], [
            'attachment.max' => 'O arquivo é muito grande. O tamanho máximo permitido é 16 MB.',
            'audio.max'      => 'O áudio é muito grande. O tamanho máximo permitido é 16 MB.',
        ]);

        $body = trim((string) ($validated['body'] ?? ''));
        $hasAttachment = $request->hasFile('attachment');
        $hasAudio = $request->hasFile('audio');

        if ($body === '' && ! $hasAttachment && ! $hasAudio) {
            throw ValidationException::withMessages([
                'body' => 'Digite uma mensagem, anexe um arquivo ou grave um áudio.',
            ]);
        }

        abort_unless(
            $conversation->canBeActedOnBy($request->user()),
            403,
            'Conversa atribuída a outro atendente.',
        );

        // Garante que a conversa esteja aberta ao assumir o envio.
        if ($conversation->status !== Conversation::STATUS_OPEN) {
            $conversation->forceFill([
                'status' => Conversation::STATUS_OPEN,
            ])->save();
        }

        if ($hasAudio) {
            $message = $sender->sendAudio($conversation, $request->file('audio'), $request->user());
        } elseif ($hasAttachment) {
            $message = $sender->sendAttachment(
                $conversation,
                $request->file('attachment'),
                $body !== '' ? $body : null,
                $request->user(),
            );
        } else {
            $message = $sender->sendText($conversation, $body, $request->user());
        }

        if ($message->status === 'failed') {
            $fallbackError = 'Falha ao enviar no WhatsApp. Verifique a integração e tente novamente.';

            return back()->withErrors([
                'send' => $sender->lastErrorMessage() ?? $fallbackError,
            ]);
        }

        return back();
    }

    public function media(Message $message): HttpResponse
    {
        $conversation = $message->conversation()->firstOrFail();
        abort_unless($conversation->canBeViewedBy(request()->user()), 403);

        abort_unless(in_array($message->type, ['image', 'audio', 'video', 'document'], true), 404);

        $channel = $conversation->channel;

        // Arquivo salvo localmente (Telegram outbound ou outros canais sem fetch remoto)
        $localPath = data_get($message->payload, 'outbound_media.local_path');
        if (is_string($localPath) && $localPath !== '' && Storage::exists($localPath)) {
            $mimeType = data_get($message->payload, 'outbound_media.mime_type', 'application/octet-stream');
            $filename = data_get($message->payload, 'outbound_media.filename', 'media');

            return response(Storage::get($localPath), 200, [
                'Content-Type'        => $mimeType,
                'Content-Disposition' => 'inline; filename="'.$filename.'"',
                'Cache-Control'       => 'private, max-age=300',
            ]);
        }

        // Telegram inbound: busca via file_id no payload
        if ($channel?->type === Channel::TYPE_TELEGRAM) {
            $payload = $message->payload ?? [];
            $fileId  = match ($message->type) {
                'image'    => collect($payload['photo'] ?? [])->last()['file_id'] ?? null,
                'video'    => $payload['video']['file_id'] ?? null,
                'audio'    => $payload['audio']['file_id'] ?? $payload['voice']['file_id'] ?? null,
                'document' => $payload['document']['file_id'] ?? null,
                default    => null,
            };
            abort_unless(is_string($fileId) && $fileId !== '', 404);

            $telegram = new TelegramService($channel);
            $media    = $telegram->fetchMedia($fileId);
            abort_unless($media !== null, 404);

            return response($media['content'], 200, [
                'Content-Type'        => $media['mime_type'],
                'Content-Disposition' => 'inline; filename="'.$media['filename'].'"',
                'Cache-Control'       => 'private, max-age=300',
            ]);
        }

        // WhatsApp: busca via media ID
        $whatsApp = new WhatsAppService($channel);
        $mediaId  = data_get($message->payload, $message->type.'.id');
        if (! is_string($mediaId) || $mediaId === '') {
            $mediaId = data_get($message->payload, 'outbound_media.id');
        }
        abort_unless(is_string($mediaId) && $mediaId !== '', 404);

        $media = $whatsApp->fetchMedia($mediaId);
        if ($media === null) {
            $errorMessage = $whatsApp->getLastErrorMessage();

            if ($errorMessage) {
                return response($errorMessage, 502, [
                    'Content-Type' => 'text/plain; charset=UTF-8',
                ]);
            }

            abort(404);
        }

        $filename = $media['filename']
            ?? data_get($message->payload, 'outbound_media.filename')
            ?? 'media';

        return response($media['content'], 200, [
            'Content-Type'        => $media['mime_type'],
            'Content-Disposition' => 'inline; filename="'.$filename.'"',
            'Cache-Control'       => 'private, max-age=300',
        ]);
    }

    public function transfer(Request $request, Conversation $conversation): RedirectResponse
    {
        $sender = $this->senderFor($conversation);
        abort_unless(
            $conversation->canBeTransferredBy($request->user()),
            403,
            'Sem permissão para transferir esta conversa.',
        );

        $validated = $request->validate([
            'sector_id' => ['required', 'exists:sectors,id'],
        ]);

        $sector = Sector::findOrFail($validated['sector_id']);

        $conversation->forceFill([
            'sector_id' => $sector->id,
            'status' => Conversation::STATUS_QUEUED,
            'assigned_user_id' => null,
        ])->save();

        if (AppSetting::bool('notify_customer_on_transfer', true)) {
            $sender->sendText(
                $conversation,
                sprintf(
                    'Seu atendimento foi transferido para o setor %s. Em breve um atendente dará continuidade.',
                    $sector->name,
                ),
            );
        }

        return back()->with('success', 'Conversa transferida para o setor.');
    }

    public function close(Conversation $conversation): RedirectResponse
    {
        $sender = $this->senderFor($conversation);
        abort_unless(
            $conversation->canBeActedOnBy(request()->user()),
            403,
            'Conversa atribuída a outro atendente.',
        );

        // Check if survey should be sent on close
        if (AppSetting::bool('survey_on_close_enabled', false)) {
            $surveyId = AppSetting::get('survey_on_close_survey_id');
            $survey   = $surveyId ? Survey::with('questions')->find((int) $surveyId) : null;

            if ($survey && $survey->is_active && $survey->questions->isNotEmpty()) {
                $response = SurveyResponse::create([
                    'survey_id'        => $survey->id,
                    'conversation_id'  => $conversation->id,
                    'contact_id'       => $conversation->contact_id,
                    'status'           => SurveyResponse::STATUS_IN_PROGRESS,
                    'current_position' => 0,
                    'started_at'       => now(),
                ]);

                $conversation->forceFill([
                    'status'             => Conversation::STATUS_SURVEYING,
                    'survey_response_id' => $response->id,
                ])->save();

                // Send first question as buttons
                $firstQuestion = $survey->questions->first();
                $buttons = collect($firstQuestion->options ?? [])
                    ->take(3) // WhatsApp allows max 3 buttons
                    ->map(fn ($opt) => ['id' => $opt['id'], 'title' => mb_substr($opt['label'], 0, 20)])
                    ->values()
                    ->all();

                $sender->sendButtons($conversation, $firstQuestion->text, $buttons, $survey->name);

                return back()->with('success', 'Atendimento encerrado. Pesquisa de satisfação enviada.');
            }
        }

        $conversation->forceFill(['status' => Conversation::STATUS_CLOSED])->save();

        return back()->with('success', 'Atendimento encerrado.');
    }

    /**
     * @return array<string, mixed>
     */
    private function senderFor(Conversation $conversation): MessageSender
    {
        $channel = $conversation->channel;

        $service = match ($channel?->type) {
            Channel::TYPE_TELEGRAM => new TelegramService($channel),
            Channel::TYPE_WHATSAPP => new WhatsAppService($channel),
            default                => new WhatsAppService(),
        };

        return new MessageSender($service);
    }

    private function summarize(Conversation $conversation, User $user): array
    {
        $last = $conversation->messages()->latest()->first();

        return [
            'id' => $conversation->id,
            'status' => $conversation->status,
            'channel_type' => $conversation->channel?->type,
            'channel_name' => $conversation->channel?->name,
            'assigned_user_id' => $conversation->assigned_user_id,
            'assigned_user' => $conversation->assignedUser?->only(['id', 'name']),
            'sector' => $conversation->sector?->only(['id', 'name']),
            'can_transfer' => $conversation->canBeTransferredBy($user),
            'contact' => [
                'id' => $conversation->contact->id,
                'name' => $conversation->contact->displayName(),
                'wa_id' => $conversation->contact->wa_id,
                'avatar_url' => data_get($conversation->contact->meta, 'avatar_url')
                    ?? data_get($conversation->contact->meta, 'profile_photo_url'),
            ],
            'last_message' => $last?->body,
            'last_message_type' => $last?->type,
            'last_message_at' => $conversation->last_message_at?->toIso8601String(),
            'last_message_direction' => $last?->direction,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function loadConversation(int $id, User $user): array
    {
        $conversation = Conversation::with(['contact', 'assignedUser:id,name', 'sector:id,name', 'channel:id,name,type'])->findOrFail($id);
        abort_unless($conversation->canBeViewedBy($user), 403);

        $messages = $conversation->messages()
            ->with('sender:id,name')
            ->orderBy('created_at')
            ->limit(200)
            ->get()
            ->map(fn ($m) => [
                'id' => $m->id,
                'direction' => $m->direction,
                'type' => $m->type,
                'body' => $m->body,
                'media_url' => in_array($m->type, ['image', 'audio', 'video', 'document'], true)
                    ? route('inbox.messages.media', $m)
                    : null,
                'status' => $m->status,
                'sender' => $m->sender?->only(['id', 'name']),
                'created_at' => $m->created_at?->toIso8601String(),
            ]);

        return [
            'id' => $conversation->id,
            'status' => $conversation->status,
            'channel_type' => $conversation->channel?->type,
            'channel_name' => $conversation->channel?->name,
            'assigned_user_id' => $conversation->assigned_user_id,
            'assigned_user' => $conversation->assignedUser?->only(['id', 'name']),
            'sector' => $conversation->sector?->only(['id', 'name']),
            'can_act' => $conversation->canBeActedOnBy($user),
            'can_assign' => $conversation->canBeAssignedBy($user),
            'can_transfer' => $conversation->canBeTransferredBy($user),
            'last_message_at' => $conversation->last_message_at?->toIso8601String(),
            'contact' => [
                'id'                   => $conversation->contact->id,
                'name'                 => $conversation->contact->displayName(),
                'wa_id'                => $conversation->contact->wa_id,
                'ixc_customer_id'      => $conversation->contact->ixc_customer_id,
                'ixc_customer_name'    => $conversation->contact->ixc_customer_name,
                'notes'                => $conversation->contact->notes,
            ],
            'messages' => $messages,
        ];
    }
}
