<?php

namespace App\Http\Middleware;

use App\Services\Presence\PresenceTransitionTracker;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

class UpdateLastSeenAt
{
    // Write at most once per minute per session to avoid hammering the DB.
    private const THROTTLE_SECONDS = 60;

    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $user = $request->user();

        if ($user && $request->hasSession()) {
            $lastUpdate = $request->session()->get('_last_seen_update', 0);

            if (now()->timestamp - $lastUpdate >= self::THROTTLE_SECONDS) {
                DB::table('users')
                    ->where('id', $user->id)
                    ->update(['last_seen_at' => now()]);

                $request->session()->put('_last_seen_update', now()->timestamp);

                app(PresenceTransitionTracker::class)->syncUser($user);
            }
        }

        return $response;
    }
}
