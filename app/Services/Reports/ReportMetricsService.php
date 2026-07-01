<?php

namespace App\Services\Reports;

use App\Models\Contact;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\Sector;
use App\Models\SurveyAnswer;
use App\Models\Tag;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class ReportMetricsService
{
    public function parseFilters(array $input): array
    {
        return [
            'date_from' => $input['date_from'] ?? now()->startOfMonth()->toDateString(),
            'date_to'   => $input['date_to'] ?? now()->toDateString(),
            'sector_id' => ! empty($input['sector_id']) ? (int) $input['sector_id'] : null,
            'user_id'   => ! empty($input['user_id']) ? (int) $input['user_id'] : null,
            'tag_id'    => ! empty($input['tag_id']) ? (int) $input['tag_id'] : null,
            'channel'   => ! empty($input['channel']) ? (string) $input['channel'] : null,
            'tab'       => in_array($input['tab'] ?? '', ['atendimentos', 'atendentes', 'clientes'], true)
                ? $input['tab']
                : 'atendimentos',
        ];
    }

    public function baseQuery(array $filters): Builder
    {
        return Conversation::query()
            ->whereDate('created_at', '>=', $filters['date_from'])
            ->whereDate('created_at', '<=', $filters['date_to'])
            ->when($filters['sector_id'], fn ($q) => $q->where('sector_id', $filters['sector_id']))
            ->when($filters['user_id'], fn ($q) => $q->where('assigned_user_id', $filters['user_id']))
            ->when($filters['tag_id'], fn ($q) => $q->whereHas('contact.tags', fn ($q2) => $q2->where('tags.id', $filters['tag_id'])))
            ->when($filters['channel'], fn ($q) => $q->whereHas('channel', fn ($q2) => $q2->where('type', $filters['channel'])));
    }

    public function atendimentosMetrics(array $filters): array
    {
        $base = fn () => $this->baseQuery($filters);

        $totalCreated = $base()->count();
        $closedCount  = $base()->where('status', Conversation::STATUS_CLOSED)->count();
        $botOnly      = $base()->whereNull('assigned_user_id')->count();
        $resolutionRate = $totalCreated > 0 ? (int) round(($closedCount / $totalCreated) * 100) : 0;
        $botOnlyPct   = $totalCreated > 0 ? (int) round(($botOnly / $totalCreated) * 100) : 0;

        $avgHandlingMins = (int) $base()
            ->where('status', Conversation::STATUS_CLOSED)
            ->selectRaw('COALESCE(AVG(' . $this->sqlMinutesBetween('created_at', 'updated_at') . '), 0) as v')
            ->value('v');

        $avgTmeMins = (int) $base()
            ->where('status', Conversation::STATUS_CLOSED)
            ->whereNotNull('queued_at')
            ->whereNotNull('first_response_at')
            ->whereRaw('first_response_at > queued_at')
            ->selectRaw('COALESCE(AVG(' . $this->sqlMinutesBetween('queued_at', 'first_response_at') . '), 0) as v')
            ->value('v');

        $surveyTotal = $base()
            ->whereHas('surveyResponse')
            ->count();
        $surveyCompleted = $base()
            ->whereHas('surveyResponse', fn ($q) => $q->where('status', 'completed'))
            ->count();
        $surveyCompletionRate = $surveyTotal > 0
            ? (int) round(($surveyCompleted / $surveyTotal) * 100)
            : 0;

        $csat = $this->avgCsatForFilters($filters);

        return [
            'total_created'          => $totalCreated,
            'closed'                 => $closedCount,
            'resolution_rate'        => $resolutionRate,
            'avg_handling_mins'      => $avgHandlingMins,
            'avg_tme_mins'           => $avgTmeMins,
            'bot_only_pct'           => $botOnlyPct,
            'survey_completion_rate' => $surveyCompletionRate,
            'survey_completed'       => $surveyCompleted,
            'avg_csat'               => $csat['avg'],
            'csat_count'             => $csat['count'],
            'volume_data'            => $this->buildDailyVolume($filters),
            'channel_stats'          => $this->channelStats($filters),
            'sector_stats'           => $this->sectorStats($filters),
            'tag_stats'              => $this->tagStats($filters),
            'hourly_stats'           => $this->hourlyStats($filters),
            'status_stats'           => $this->statusStats($filters),
        ];
    }

    public function atendentesMetrics(array $filters): array
    {
        $attendants = $this->attendantRows($filters);
        $withActivity = $attendants->filter(fn ($a) => $a['closed'] > 0 || $a['messages_sent'] > 0);
        $totalClosed  = $withActivity->sum('closed');
        $avgClosed    = $withActivity->count() > 0
            ? (int) round($totalClosed / $withActivity->count())
            : 0;

        $bestCsat = $withActivity
            ->filter(fn ($a) => $a['avg_csat'] !== null)
            ->sortByDesc('avg_csat')
            ->first();

        return [
            'active_count'    => $withActivity->count(),
            'avg_closed'      => $avgClosed,
            'best_csat_name'  => $bestCsat['name'] ?? null,
            'best_csat_value' => $bestCsat['avg_csat'] ?? null,
            'attendants'      => $attendants->values()->all(),
        ];
    }

    public function clientesMetrics(array $filters): array
    {
        $base = $this->baseQuery($filters);
        $contactIds = (clone $base)->distinct()->pluck('contact_id');

        $uniqueContacts = $contactIds->count();

        $repeatContactIds = (clone $base)
            ->selectRaw('contact_id, COUNT(*) as total')
            ->groupBy('contact_id')
            ->havingRaw('COUNT(*) >= 2')
            ->pluck('contact_id');

        $returningCount = $repeatContactIds->count();
        $returnRate     = $uniqueContacts > 0
            ? (int) round(($returningCount / $uniqueContacts) * 100)
            : 0;

        $newContacts = $this->countNewContacts($filters);

        $ixcLinked = Contact::query()
            ->whereIn('id', $contactIds)
            ->whereNotNull('ixc_customer_id')
            ->count();

        $channelStats = Contact::query()
            ->with('channel')
            ->whereIn('id', $contactIds)
            ->selectRaw('channel_id, COUNT(*) as total')
            ->groupBy('channel_id')
            ->orderByDesc('total')
            ->get()
            ->map(fn ($row) => [
                'name'  => $row->channel?->name ?? 'Desconhecido',
                'type'  => $row->channel?->type ?? 'whatsapp',
                'total' => (int) $row->total,
            ]);

        $topClients = (clone $base)
            ->selectRaw('contact_id, COUNT(*) as total, MAX(created_at) as last_at, MIN(created_at) as first_at')
            ->groupBy('contact_id')
            ->orderByDesc('total')
            ->limit(15)
            ->get();

        $contacts = Contact::with('channel')
            ->whereIn('id', $topClients->pluck('contact_id'))
            ->get()
            ->keyBy('id');

        $topClientsList = $topClients->map(function ($row) use ($contacts) {
            $contact = $contacts->get($row->contact_id);

            return [
                'contact_id'   => (int) $row->contact_id,
                'name'         => $contact?->displayName() ?? 'Desconhecido',
                'wa_id'        => $contact?->wa_id ?? '',
                'channel_type' => $contact?->channel?->type ?? null,
                'channel_name' => $contact?->channel?->name ?? null,
                'conversations'=> (int) $row->total,
                'first_at'     => $row->first_at,
                'last_at'      => $row->last_at,
                'ixc_linked'   => $contact?->ixc_customer_id !== null,
            ];
        })->values()->all();

        return [
            'unique_contacts'  => $uniqueContacts,
            'new_contacts'     => $newContacts,
            'returning_count'  => $returningCount,
            'return_rate'      => $returnRate,
            'ixc_linked'       => $ixcLinked,
            'channel_stats'    => $channelStats,
            'top_clients'      => $topClientsList,
        ];
    }

    public function filterOptions(): array
    {
        return [
            'sectors' => Sector::orderBy('name')->get(['id', 'name']),
            'users'   => User::where('is_active', true)->orderBy('name')->get(['id', 'name']),
            'tags'    => Tag::where('is_active', true)->orderBy('name')->get(['id', 'name', 'color']),
        ];
    }

    public function attendantRows(array $filters): Collection
    {
        $minsBetween = $this->sqlMinutesBetween('created_at', 'updated_at');
        $tmeBetween  = $this->sqlMinutesBetween('queued_at', 'first_response_at');

        $closedStats = $this->baseQuery($filters)
            ->where('status', Conversation::STATUS_CLOSED)
            ->whereNotNull('assigned_user_id')
            ->selectRaw("assigned_user_id, COUNT(*) as closed, COALESCE(AVG({$minsBetween}), 0) as avg_mins, COALESCE(AVG(CASE WHEN queued_at IS NOT NULL AND first_response_at IS NOT NULL AND first_response_at > queued_at THEN {$tmeBetween} END), 0) as avg_tme")
            ->groupBy('assigned_user_id')
            ->get()
            ->keyBy('assigned_user_id');

        $openStats = Conversation::query()
            ->where('status', Conversation::STATUS_OPEN)
            ->whereNotNull('assigned_user_id')
            ->selectRaw('assigned_user_id, COUNT(*) as open')
            ->groupBy('assigned_user_id')
            ->get()
            ->keyBy('assigned_user_id');

        $messageStats = Message::query()
            ->where('direction', 'out')
            ->whereNotNull('sender_user_id')
            ->whereHas('conversation', function ($q) use ($filters) {
                $q->whereDate('created_at', '>=', $filters['date_from'])
                    ->whereDate('created_at', '<=', $filters['date_to']);
            })
            ->selectRaw('sender_user_id, COUNT(*) as total')
            ->groupBy('sender_user_id')
            ->get()
            ->keyBy('sender_user_id');

        $csatByUser = $this->csatByAttendant($filters);

        $userIds = collect()
            ->merge($closedStats->keys())
            ->merge($openStats->keys())
            ->merge($messageStats->keys())
            ->unique()
            ->filter();

        $users = User::whereIn('id', $userIds)->orderBy('name')->get()->keyBy('id');

        return $userIds->map(function ($userId) use ($closedStats, $openStats, $messageStats, $csatByUser, $users) {
            $closed = $closedStats->get($userId);
            $csat   = $csatByUser->get($userId);

            return [
                'user_id'        => (int) $userId,
                'name'           => $users->get($userId)?->name ?? 'Desconhecido',
                'profile_photo_url' => $users->get($userId)?->profile_photo_url,
                'closed'         => (int) ($closed?->closed ?? 0),
                'open'           => (int) ($openStats->get($userId)?->open ?? 0),
                'messages_sent'  => (int) ($messageStats->get($userId)?->total ?? 0),
                'avg_mins'       => (int) ($closed?->avg_mins ?? 0),
                'avg_tme_mins'   => (int) ($closed?->avg_tme ?? 0),
                'avg_csat'       => $csat['avg'] ?? null,
                'csat_count'     => $csat['count'] ?? 0,
            ];
        })->sortByDesc('closed')->values();
    }

    private function avgCsatForFilters(array $filters): array
    {
        $query = SurveyAnswer::query()
            ->join('survey_questions as sq', 'survey_answers.survey_question_id', '=', 'sq.id')
            ->join('survey_responses as sr', 'survey_answers.survey_response_id', '=', 'sr.id')
            ->join('conversations as c', 'sr.conversation_id', '=', 'c.id')
            ->where('sq.is_rating', true)
            ->where('sr.status', 'completed')
            ->whereDate('c.created_at', '>=', $filters['date_from'])
            ->whereDate('c.created_at', '<=', $filters['date_to']);

        if ($filters['sector_id']) {
            $query->where('c.sector_id', $filters['sector_id']);
        }
        if ($filters['user_id']) {
            $query->where('c.assigned_user_id', $filters['user_id']);
        }
        if ($filters['channel']) {
            $query->join('channels as ch', 'c.channel_id', '=', 'ch.id')
                ->where('ch.type', $filters['channel']);
        }
        if ($filters['tag_id']) {
            $query->whereExists(function ($q) use ($filters) {
                $q->select(DB::raw(1))
                    ->from('contact_tag')
                    ->whereColumn('contact_tag.contact_id', 'c.contact_id')
                    ->where('contact_tag.tag_id', $filters['tag_id']);
            });
        }

        $row = $query->selectRaw('COALESCE(AVG(CAST(survey_answers.option_label AS DECIMAL(5,2))), 0) as avg_csat, COUNT(*) as csat_count')
            ->first();

        $count = (int) ($row?->csat_count ?? 0);

        return [
            'avg'   => $count > 0 ? round((float) $row->avg_csat, 1) : null,
            'count' => $count,
        ];
    }

    private function csatByAttendant(array $filters): Collection
    {
        $query = SurveyAnswer::query()
            ->join('survey_questions as sq', 'survey_answers.survey_question_id', '=', 'sq.id')
            ->join('survey_responses as sr', 'survey_answers.survey_response_id', '=', 'sr.id')
            ->join('conversations as c', 'sr.conversation_id', '=', 'c.id')
            ->where('sq.is_rating', true)
            ->where('sr.status', 'completed')
            ->whereNotNull('c.assigned_user_id')
            ->whereDate('c.created_at', '>=', $filters['date_from'])
            ->whereDate('c.created_at', '<=', $filters['date_to']);

        if ($filters['sector_id']) {
            $query->where('c.sector_id', $filters['sector_id']);
        }
        if ($filters['user_id']) {
            $query->where('c.assigned_user_id', $filters['user_id']);
        }
        if ($filters['channel']) {
            $query->join('channels as ch', 'c.channel_id', '=', 'ch.id')
                ->where('ch.type', $filters['channel']);
        }
        if ($filters['tag_id']) {
            $query->whereExists(function ($q) use ($filters) {
                $q->select(DB::raw(1))
                    ->from('contact_tag')
                    ->whereColumn('contact_tag.contact_id', 'c.contact_id')
                    ->where('contact_tag.tag_id', $filters['tag_id']);
            });
        }

        return $query
            ->selectRaw('c.assigned_user_id as user_id, COALESCE(AVG(CAST(survey_answers.option_label AS DECIMAL(5,2))), 0) as avg_csat, COUNT(*) as csat_count')
            ->groupBy('c.assigned_user_id')
            ->get()
            ->mapWithKeys(fn ($row) => [
                $row->user_id => [
                    'avg'   => (int) $row->csat_count > 0 ? round((float) $row->avg_csat, 1) : null,
                    'count' => (int) $row->csat_count,
                ],
            ]);
    }

    private function buildDailyVolume(array $filters): array
    {
        $start = Carbon::parse($filters['date_from'])->startOfDay();
        $end   = Carbon::parse($filters['date_to'])->endOfDay();

        $rows = $this->baseQuery($filters)
            ->selectRaw('DATE(created_at) as d, COUNT(*) as total')
            ->groupByRaw('DATE(created_at)')
            ->orderByRaw('DATE(created_at)')
            ->get()
            ->keyBy('d');

        $days = [];
        for ($date = $start->copy(); $date->lte($end); $date->addDay()) {
            $key    = $date->toDateString();
            $days[] = [
                'label' => $date->format('d/m'),
                'count' => (int) ($rows->get($key)?->total ?? 0),
            ];
        }

        return $days;
    }

    private function channelStats(array $filters): array
    {
        return $this->baseQuery($filters)
            ->with('channel')
            ->selectRaw('channel_id, COUNT(*) as total')
            ->whereNotNull('channel_id')
            ->groupBy('channel_id')
            ->orderByDesc('total')
            ->get()
            ->map(fn ($row) => [
                'name'  => $row->channel?->name ?? 'Desconhecido',
                'type'  => $row->channel?->type ?? 'whatsapp',
                'total' => (int) $row->total,
            ])
            ->all();
    }

    private function sectorStats(array $filters): array
    {
        return $this->baseQuery($filters)
            ->with('sector')
            ->selectRaw('sector_id, COUNT(*) as total')
            ->whereNotNull('sector_id')
            ->groupBy('sector_id')
            ->orderByDesc('total')
            ->limit(8)
            ->get()
            ->map(fn ($row) => [
                'name'  => $row->sector?->name ?? 'Desconhecido',
                'total' => (int) $row->total,
            ])
            ->all();
    }

    private function tagStats(array $filters): array
    {
        return DB::table('contact_tag')
            ->join('conversations', 'contact_tag.contact_id', '=', 'conversations.contact_id')
            ->join('tags', 'contact_tag.tag_id', '=', 'tags.id')
            ->whereDate('conversations.created_at', '>=', $filters['date_from'])
            ->whereDate('conversations.created_at', '<=', $filters['date_to'])
            ->when($filters['sector_id'], fn ($q) => $q->where('conversations.sector_id', $filters['sector_id']))
            ->when($filters['user_id'], fn ($q) => $q->where('conversations.assigned_user_id', $filters['user_id']))
            ->when($filters['channel'], function ($q) use ($filters) {
                $q->join('channels', 'conversations.channel_id', '=', 'channels.id')
                    ->where('channels.type', $filters['channel']);
            })
            ->when($filters['tag_id'], fn ($q) => $q->where('contact_tag.tag_id', $filters['tag_id']))
            ->selectRaw('tags.id, tags.name, tags.color, COUNT(*) as total')
            ->groupBy('tags.id', 'tags.name', 'tags.color')
            ->orderByDesc('total')
            ->limit(8)
            ->get()
            ->map(fn ($row) => [
                'id'    => (int) $row->id,
                'name'  => $row->name,
                'color' => $row->color,
                'total' => (int) $row->total,
            ])
            ->all();
    }

    private function hourlyStats(array $filters): array
    {
        $hourExpr = $this->sqlHourExpression('created_at');
        $rows = $this->baseQuery($filters)
            ->selectRaw("{$hourExpr} as h, COUNT(*) as total")
            ->groupByRaw($hourExpr)
            ->orderByRaw($hourExpr)
            ->get()
            ->keyBy('h');

        return collect(range(0, 23))
            ->map(fn ($h) => [
                'label' => sprintf('%02dh', $h),
                'count' => (int) ($rows->get($h)?->total ?? 0),
            ])
            ->all();
    }

    private function statusStats(array $filters): array
    {
        $labels = [
            Conversation::STATUS_CLOSED    => 'Encerrado',
            Conversation::STATUS_OPEN      => 'Em atendimento',
            Conversation::STATUS_QUEUED    => 'Na fila',
            Conversation::STATUS_BOT       => 'No bot',
            Conversation::STATUS_SURVEYING => 'Em pesquisa',
            Conversation::STATUS_SNOOZED   => 'Adiada',
        ];

        return $this->baseQuery($filters)
            ->selectRaw('status, COUNT(*) as total')
            ->groupBy('status')
            ->orderByDesc('total')
            ->get()
            ->map(fn ($row) => [
                'status' => $row->status,
                'label'  => $labels[$row->status] ?? $row->status,
                'total'  => (int) $row->total,
            ])
            ->all();
    }

    private function countNewContacts(array $filters): int
    {
        $start = $filters['date_from'];
        $end   = $filters['date_to'];

        return Contact::query()
            ->whereHas('conversations', function ($q) use ($start, $end) {
                $q->whereDate('created_at', '>=', $start)
                    ->whereDate('created_at', '<=', $end);
            })
            ->whereDoesntHave('conversations', function ($q) use ($start) {
                $q->whereDate('created_at', '<', $start);
            })
            ->count();
    }

    public function sqlMinutesBetween(string $from, string $to): string
    {
        if (DB::connection()->getDriverName() === 'sqlite') {
            return "CAST((julianday({$to}) - julianday({$from})) * 1440 AS INTEGER)";
        }

        return "TIMESTAMPDIFF(MINUTE, {$from}, {$to})";
    }

    private function sqlHourExpression(string $column): string
    {
        return DB::connection()->getDriverName() === 'sqlite'
            ? "CAST(strftime('%H', {$column}) AS INTEGER)"
            : "HOUR({$column})";
    }
}