<?php

namespace App\Http\Controllers;

use App\Models\Conversation;
use App\Models\SurveyAnswer;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class DashboardController extends Controller
{
    public function index(Request $request)
    {
        $period = $request->query('period', 'today');

        $from = match ($period) {
            'week'  => Carbon::now()->startOfWeek(),
            'month' => Carbon::now()->startOfMonth(),
            'all'   => null,
            default => Carbon::now()->startOfDay(),
        };

        // ── Live counts (sem filtro de período) ─────────────────
        $queuedCount    = Conversation::where('status', Conversation::STATUS_QUEUED)->count();
        $openCount      = Conversation::where('status', Conversation::STATUS_OPEN)->count();
        $botCount       = Conversation::where('status', Conversation::STATUS_BOT)->count();
        $surveyingCount = Conversation::where('status', Conversation::STATUS_SURVEYING)->count();

        $avgWaitMins = (int) Conversation::where('status', Conversation::STATUS_QUEUED)
            ->selectRaw(
                'COALESCE(AVG(' . $this->sqlMinutesBetween('COALESCE(queued_at, updated_at)', $this->sqlTimestamp(now())) . '), 0) as avg_mins'
            )
            ->value('avg_mins');

        // ── Métricas do período ─────────────────────────────────
        $closedQuery = Conversation::where('status', Conversation::STATUS_CLOSED);
        if ($from) {
            $closedQuery->where('updated_at', '>=', $from);
        }
        $closedCount = $closedQuery->count();

        $totalCreatedQuery = Conversation::query();
        if ($from) {
            $totalCreatedQuery->where('created_at', '>=', $from);
        }
        $totalCreated   = $totalCreatedQuery->count();
        $resolutionRate = $totalCreated > 0 ? round(($closedCount / $totalCreated) * 100) : 0;

        $avgHandlingQuery = Conversation::where('status', Conversation::STATUS_CLOSED)
            ->selectRaw('COALESCE(AVG(' . $this->sqlMinutesBetween('created_at', 'updated_at') . '), 0) as avg_mins');
        if ($from) {
            $avgHandlingQuery->where('updated_at', '>=', $from);
        }
        $avgHandlingMins = (int) $avgHandlingQuery->value('avg_mins');

        $avgTmeQuery = Conversation::where('status', Conversation::STATUS_CLOSED)
            ->whereNotNull('queued_at')
            ->whereNotNull('first_response_at')
            ->whereRaw('first_response_at > queued_at')
            ->selectRaw('COALESCE(AVG(' . $this->sqlMinutesBetween('queued_at', 'first_response_at') . '), 0) as avg_mins');
        if ($from) {
            $avgTmeQuery->where('first_response_at', '>=', $from);
        }
        $avgTmeMins = (int) $avgTmeQuery->value('avg_mins');

        $uniqueContactsQuery = Conversation::query();
        if ($from) {
            $uniqueContactsQuery->where('created_at', '>=', $from);
        }
        $uniqueContacts = $uniqueContactsQuery->distinct()->count('contact_id');

        // ── CSAT médio ─────────────────────────────────────────────
        $csatQuery = SurveyAnswer::query()
            ->join('survey_questions as sq', 'survey_answers.survey_question_id', '=', 'sq.id')
            ->join('survey_responses as sr', 'survey_answers.survey_response_id', '=', 'sr.id')
            ->where('sq.is_rating', true)
            ->where('sr.status', 'completed')
            ->selectRaw('COALESCE(AVG(CAST(survey_answers.option_label AS DECIMAL(5,2))), 0) as avg_csat, COUNT(*) as csat_count');
        if ($from) {
            $csatQuery
                ->join('conversations as c', 'sr.conversation_id', '=', 'c.id')
                ->where('c.updated_at', '>=', $from);
        }
        $csatRow   = $csatQuery->first();
        $csatCount = (int) ($csatRow?->csat_count ?? 0);
        $avgCsat   = $csatCount > 0 ? round((float) $csatRow->avg_csat, 1) : null;

        // ── Gráfico de volume ───────────────────────────────────
        $volumeData = $this->buildVolumeData($period, $from);

        // ── Distribuição por setor ──────────────────────────────
        $sectorStats = Conversation::with('sector')
            ->selectRaw('sector_id, COUNT(*) as total')
            ->whereNotNull('sector_id')
            ->when($from, fn ($q) => $q->where('created_at', '>=', $from))
            ->groupBy('sector_id')
            ->orderByDesc('total')
            ->limit(6)
            ->get()
            ->map(fn ($row) => [
                'name'  => $row->sector?->name ?? 'Desconhecido',
                'total' => (int) $row->total,
            ]);

        // ── Distribuição por canal ──────────────────────────────
        $channelStats = Conversation::with('channel')
            ->selectRaw('channel_id, COUNT(*) as total')
            ->whereNotNull('channel_id')
            ->when($from, fn ($q) => $q->where('created_at', '>=', $from))
            ->groupBy('channel_id')
            ->orderByDesc('total')
            ->get()
            ->map(fn ($row) => [
                'name'  => $row->channel?->name ?? 'Desconhecido',
                'type'  => $row->channel?->type ?? 'whatsapp',
                'total' => (int) $row->total,
            ]);

        // ── Ranking de atendentes ───────────────────────────────
        $topQuery = Conversation::selectRaw(
            'assigned_user_id, COUNT(*) as total, COALESCE(AVG(' . $this->sqlMinutesBetween('created_at', 'updated_at') . '), 0) as avg_mins'
        )
            ->where('status', Conversation::STATUS_CLOSED)
            ->whereNotNull('assigned_user_id')
            ->groupBy('assigned_user_id')
            ->orderByDesc('total')
            ->limit(10);
        if ($from) {
            $topQuery->where('updated_at', '>=', $from);
        }

        $openPerAttendant = Conversation::selectRaw('assigned_user_id, COUNT(*) as total')
            ->where('status', Conversation::STATUS_OPEN)
            ->whereNotNull('assigned_user_id')
            ->groupBy('assigned_user_id')
            ->get()
            ->keyBy('assigned_user_id');

        $topAttendants = $topQuery->with('assignedUser')->get()->map(fn ($row) => [
            'user_id'  => $row->assigned_user_id,
            'name'     => $row->assignedUser?->name ?? 'Desconhecido',
            'closed'   => (int) $row->total,
            'open'     => (int) ($openPerAttendant->get($row->assigned_user_id)?->total ?? 0),
            'avg_mins' => (int) $row->avg_mins,
        ]);

        return Inertia::render('Dashboard', [
            'stats' => [
                'queued'            => $queuedCount,
                'open'              => $openCount,
                'bot'               => $botCount,
                'surveying'         => $surveyingCount,
                'closed'            => $closedCount,
                'avg_wait_mins'     => $avgWaitMins,
                'avg_handling_mins' => $avgHandlingMins,
                'avg_tme_mins'      => $avgTmeMins,
                'resolution_rate'   => $resolutionRate,
                'unique_contacts'   => $uniqueContacts,
                'avg_csat'          => $avgCsat,
                'csat_count'        => $csatCount,
            ],
            'volumeData'    => $volumeData,
            'sectorStats'   => $sectorStats,
            'channelStats'  => $channelStats,
            'topAttendants' => $topAttendants,
            'period'        => $period,
        ]);
    }

    private function sqlMinutesBetween(string $from, string $to): string
    {
        if (DB::connection()->getDriverName() === 'sqlite') {
            return "CAST((julianday({$to}) - julianday({$from})) * 1440 AS INTEGER)";
        }

        return "TIMESTAMPDIFF(MINUTE, {$from}, {$to})";
    }

    private function sqlTimestamp(Carbon $value): string
    {
        return "'" . $value->format('Y-m-d H:i:s') . "'";
    }

    private function sqlHourExpression(string $column): string
    {
        return DB::connection()->getDriverName() === 'sqlite'
            ? "CAST(strftime('%H', {$column}) AS INTEGER)"
            : "HOUR({$column})";
    }

    private function buildVolumeData(string $period, ?Carbon $from): array
    {
        if ($period === 'today') {
            $hourExpr = $this->sqlHourExpression('created_at');
            $rows = Conversation::selectRaw("{$hourExpr} as h, COUNT(*) as total")
                ->where('created_at', '>=', Carbon::now()->startOfDay())
                ->groupByRaw($hourExpr)
                ->orderByRaw($hourExpr)
                ->get()
                ->keyBy('h');

            $currentHour = (int) now()->format('H');
            return collect(range(0, $currentHour))
                ->map(fn ($h) => [
                    'label' => sprintf('%02dh', $h),
                    'count' => (int) ($rows->get($h)?->total ?? 0),
                ])
                ->values()
                ->all();
        }

        $dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

        if ($period === 'week') {
            $start = Carbon::now()->startOfWeek();
            $end   = Carbon::now();
            $rows  = Conversation::selectRaw('DATE(created_at) as d, COUNT(*) as total')
                ->whereBetween('created_at', [$start, $end])
                ->groupByRaw('DATE(created_at)')
                ->orderByRaw('DATE(created_at)')
                ->get()
                ->keyBy('d');

            $days = [];
            for ($date = $start->copy(); $date->lte($end); $date->addDay()) {
                $key    = $date->toDateString();
                $days[] = [
                    'label' => $dayNames[$date->dayOfWeek] . ' ' . $date->format('j'),
                    'count' => (int) ($rows->get($key)?->total ?? 0),
                ];
            }
            return $days;
        }

        // month ou all — últimos 30 dias agrupados por dia
        $start = $period === 'month'
            ? Carbon::now()->startOfMonth()
            : Carbon::now()->subDays(29)->startOfDay();
        $end = Carbon::now();

        $rows = Conversation::selectRaw('DATE(created_at) as d, COUNT(*) as total')
            ->whereBetween('created_at', [$start, $end])
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
}
