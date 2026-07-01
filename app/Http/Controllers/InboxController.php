<?php

namespace App\Http\Controllers;

use App\Jobs\TranscribeAudioMessage;
use App\Models\AppSetting;
use App\Models\Channel;
use App\Models\Contact;
use App\Models\Conversation;
use App\Models\IntegrationConfig;
use App\Models\Message;
use App\Models\QuickReply;
use App\Models\Sector;
use App\Models\Tag;
use App\Models\Survey;
use App\Models\SurveyResponse;
use App\Models\User;
use App\Events\ConversationViewing;
use App\Services\Conversation\ConversationSlaService;
use App\Services\Conversation\ConversationSnoozeService;
use App\Services\Conversation\ConversationViewingService;
use App\Services\Survey\SurveyQuestionSender;
use App\Services\Telegram\TelegramService;
use App\Services\WebChat\WebChatService;
use App\Services\Transcription\GroqTranscriptionService;
use App\Services\WhatsApp\MessageSender;
use App\Services\WhatsApp\WhatsAppService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\UploadedFile;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class InboxController extends Controller
{
    public function __construct(
        private ConversationSlaService $sla,
        private ConversationViewingService $viewing,
        private ConversationSnoozeService $snooze,
    ) {
    }

    public function index(Request $request): Response|RedirectResponse
    {
        $user = $request->user();
        $defaultFilter = $this->defaultInboxFilter($user);
        $filter = $request->string('filter', $defaultFilter)->toString();
        $sectorId = $request->integer('sector_id') ?: null;
        $filterUserId = $request->integer('user_id') ?: null;
        $tagId = $request->integer('tag_id') ?: null;
        $sort = in_array($request->string('sort')->toString(), ['oldest']) ? 'oldest' : 'newest';
        $userId = $user->id;

        if (! $user->isManager() && $filter === 'all') {
            return redirect()->route('inbox.index', $this->inboxIndexParams(
                'mine',
                $sectorId,
                $filterUserId,
                $tagId,
                $sort,
                $defaultFilter,
            ));
        }

        $conversations = Conversation::query()
            ->with(['contact.tags:id,name,color', 'assignedUser:id,name,profile_photo_path', 'sector:id,name', 'channel:id,name,type'])
            ->where('status', '!=', Conversation::STATUS_CLOSED)
            ->visibleTo($user)
            ->when($filter === 'snoozed', fn ($q) => $q->where('status', Conversation::STATUS_SNOOZED))
            ->when($filter !== 'snoozed', fn ($q) => $q->where('status', '!=', Conversation::STATUS_SNOOZED))
            ->when($filter === 'mine', fn ($q) => $q->where('assigned_user_id', $userId)->where('status', Conversation::STATUS_OPEN))
            ->when($filter === 'bot', fn ($q) => $q->where('status', Conversation::STATUS_BOT))
            ->when($filter === 'queued', fn ($q) => $q->where('status', Conversation::STATUS_QUEUED))
            ->when($filter === 'open', fn ($q) => $q->where('status', Conversation::STATUS_OPEN))
            ->when($sectorId !== null, fn ($q) => $q->where('sector_id', $sectorId))
            ->when($filterUserId !== null, fn ($q) => $q->where('assigned_user_id', $filterUserId))
            ->when($tagId !== null, fn ($q) => $q->whereHas('contact.tags', fn ($q2) => $q2->where('tags.id', $tagId)))
            ->when($sort === 'oldest', fn ($q) => $q->orderBy('last_message_at'), fn ($q) => $q->orderByDesc('last_message_at'))
            ->limit(100)
            ->get()
            ->map(fn (Conversation $c) => $this->summarize($c, $user));

        $selected = null;
        if ($request->filled('conversation')) {
            $selected = $this->loadConversation((int) $request->integer('conversation'), $user);
            if ($selected === null) {
                return redirect()->route('inbox.index', $this->inboxIndexParams(
                    $filter,
                    $sectorId,
                    $filterUserId,
                    $tagId,
                    $sort,
                    $defaultFilter,
                ));
            }
        }

        $sectors = Sector::where('is_active', true)->orderBy('name')->get(['id', 'name']);
        $users = $user->isManager()
            ? User::where('is_active', true)->orderBy('name')->get(['id', 'name'])
            : collect();
        $transferUsers = User::where('is_active', true)->orderBy('name')->get(['id', 'name']);

        return Inertia::render('Inbox/Index', [
            'conversations' => $conversations,
            'selected' => $selected,
            'filter' => $filter,
            'sort' => $sort,
            'sector_id' => $sectorId,
            'user_id' => $filterUserId,
            'tag_id' => $tagId,
            'sectors' => $sectors,
            'users' => $users,
            'transfer_users' => $transferUsers,
            'tags' => Tag::where('is_active', true)->orderBy('name')->get(['id', 'name', 'color']),
            'counts' => [
                'bot' => Conversation::query()->visibleTo($user)
                    ->where('status', Conversation::STATUS_BOT)->count(),
                'queued' => Conversation::query()->visibleTo($user)
                    ->where('status', Conversation::STATUS_QUEUED)->count(),
                'mine' => Conversation::where('assigned_user_id', $userId)
                    ->where('status', Conversation::STATUS_OPEN)->count(),
                'snoozed' => Conversation::query()->visibleTo($user)
                    ->where('status', Conversation::STATUS_SNOOZED)
                    ->when(! $user->isManager(), fn ($q) => $q->where('assigned_user_id', $userId))
                    ->count(),
            ],
            'auto_close_enabled' => AppSetting::bool('auto_close_inactive_conversations_enabled'),
            'auto_close_minutes' => max(1, (int) AppSetting::get('auto_close_inactive_conversations_minutes', 60)),
            'quick_replies' => QuickReply::where('is_active', true)->orderBy('trigger')->get(['id', 'trigger', 'title', 'content']),
            'has_ixc' => IntegrationConfig::where('type', 'ixc')->where('is_active', true)->exists(),
        ]);
    }

    public function show(Request $request, Conversation $conversation): Response|RedirectResponse
    {
        abort_unless($conversation->canBeViewedBy($request->user()), 403);

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

    public function sendMessage(Request $request, Conversation $conversation): RedirectResponse|JsonResponse
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
            $error = $sender->lastErrorMessage() ?? $fallbackError;

            if ($request->wantsJson()) {
                return response()->json(['message' => $error], 422);
            }

            return back()->withErrors(['send' => $error]);
        }

        $message->load('sender:id,name,profile_photo_path');

        if ($request->wantsJson()) {
            return response()->json($this->formatMessage($message), 201);
        }

        return back();
    }

    public function sendInternalMessage(Request $request, Conversation $conversation): RedirectResponse|JsonResponse
    {
        abort_unless(
            $conversation->canSendInternalNoteBy($request->user()),
            403,
            'Você não pode enviar mensagens internas nesta conversa.',
        );

        $validated = $request->validate([
            'body' => ['required', 'string', 'max:4096'],
        ]);

        $body = trim($validated['body']);

        if ($body === '') {
            throw ValidationException::withMessages([
                'body' => 'Digite uma mensagem interna.',
            ]);
        }

        $message = $conversation->messages()->create([
            'direction' => Message::DIRECTION_OUT,
            'type' => 'text',
            'body' => $body,
            'status' => 'accepted',
            'sender_user_id' => $request->user()->id,
            'is_internal' => true,
        ]);

        $conversation->update(['last_message_at' => now()]);

        $message->load('sender:id,name,profile_photo_path');

        if ($request->wantsJson()) {
            return response()->json($this->formatMessage($message), 201);
        }

        return back();
    }

    public function contactConversationHistory(Contact $contact, Conversation $conversation): JsonResponse
    {
        abort_unless($conversation->contact_id === $contact->id, 404);

        $anchorId = (int) request()->integer('anchor');
        abort_unless($anchorId > 0, 422, 'Informe a conversa de referência.');

        $anchor = Conversation::findOrFail($anchorId);
        abort_unless($anchor->contact_id === $contact->id, 404);
        abort_unless($anchor->canBeViewedBy(request()->user()), 403);

        $conversation->load([
            'assignedUser:id,name,profile_photo_path',
            'sector:id,name',
            'channel:id,type,name',
            'surveyResponse.answers',
        ]);

        $messages = $conversation->messages()
            ->with('sender:id,name,profile_photo_path')
            ->orderBy('created_at')
            ->limit(300)
            ->get()
            ->map(fn ($m) => $this->formatMessage($m));

        $survey = null;
        if ($conversation->surveyResponse) {
            $sr = $conversation->surveyResponse;
            $survey = [
                'status' => $sr->status,
                'completed_at' => $sr->completed_at?->toIso8601String(),
                'answers' => $sr->answers->map(fn ($a) => [
                    'option_label' => $a->option_label,
                ])->values(),
            ];
        }

        $dur = $conversation->created_at && $conversation->last_message_at
            ? (int) $conversation->created_at->diffInMinutes($conversation->last_message_at)
            : null;

        return response()->json([
            'id' => $conversation->id,
            'protocol_number' => $conversation->protocol_number,
            'status' => $conversation->status,
            'channel_type' => $conversation->channel?->type,
            'channel_name' => $conversation->channel?->name,
            'assigned_user' => $conversation->assignedUser?->publicSummary(),
            'sector' => $conversation->sector?->only(['id', 'name']),
            'duration_minutes' => $dur,
            'created_at' => $conversation->created_at?->toIso8601String(),
            'last_message_at' => $conversation->last_message_at?->toIso8601String(),
            'messages' => $messages,
            'survey' => $survey,
        ]);
    }

    public function transcribe(Message $message, GroqTranscriptionService $groq): JsonResponse
    {
        $conversation = $message->conversation()->firstOrFail();
        abort_unless($conversation->canBeViewedBy(request()->user()), 403);
        abort_unless($message->type === 'audio', 422, 'Apenas mensagens de áudio podem ser transcritas.');

        if ($message->transcription) {
            return response()->json([
                'status' => 'done',
                'transcription' => $message->transcription,
            ]);
        }

        abort_unless($groq->isConfigured(), 422, 'Transcrição não configurada. Informe a chave Groq em Configurações.');

        TranscribeAudioMessage::dispatch($message->id, $conversation->channel_id);

        return response()->json(['status' => 'queued']);
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

    public function viewing(Request $request, Conversation $conversation): JsonResponse
    {
        abort_unless($conversation->canBeViewedBy($request->user()), 403);

        $data = $request->validate(['viewing' => ['required', 'boolean']]);
        $user = $request->user();

        $key = sprintf('inbox-viewing:%d:%d', $user->id, $conversation->id);

        if (RateLimiter::tooManyAttempts($key, 60)) {
            return response()->json([
                'ok' => true,
                'viewers' => $this->viewing->viewersFor($conversation, $user),
            ]);
        }

        RateLimiter::hit($key, 60);

        if ($data['viewing']) {
            $this->viewing->markViewing($conversation, $user);
        } else {
            $this->viewing->markNotViewing($conversation, $user);
        }

        $viewers = $this->viewing->viewersFor($conversation);

        ConversationViewing::dispatch($conversation, $viewers);

        return response()->json([
            'ok' => true,
            'viewers' => $this->viewing->viewersFor($conversation, $user),
        ]);
    }

    public function snooze(Request $request, Conversation $conversation): RedirectResponse
    {
        abort_unless($conversation->canBeSnoozedBy($request->user()), 403);

        $validated = $request->validate([
            'snoozed_until' => ['required', 'date', 'after:'.now()->addMinutes(4)->toDateTimeString()],
            'note' => ['nullable', 'string', 'max:500'],
        ]);

        $this->snooze->snooze(
            $conversation,
            $request->user(),
            \Illuminate\Support\Carbon::parse($validated['snoozed_until']),
            $validated['note'] ?? null,
        );

        return back()->with('success', 'Lembrete de retorno agendado.');
    }

    public function wake(Request $request, Conversation $conversation): RedirectResponse
    {
        abort_unless($conversation->canBeWokenBy($request->user()), 403);

        $this->snooze->wake($conversation);

        return back()->with('success', 'Conversa retomada.');
    }

    public function transfer(Request $request, Conversation $conversation): RedirectResponse
    {
        $sender = $this->senderFor($conversation);
        abort_unless(
            $conversation->canBeTransferredBy($request->user()),
            403,
            'Sem permissão para transferir esta conversa.',
        );

        $this->snooze->clearSnoozeFields($conversation);

        $validated = $request->validate([
            'sector_id' => ['nullable', 'exists:sectors,id'],
            'user_id'   => ['nullable', 'exists:users,id'],
        ]);

        if (!empty($validated['user_id'])) {
            $targetUser = User::findOrFail($validated['user_id']);

            $conversation->forceFill([
                'assigned_user_id' => $targetUser->id,
                'status'           => Conversation::STATUS_OPEN,
            ])->save();

            return back()->with('success', 'Conversa transferida para ' . $targetUser->name . '.');
        }

        abort_if(empty($validated['sector_id']), 422, 'Informe um setor ou usuário.');

        $sector = Sector::findOrFail($validated['sector_id']);

        $conversation->forceFill([
            'sector_id'        => $sector->id,
            'status'           => Conversation::STATUS_QUEUED,
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

    public function close(Request $request, Conversation $conversation): RedirectResponse
    {
        $sender = $this->senderFor($conversation);
        abort_unless(
            $conversation->canBeActedOnBy(request()->user()),
            403,
            'Conversa atribuída a outro atendente.',
        );

        $isAutoClose = $request->boolean('auto_close');

        // On auto-close, respect the inactivity survey toggle independently.
        if ($isAutoClose && ! AppSetting::bool('survey_on_inactivity_close_enabled', false)) {
            $this->abandonPendingSurveyResponse($conversation);
            $conversation->forceFill([
                'status'    => Conversation::STATUS_CLOSED,
                'sector_id' => null,
            ])->save();
            return back()->with('success', 'Atendimento encerrado por inatividade.');
        }

        // Check if survey should be sent on close
        if (AppSetting::bool('survey_on_close_enabled', false)) {
            $surveyId = AppSetting::get('survey_on_close_survey_id');
            $survey   = $surveyId ? Survey::with('questions')->find((int) $surveyId) : null;

            if ($survey && $survey->is_active && $survey->questions->isNotEmpty()) {
                // Abandon any pre-existing in-progress response before creating a new one
                // (prevents duplicates from double-clicks / request retries).
                $this->abandonPendingSurveyResponse($conversation);

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

                $firstQuestion = $survey->questions->first();
                (new SurveyQuestionSender($sender))
                    ->send($conversation, $firstQuestion, $survey->name);

                return back()->with('success', 'Atendimento encerrado. Pesquisa de satisfação enviada.');
            }
        }

        $conversation->forceFill([
            'status'    => Conversation::STATUS_CLOSED,
            'sector_id' => null,
        ])->save();

        return back()->with('success', 'Atendimento encerrado.');
    }

    public function forceClose(Conversation $conversation): RedirectResponse
    {
        abort_unless(request()->user()->isManager(), 403, 'Apenas administradores e gestores podem forçar o encerramento.');

        $this->abandonPendingSurveyResponse($conversation);

        $conversation->forceFill([
            'status'             => Conversation::STATUS_CLOSED,
            'survey_response_id' => null,
            'sector_id'          => null,
        ])->save();

        return back()->with('success', 'Atendimento encerrado forçadamente.');
    }

    private function abandonPendingSurveyResponse(Conversation $conversation): void
    {
        if ($conversation->survey_response_id) {
            SurveyResponse::where('id', $conversation->survey_response_id)
                ->where('status', SurveyResponse::STATUS_IN_PROGRESS)
                ->update(['status' => SurveyResponse::STATUS_ABANDONED]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function senderFor(Conversation $conversation): MessageSender
    {
        $channel = $conversation->channel;

        $service = match ($channel?->type) {
            Channel::TYPE_TELEGRAM => new TelegramService($channel),
            Channel::TYPE_WEB      => new WebChatService($channel),
            Channel::TYPE_WHATSAPP => new WhatsAppService($channel),
            default                => new WhatsAppService(),
        };

        return new MessageSender($service);
    }

    private function summarize(Conversation $conversation, User $user): array
    {
        $last = $conversation->messages()->latest()->first();

        $unreadCount = $conversation->messages()
            ->where('direction', 'in')
            ->when(
                $conversation->last_read_at,
                fn ($q) => $q->where('created_at', '>', $conversation->last_read_at),
            )
            ->count();

        return [
            'id' => $conversation->id,
            'status' => $conversation->status,
            'channel_type' => $conversation->channel?->type,
            'channel_name' => $conversation->channel?->name,
            'assigned_user_id' => $conversation->assigned_user_id,
            'assigned_user' => $conversation->assignedUser?->publicSummary(),
            'sector' => $conversation->sector?->only(['id', 'name']),
            'tags' => $conversation->contact->tags->map->only(['id', 'name', 'color'])->values()->all(),
            'can_transfer' => $conversation->canBeTransferredBy($user),
            'can_snooze' => $conversation->canBeSnoozedBy($user),
            'can_wake' => $conversation->canBeWokenBy($user),
            'snoozed_until' => $conversation->snoozed_until?->toIso8601String(),
            'snooze_note' => $conversation->snooze_note,
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
            'last_message_status' => $last?->direction === 'out' ? $last?->status : null,
            'unread_count' => $unreadCount,
            'sla' => $this->sla->evaluate($conversation),
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function loadConversation(int $id, User $user): ?array
    {
        $conversation = Conversation::with(['contact.tags:id,name,color', 'assignedUser:id,name,profile_photo_path', 'sector:id,name', 'channel:id,name,type'])->find($id);
        if (! $conversation || ! $conversation->canBeViewedBy($user)) {
            return null;
        }

        if (! $conversation->last_read_at || $conversation->last_read_at->diffInSeconds(now()) > 30) {
            Conversation::whereKey($conversation->id)->update(['last_read_at' => now()]);
        }

        $messages = $conversation->messages()
            ->with('sender:id,name,profile_photo_path')
            ->orderBy('created_at')
            ->limit(200)
            ->get()
            ->map(fn ($m) => $this->formatMessage($m));

        return [
            'id' => $conversation->id,
            'protocol_number' => $conversation->protocol_number,
            'status' => $conversation->status,
            'channel_type' => $conversation->channel?->type,
            'channel_name' => $conversation->channel?->name,
            'assigned_user_id' => $conversation->assigned_user_id,
            'assigned_user' => $conversation->assignedUser?->publicSummary(),
            'sector' => $conversation->sector?->only(['id', 'name']),
            'tags' => $conversation->contact->tags->map->only(['id', 'name', 'color'])->values()->all(),
            'can_act' => $conversation->canBeActedOnBy($user),
            'can_send_internal' => $conversation->canSendInternalNoteBy($user),
            'can_assign' => $conversation->canBeAssignedBy($user),
            'can_transfer' => $conversation->canBeTransferredBy($user),
            'can_force_close' => $user->isManager(),
            'can_snooze' => $conversation->canBeSnoozedBy($user),
            'can_wake' => $conversation->canBeWokenBy($user),
            'snoozed_until' => $conversation->snoozed_until?->toIso8601String(),
            'snooze_note' => $conversation->snooze_note,
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
            'contact_history' => $this->contactHistoryFor($conversation->contact, $conversation->id),
            'sla' => $this->sla->evaluate($conversation),
        ];
    }

    /**
     * @return array{total: int, items: list<array<string, mixed>>}
     */
    private function contactHistoryFor(Contact $contact, int $currentConversationId): array
    {
        $items = Conversation::query()
            ->where('contact_id', $contact->id)
            ->whereKeyNot($currentConversationId)
            ->with([
                'assignedUser:id,name,profile_photo_path',
                'sector:id,name',
                'channel:id,type,name',
                'surveyResponse.answers.question',
                'messages' => fn ($q) => $q->latest()->limit(1),
            ])
            ->withCount('messages')
            ->orderByDesc('created_at')
            ->limit(30)
            ->get()
            ->map(fn (Conversation $c) => $this->summarizeContactHistoryItem($c, $currentConversationId))
            ->values()
            ->all();

        $total = Conversation::where('contact_id', $contact->id)
            ->whereKeyNot($currentConversationId)
            ->count();

        return [
            'total' => $total,
            'items' => $items,
        ];
    }

    /** @return array<string, mixed> */
    private function summarizeContactHistoryItem(Conversation $conversation, int $currentConversationId): array
    {
        $dur = $conversation->created_at && $conversation->last_message_at
            ? (int) $conversation->created_at->diffInMinutes($conversation->last_message_at)
            : null;

        $csatScore = null;
        $surveyCompleted = $conversation->surveyResponse?->isCompleted() ?? false;

        if ($surveyCompleted && $conversation->surveyResponse) {
            $ratingAnswer = $conversation->surveyResponse->answers
                ->first(fn ($a) => $a->question?->is_rating);

            if ($ratingAnswer && is_numeric($ratingAnswer->option_label)) {
                $csatScore = (int) $ratingAnswer->option_label;
            } elseif (is_numeric($conversation->surveyResponse->answers->first()?->option_label)) {
                $csatScore = (int) $conversation->surveyResponse->answers->first()->option_label;
            }
        }

        $lastMessage = $conversation->messages->first();

        return [
            'id' => $conversation->id,
            'protocol_number' => $conversation->protocol_number,
            'status' => $conversation->status,
            'is_current' => $conversation->id === $currentConversationId,
            'channel_type' => $conversation->channel?->type,
            'channel_name' => $conversation->channel?->name,
            'assigned_user' => $conversation->assignedUser?->publicSummary(),
            'sector' => $conversation->sector?->only(['id', 'name']),
            'bot_only' => $conversation->assigned_user_id === null,
            'duration_minutes' => $dur,
            'csat_score' => $csatScore,
            'survey_completed' => $surveyCompleted,
            'message_count' => $conversation->messages_count,
            'created_at' => $conversation->created_at?->toIso8601String(),
            'last_message_at' => $conversation->last_message_at?->toIso8601String(),
            'last_message_preview' => $lastMessage?->body,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function formatMessage(Message $message): array
    {
        return [
            'id' => $message->id,
            'direction' => $message->direction,
            'type' => $message->type,
            'body' => $message->body,
            'media_url' => in_array($message->type, ['image', 'audio', 'video', 'document'], true)
                ? route('inbox.messages.media', $message)
                : null,
            'transcription' => $message->transcription,
            'status' => $message->status,
            'is_internal' => $message->is_internal,
            'sender' => $message->sender?->publicSummary(),
            'created_at' => $message->created_at?->toIso8601String(),
        ];
    }

    private function defaultInboxFilter(User $user): string
    {
        return $user->isManager() ? 'all' : 'mine';
    }

    /**
     * @return array<string, int|string>
     */
    private function inboxIndexParams(
        string $filter,
        ?int $sectorId,
        ?int $filterUserId,
        ?int $tagId,
        string $sort,
        ?string $defaultFilter = null,
    ): array {
        $defaultFilter ??= 'all';
        $params = [];

        if ($filter !== $defaultFilter) {
            $params['filter'] = $filter;
        }
        if ($sectorId !== null) {
            $params['sector_id'] = $sectorId;
        }
        if ($filterUserId !== null) {
            $params['user_id'] = $filterUserId;
        }
        if ($tagId !== null) {
            $params['tag_id'] = $tagId;
        }
        if ($sort !== 'newest') {
            $params['sort'] = $sort;
        }

        return $params;
    }
}
