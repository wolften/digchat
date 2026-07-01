<?php

namespace App\Http\Controllers;

use App\Models\Conversation;
use App\Models\Sector;
use App\Models\Tag;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Inertia\Inertia;
use Inertia\Response;

class HistoricoController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        $dateFrom = $request->string('date_from')->toString() ?: now()->startOfMonth()->toDateString();
        $dateTo   = $request->string('date_to')->toString() ?: now()->toDateString();
        $sectorId = $request->integer('sector_id') ?: null;
        $userId   = $request->integer('user_id') ?: null;
        $tagId    = $request->integer('tag_id') ?: null;
        $search   = $request->string('search')->trim()->toString() ?: null;
        $channel  = $request->string('channel')->trim()->toString() ?: null;
        $contactId = $request->integer('contact_id') ?: null;
        $anchorId = $request->integer('anchor') ?: null;

        if (! $user->isManager()) {
            $userId = null;
        }

        $base = fn () => Conversation::query()
            ->historicoVisibleTo($user)
            ->when($contactId, function ($q) use ($contactId) {
                $q->where('contact_id', $contactId);
            }, function ($q) use ($dateFrom, $dateTo) {
                $q->whereIn('status', [Conversation::STATUS_CLOSED, Conversation::STATUS_SURVEYING])
                    ->whereDate('created_at', '>=', $dateFrom)
                    ->whereDate('created_at', '<=', $dateTo);
            })
            ->when($sectorId, fn ($q) => $q->where('sector_id', $sectorId))
            ->when($userId, fn ($q) => $q->where('assigned_user_id', $userId))
            ->when($tagId, fn ($q) => $q->whereHas('contact.tags', fn ($q2) => $q2->where('tags.id', $tagId)))
            ->when($channel, fn ($q) => $q->whereHas('channel', fn ($q2) => $q2->where('type', $channel)))
            ->when($search, fn ($q) => $q
                ->where('protocol_number', 'like', "%{$search}%")
                ->orWhereHas('contact', fn ($q2) => $q2
                    ->where('name', 'like', "%{$search}%")
                    ->orWhere('wa_id', 'like', "%{$search}%")
                )
            );

        $total      = $base()->count();
        $botOnly    = $base()->whereNull('assigned_user_id')->count();
        $avgMins    = $this->averageDurationMinutes($base);
        $surveyDone = $base()
            ->whereHas('surveyResponse', fn ($q) => $q->where('status', 'completed'))
            ->count();

        $conversations = $base()
            ->with(['contact.tags:id,name,color', 'assignedUser:id,name,profile_photo_path', 'sector:id,name', 'surveyResponse.answers', 'channel:id,type,name'])
            ->orderByDesc('last_message_at')
            ->paginate(40)
            ->through(fn (Conversation $c) => $this->summarize($c));

        $selected = null;
        if ($request->filled('conversation')) {
            $selected = $this->detail(
                (int) $request->integer('conversation'),
                $user,
                $anchorId > 0 ? $anchorId : null,
            );
        }

        return Inertia::render('Historico/Index', [
            'conversations' => $conversations,
            'selected'      => $selected,
            'sectors'       => Sector::orderBy('name')->get(['id', 'name']),
            'users'         => $user->isManager()
                ? User::where('is_active', true)->orderBy('name')->get(['id', 'name'])
                : collect(),
            'tags'          => Tag::where('is_active', true)->orderBy('name')->get(['id', 'name', 'color']),
            'stats'         => [
                'total'                => $total,
                'avg_duration_minutes' => $avgMins ? (int) round((float) $avgMins) : null,
                'bot_only_pct'         => $total > 0 ? (int) round(($botOnly / $total) * 100) : 0,
                'survey_completed'     => $surveyDone,
            ],
            'filters' => [
                'date_from'  => $dateFrom,
                'date_to'    => $dateTo,
                'sector_id'  => $sectorId,
                'user_id'    => $userId,
                'tag_id'     => $tagId,
                'search'     => $search,
                'channel'    => $channel,
                'contact_id' => $contactId,
                'anchor'     => $anchorId ?: null,
            ],
            'can_export' => $user->isManager(),
            'contact_view' => $contactId !== null,
        ]);
    }

    public function export(Request $request): HttpResponse
    {
        abort_unless($request->user()->isManager(), 403);

        $dateFrom = $request->string('date_from')->toString() ?: now()->startOfMonth()->toDateString();
        $dateTo   = $request->string('date_to')->toString() ?: now()->toDateString();
        $sectorId = $request->integer('sector_id') ?: null;
        $userId   = $request->integer('user_id') ?: null;

        $rows = Conversation::query()
            ->whereIn('status', [Conversation::STATUS_CLOSED, Conversation::STATUS_SURVEYING])
            ->whereDate('created_at', '>=', $dateFrom)
            ->whereDate('created_at', '<=', $dateTo)
            ->when($sectorId, fn ($q) => $q->where('sector_id', $sectorId))
            ->when($userId, fn ($q) => $q->where('assigned_user_id', $userId))
            ->with(['contact', 'assignedUser:id,name,profile_photo_path', 'sector:id,name', 'surveyResponse.answers'])
            ->orderByDesc('last_message_at')
            ->limit(2000)
            ->get();

        $csv = "\xEF\xBB\xBF"; // UTF-8 BOM para Excel
        $csv .= "Protocolo,ID,Contato,Telefone,Setor,Atendente,Duracao (min),Pesquisa,Data\n";

        foreach ($rows as $c) {
            $dur = $c->created_at && $c->last_message_at
                ? (int) $c->created_at->diffInMinutes($c->last_message_at)
                : '';
            $surveyAns = ($c->surveyResponse?->isCompleted())
                ? ($c->surveyResponse->answers->first()?->option_label ?? 'Respondida')
                : '';
            $csv .= implode(',', [
                $c->protocol_number ?? '',
                $c->id,
                '"'.str_replace('"', '""', $c->contact->displayName()).'"',
                $c->contact->wa_id,
                '"'.str_replace('"', '""', $c->sector?->name ?? '').'"',
                '"'.str_replace('"', '""', $c->assignedUser?->name ?? 'Bot').'"',
                $dur,
                '"'.str_replace('"', '""', $surveyAns).'"',
                $c->last_message_at?->format('d/m/Y H:i') ?? '',
            ])."\n";
        }

        return response($csv, 200, [
            'Content-Type'        => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="historico-'.$dateFrom.'-a-'.$dateTo.'.csv"',
        ]);
    }

    /** @return array<string, mixed> */
    private function summarize(Conversation $conversation): array
    {
        $dur = $conversation->created_at && $conversation->last_message_at
            ? (int) $conversation->created_at->diffInMinutes($conversation->last_message_at)
            : null;

        $surveyAns = $conversation->surveyResponse?->isCompleted()
            ? $conversation->surveyResponse->answers->first()?->option_label
            : null;

        return [
            'id'               => $conversation->id,
            'protocol_number'  => $conversation->protocol_number,
            'status'           => $conversation->status,
            'contact'          => [
                'id'    => $conversation->contact->id,
                'name'  => $conversation->contact->displayName(),
                'wa_id' => $conversation->contact->wa_id,
            ],
            'assigned_user'    => $conversation->assignedUser?->publicSummary(),
            'sector'           => $conversation->sector?->only(['id', 'name']),
            'tags'             => $conversation->contact->tags->map->only(['id', 'name', 'color'])->values()->all(),
            'bot_only'         => $conversation->assigned_user_id === null,
            'duration_minutes' => $dur,
            'survey_answer'    => $surveyAns,
            'survey_completed' => $conversation->surveyResponse?->isCompleted() ?? false,
            'last_message_at'  => $conversation->last_message_at?->toIso8601String(),
            'created_at'       => $conversation->created_at?->toIso8601String(),
            'channel_type'     => $conversation->channel?->type,
            'channel_name'     => $conversation->channel?->name,
        ];
    }

    /** @return array<string, mixed>|null */
    private function detail(int $id, User $user, ?int $anchorId = null): ?array
    {
        $conversation = Conversation::with([
            'contact',
            'assignedUser:id,name,profile_photo_path',
            'sector:id,name',
            'channel:id,type,name',
            'surveyResponse.answers',
        ])->find($id);

        if (! $conversation) {
            return null;
        }

        $anchor = $anchorId ? Conversation::find($anchorId) : null;
        abort_unless($conversation->canBeViewedInHistoricoBy($user, $anchor), 403);

        $messages = $conversation->messages()
            ->with('sender:id,name,profile_photo_path')
            ->orderBy('created_at')
            ->limit(300)
            ->get()
            ->map(fn ($m) => [
                'id'         => $m->id,
                'direction'  => $m->direction,
                'type'       => $m->type,
                'body'       => $m->body,
                'media_url'  => in_array($m->type, ['image', 'audio', 'video', 'document'], true)
                    ? route('inbox.messages.media', $m) : null,
                'is_internal' => $m->is_internal,
                'sender'     => $m->sender?->publicSummary(),
                'created_at' => $m->created_at?->toIso8601String(),
            ]);

        $survey = null;
        if ($conversation->surveyResponse) {
            $sr = $conversation->surveyResponse;
            $survey = [
                'status'       => $sr->status,
                'completed_at' => $sr->completed_at?->toIso8601String(),
                'answers'      => $sr->answers->map(fn ($a) => [
                    'option_label' => $a->option_label,
                ])->values(),
            ];
        }

        $dur = $conversation->created_at && $conversation->last_message_at
            ? (int) $conversation->created_at->diffInMinutes($conversation->last_message_at)
            : null;

        return [
            'id'               => $conversation->id,
            'protocol_number'  => $conversation->protocol_number,
            'status'           => $conversation->status,
            'contact'          => [
                'id'    => $conversation->contact->id,
                'name'  => $conversation->contact->displayName(),
                'wa_id' => $conversation->contact->wa_id,
            ],
            'assigned_user'    => $conversation->assignedUser?->publicSummary(),
            'sector'           => $conversation->sector?->only(['id', 'name']),
            'channel_type'     => $conversation->channel?->type,
            'channel_name'     => $conversation->channel?->name,
            'duration_minutes' => $dur,
            'created_at'       => $conversation->created_at?->toIso8601String(),
            'last_message_at'  => $conversation->last_message_at?->toIso8601String(),
            'messages'         => $messages,
            'survey'           => $survey,
        ];
    }

    private function averageDurationMinutes(\Closure $baseQuery): ?float
    {
        $conversations = $baseQuery()
            ->whereNotNull('last_message_at')
            ->get(['created_at', 'last_message_at']);

        if ($conversations->isEmpty()) {
            return null;
        }

        return $conversations->avg(
            fn (Conversation $conversation) => $conversation->created_at->diffInMinutes($conversation->last_message_at),
        );
    }
}