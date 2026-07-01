<?php

namespace App\Http\Controllers;

use App\Models\Conversation;
use App\Services\Reports\ReportMetricsService;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Inertia\Inertia;
use Inertia\Response;

class ReportsController extends Controller
{
    public function __construct(private ReportMetricsService $metrics) {}

    public function index(Request $request): Response
    {
        $filters = $this->metrics->parseFilters($request->all());
        $options = $this->metrics->filterOptions();

        return Inertia::render('Relatorios/Index', [
            'filters'    => $filters,
            'sectors'    => $options['sectors'],
            'users'      => $options['users'],
            'tags'       => $options['tags'],
            'atendimentos' => $this->metrics->atendimentosMetrics($filters),
            'atendentes'   => $this->metrics->atendentesMetrics($filters),
            'clientes'     => $this->metrics->clientesMetrics($filters),
        ]);
    }

    public function export(Request $request): HttpResponse
    {
        $filters = $this->metrics->parseFilters($request->all());
        $tab     = $filters['tab'];

        $csv = "\xEF\xBB\xBF";

        if ($tab === 'atendentes') {
            $csv .= "Atendente,Encerrados,Em aberto,Mensagens,TME medio (min),TMA medio (min),CSAT,Respostas CSAT\n";
            foreach ($this->metrics->attendantRows($filters) as $row) {
                $csv .= implode(',', [
                    '"'.str_replace('"', '""', $row['name']).'"',
                    $row['closed'],
                    $row['open'],
                    $row['messages_sent'],
                    $row['avg_tme_mins'] ?: '',
                    $row['avg_mins'] ?: '',
                    $row['avg_csat'] ?? '',
                    $row['csat_count'],
                ])."\n";
            }
        } elseif ($tab === 'clientes') {
            $data = $this->metrics->clientesMetrics($filters);
            $csv .= "Contato,Telefone,Canal,Conversas,Primeira interacao,Ultima interacao,IXC vinculado\n";
            foreach ($data['top_clients'] as $row) {
                $csv .= implode(',', [
                    '"'.str_replace('"', '""', $row['name']).'"',
                    $row['wa_id'],
                    '"'.str_replace('"', '""', $row['channel_name'] ?? '').'"',
                    $row['conversations'],
                    $row['first_at'] ? '"'.$row['first_at'].'"' : '',
                    $row['last_at'] ? '"'.$row['last_at'].'"' : '',
                    $row['ixc_linked'] ? 'Sim' : 'Nao',
                ])."\n";
            }
        } else {
            $minsBetween = $this->metrics->sqlMinutesBetween('created_at', 'updated_at');
            $tmeBetween  = $this->metrics->sqlMinutesBetween('queued_at', 'first_response_at');

            $rows = $this->metrics->baseQuery($filters)
                ->with(['contact', 'assignedUser:id,name', 'sector:id,name', 'channel:id,name,type', 'surveyResponse.answers'])
                ->orderByDesc('created_at')
                ->limit(5000)
                ->get();

            $csv .= "Data,Protocolo,Contato,Canal,Setor,Atendente,Status,TME (min),TMA (min),CSAT\n";

            foreach ($rows as $c) {
                $tme = ($c->queued_at && $c->first_response_at && $c->first_response_at->gt($c->queued_at))
                    ? (int) $c->queued_at->diffInMinutes($c->first_response_at)
                    : '';
                $tma = ($c->status === Conversation::STATUS_CLOSED && $c->created_at && $c->updated_at)
                    ? (int) $c->created_at->diffInMinutes($c->updated_at)
                    : '';
                $csat = null;
                if ($c->surveyResponse?->isCompleted()) {
                    $rating = $c->surveyResponse->answers->first()?->option_label;
                    $csat = is_numeric($rating) ? $rating : null;
                }

                $csv .= implode(',', [
                    '"'.$c->created_at?->format('Y-m-d H:i').'"',
                    $c->protocol_number ?? '',
                    '"'.str_replace('"', '""', $c->contact->displayName()).'"',
                    '"'.str_replace('"', '""', $c->channel?->name ?? '').'"',
                    '"'.str_replace('"', '""', $c->sector?->name ?? '').'"',
                    '"'.str_replace('"', '""', $c->assignedUser?->name ?? 'Bot').'"',
                    $c->status,
                    $tme,
                    $tma,
                    $csat ?? '',
                ])."\n";
            }
        }

        $filename = "relatorio-{$tab}-{$filters['date_from']}-{$filters['date_to']}.csv";

        return response($csv, 200, [
            'Content-Type'        => 'text/csv; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ]);
    }
}