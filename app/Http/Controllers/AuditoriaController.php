<?php

namespace App\Http\Controllers;

use App\Enums\ActivityEvent;
use App\Models\ActivityLog;
use App\Models\Sector;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Inertia\Inertia;
use Inertia\Response;

class AuditoriaController extends Controller
{
    public function index(Request $request): Response
    {
        $dateFrom = $request->string('date_from')->toString() ?: now()->startOfMonth()->toDateString();
        $dateTo = $request->string('date_to')->toString() ?: now()->toDateString();
        $event = $request->string('event')->trim()->toString() ?: null;
        $actorUserId = $request->integer('actor_user_id') ?: null;
        $sectorId = $request->integer('sector_id') ?: null;
        $search = $request->string('search')->trim()->toString() ?: null;

        $base = fn () => ActivityLog::query()
            ->filter($dateFrom, $dateTo, $event, $actorUserId, $sectorId, $search);

        $stats = [
            'total' => $base()->count(),
            'auth' => $base()->whereIn('event', [
                ActivityEvent::AuthLogin->value,
                ActivityEvent::AuthLogout->value,
            ])->count(),
            'conversation' => $base()->whereIn('event', [
                ActivityEvent::ConversationAssigned->value,
                ActivityEvent::ConversationTransferred->value,
                ActivityEvent::ConversationClosed->value,
                ActivityEvent::ConversationForceClosed->value,
                ActivityEvent::ConversationSnoozed->value,
                ActivityEvent::ConversationWoken->value,
            ])->count(),
            'presence' => $base()->whereIn('event', [
                ActivityEvent::PresenceOnline->value,
                ActivityEvent::PresenceAway->value,
                ActivityEvent::PresenceOffline->value,
            ])->count(),
            'admin' => $base()->whereIn('event', [
                ActivityEvent::UserCreated->value,
                ActivityEvent::UserUpdated->value,
                ActivityEvent::UserDeleted->value,
                ActivityEvent::SectorCreated->value,
                ActivityEvent::SectorUpdated->value,
                ActivityEvent::SectorDeleted->value,
                ActivityEvent::ChannelCreated->value,
                ActivityEvent::ChannelUpdated->value,
                ActivityEvent::ChannelDeleted->value,
                ActivityEvent::SettingsUpdated->value,
            ])->count(),
        ];

        $logs = $base()
            ->with('actor:id,name,profile_photo_path')
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate(50)
            ->withQueryString()
            ->through(fn (ActivityLog $log) => $this->summarize($log));

        return Inertia::render('Auditoria/Index', [
            'logs' => $logs,
            'filters' => [
                'date_from' => $dateFrom,
                'date_to' => $dateTo,
                'event' => $event,
                'actor_user_id' => $actorUserId,
                'sector_id' => $sectorId,
                'search' => $search,
            ],
            'eventTypes' => ActivityEvent::options(),
            'users' => User::where('is_active', true)->orderBy('name')->get(['id', 'name']),
            'sectors' => Sector::orderBy('name')->get(['id', 'name']),
            'stats' => $stats,
            'can_export' => true,
        ]);
    }

    public function export(Request $request): HttpResponse
    {
        $dateFrom = $request->string('date_from')->toString() ?: now()->startOfMonth()->toDateString();
        $dateTo = $request->string('date_to')->toString() ?: now()->toDateString();
        $event = $request->string('event')->trim()->toString() ?: null;
        $actorUserId = $request->integer('actor_user_id') ?: null;
        $sectorId = $request->integer('sector_id') ?: null;
        $search = $request->string('search')->trim()->toString() ?: null;

        $rows = ActivityLog::query()
            ->filter($dateFrom, $dateTo, $event, $actorUserId, $sectorId, $search)
            ->with('actor:id,name')
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->limit(5000)
            ->get();

        $csv = "\xEF\xBB\xBF";
        $csv .= "Data/Hora,Evento,Ator,Descrição,Protocolo,Metadados\n";

        foreach ($rows as $log) {
            $eventLabel = ActivityEvent::tryFrom($log->event)?->label() ?? $log->event;
            $protocol = $log->properties['protocol_number'] ?? '';
            $meta = json_encode($log->properties ?? [], JSON_UNESCAPED_UNICODE);

            $csv .= implode(',', [
                '"'.($log->created_at?->format('d/m/Y H:i:s') ?? '').'"',
                '"'.str_replace('"', '""', $eventLabel).'"',
                '"'.str_replace('"', '""', $log->actor?->name ?? 'Sistema').'"',
                '"'.str_replace('"', '""', $log->description ?? '').'"',
                '"'.str_replace('"', '""', (string) $protocol).'"',
                '"'.str_replace('"', '""', $meta ?: '').'"',
            ])."\n";
        }

        return response($csv, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="auditoria-'.$dateFrom.'-a-'.$dateTo.'.csv"',
        ]);
    }

    /** @return array<string, mixed> */
    private function summarize(ActivityLog $log): array
    {
        $event = ActivityEvent::tryFrom($log->event);

        return [
            'id' => $log->id,
            'event' => $log->event,
            'event_label' => $event?->label() ?? $log->event,
            'event_category' => $event?->category() ?? 'other',
            'description' => $log->description,
            'actor' => $log->actor?->publicSummary(),
            'subject_type' => $log->subject_type,
            'subject_id' => $log->subject_id,
            'properties' => $log->properties ?? [],
            'created_at' => $log->created_at?->toIso8601String(),
        ];
    }
}