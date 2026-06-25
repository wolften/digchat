<?php

namespace App\Http\Controllers;

use App\Models\Conversation;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class PresenceController extends Controller
{
    public function index(Request $request): Response
    {
        $sessionActivity = DB::table(config('session.table', 'sessions'))
            ->select('user_id', DB::raw('MAX(last_activity) as last_activity'))
            ->whereNotNull('user_id')
            ->groupBy('user_id')
            ->get()
            ->keyBy('user_id');

        $onlineAfter = now()->subMinutes(5)->timestamp;
        $awayAfter = now()->subMinutes(30)->timestamp;

        $users = User::query()
            ->with('sectors:id,name')
            ->withCount([
                'conversations as open_conversations_count' => fn ($query) => $query
                    ->where('status', Conversation::STATUS_OPEN),
            ])
            ->orderBy('name')
            ->get()
            ->map(function (User $user) use ($sessionActivity, $onlineAfter, $awayAfter) {
                $lastActivity = (int) ($sessionActivity->get($user->id)?->last_activity ?? 0);
                $presence = match (true) {
                    ! $user->is_active => 'inactive',
                    $lastActivity >= $onlineAfter => 'online',
                    $lastActivity >= $awayAfter => 'away',
                    default => 'offline',
                };

                return [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $user->role,
                    'is_active' => $user->is_active,
                    'presence' => $presence,
                    'last_seen_at' => $lastActivity > 0
                        ? now()->setTimestamp($lastActivity)->toIso8601String()
                        : null,
                    'last_seen_timestamp' => $lastActivity,
                    'open_conversations_count' => (int) $user->open_conversations_count,
                    'sectors' => $user->sectors
                        ->map(fn ($sector) => ['id' => $sector->id, 'name' => $sector->name])
                        ->values(),
                ];
            })
            ->sortBy(function (array $user): string {
                $rank = ['online' => 0, 'away' => 1, 'offline' => 2, 'inactive' => 3][$user['presence']] ?? 4;

                return sprintf('%d-%010d-%s', $rank, PHP_INT_MAX - $user['last_seen_timestamp'], $user['name']);
            })
            ->values();

        $summary = [
            'online' => $users->where('presence', 'online')->count(),
            'away' => $users->where('presence', 'away')->count(),
            'offline' => $users->where('presence', 'offline')->count(),
            'inactive' => $users->where('presence', 'inactive')->count(),
            'total' => $users->count(),
        ];

        return Inertia::render('Presence/Index', [
            'users' => $users,
            'summary' => $summary,
            'generatedAt' => now()->toIso8601String(),
        ]);
    }
}
