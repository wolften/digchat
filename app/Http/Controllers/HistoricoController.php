<?php

namespace App\Http\Controllers;

use App\Models\Conversation;
use App\Models\Sector;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Inertia\Inertia;
use Inertia\Response;

class HistoricoController extends Controller
{
    public function index(Request $request): Response
    {
        $dateFrom = $request->string('date_from')->toString() ?: now()->startOfMonth()->toDateString();
        $dateTo   = $request->string('date_to')->toString() ?: now()->toDateString();
        $sectorId = $request->integer('sector_id') ?: null;
        $userId   = $request->integer('user_id') ?: null;
        $search   = $request->string('search')->trim()->toString() ?: null;
        $channel  = $request->string('channel')->trim()->toString() ?: null;

        $base = fn () => Conversation::query()
            ->whereIn('status', [Conversation::STATUS_CLOSED, Conversation::STATUS_SURVEYING])
            ->whereDate('created_at', '>=', $dateFrom)
            ->whereDate('created_at', '<=', $dateTo)
            ->when($sectorId, fn ($q) => $q->where('sector_id', $sectorId))
            ->when($userId, fn ($q) => $q->where('assigned_user_id', $userId))
            ->when($channel, fn ($q) => $q->whereHas('channel', fn ($q2) => $q2->where('type', $channel)))
            ->when($search, fn ($q) => $q->whereHas('contact', fn ($q2) => $q2
                ->where('name', 'like', "%{$search}%")
                ->orWhere('wa_id', 'like', "%{$search}%")
            ));

        $total      = $base()->count();
        $botOnly    = $base()->whereNull('assigned_user_id')->count();
        $avgMins    = $base()->whereNotNull('last_message_at')
            ->selectRaw('AVG(TIMESTAMPDIFF(MINUTE, created_at, last_message_at)) as v')
            ->value('v');
        $surveyDone = $base()
            ->whereHas('surveyResponse', fn ($q) => $q->where('status', 'completed'))
            ->count();

        $conversations = $base()
            ->with(['contact', 'assignedUser:id,name', 'sector:id,name', 'surveyResponse.answers', 'channel:id,type,name'])
            ->orderByDesc('last_message_at')
            ->paginate(40)
            ->through(fn (Conversation $c) => $this->summarize($c));

        $selected = null;
        if ($request->filled('conversation')) {
            $selected = $this->detail((int) $request->integer('conversation'));
        }

        return Inertia::render('Historico/Index', [
            'conversations' => $conversations,
            'selected'      => $selected,
            'sectors'       => Sector::orderBy('name')->get(['id', 'name']),
            'users'         => User::where('is_active', true)->orderBy('name')->get(['id', 'name']),
            'stats'         => [
                'total'                => $total,
                'avg_duration_minutes' => $avgMins ? (int) round((float) $avgMins) : null,
                'bot_only_pct'         => $total > 0 ? (int) round(($botOnly / $total) * 100) : 0,
                'survey_completed'     => $surveyDone,
            ],
            'filters' => [
                'date_from' => $dateFrom,
                'date_to'   => $dateTo,
                'sector_id' => $sectorId,
                'user_id'   => $userId,
                'search'    => $search,
                'channel'   => $channel,
            ],
        ]);
    }

    public function export(Request $request): HttpResponse
    {
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
            ->with(['contact', 'assignedUser:id,name', 'sector:id,name', 'surveyResponse.answers'])
            ->orderByDesc('last_message_at')
            ->limit(2000)
            ->get();

        $csv = "\xEF\xBB\xBF"; // UTF-8 BOM para Excel
        $csv .= "ID,Contato,Telefone,Setor,Atendente,Duracao (min),Pesquisa,Data\n";

        foreach ($rows as $c) {
            $dur = $c->created_at && $c->last_message_at
                ? (int) $c->created_at->diffInMinutes($c->last_message_at)
                : '';
            $surveyAns = ($c->surveyResponse?->isCompleted())
                ? ($c->surveyResponse->answers->first()?->option_label ?? 'Respondida')
                : '';
            $csv .= implode(',', [
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
            'contact'          => [
                'id'    => $conversation->contact->id,
                'name'  => $conversation->contact->displayName(),
                'wa_id' => $conversation->contact->wa_id,
            ],
            'assigned_user'    => $conversation->assignedUser?->only(['id', 'name']),
            'sector'           => $conversation->sector?->only(['id', 'name']),
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

    /** @return array<string, mixed> */
    private function detail(int $id): array
    {
        $c = Conversation::with([
            'contact',
            'assignedUser:id,name',
            'sector:id,name',
            'surveyResponse.answers',
        ])->findOrFail($id);

        $messages = $c->messages()
            ->with('sender:id,name')
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
                'sender'     => $m->sender?->only(['id', 'name']),
                'created_at' => $m->created_at?->toIso8601String(),
            ]);

        $survey = null;
        if ($c->surveyResponse) {
            $sr = $c->surveyResponse;
            $survey = [
                'status'       => $sr->status,
                'completed_at' => $sr->completed_at?->toIso8601String(),
                'answers'      => $sr->answers->map(fn ($a) => [
                    'option_label' => $a->option_label,
                ])->values(),
            ];
        }

        $dur = $c->created_at && $c->last_message_at
            ? (int) $c->created_at->diffInMinutes($c->last_message_at)
            : null;

        return [
            'id'               => $c->id,
            'contact'          => [
                'id'    => $c->contact->id,
                'name'  => $c->contact->displayName(),
                'wa_id' => $c->contact->wa_id,
            ],
            'assigned_user'    => $c->assignedUser?->only(['id', 'name']),
            'sector'           => $c->sector?->only(['id', 'name']),
            'duration_minutes' => $dur,
            'created_at'       => $c->created_at?->toIso8601String(),
            'last_message_at'  => $c->last_message_at?->toIso8601String(),
            'messages'         => $messages,
            'survey'           => $survey,
        ];
    }
}
