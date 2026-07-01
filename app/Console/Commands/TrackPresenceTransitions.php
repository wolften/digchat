<?php

namespace App\Console\Commands;

use App\Services\Presence\PresenceTransitionTracker;
use Illuminate\Console\Command;

class TrackPresenceTransitions extends Command
{
    protected $signature = 'presence:track-transitions';

    protected $description = 'Detect presence state changes and write audit logs.';

    public function handle(PresenceTransitionTracker $tracker): int
    {
        $logged = $tracker->syncAll();

        $this->components->info("Presence transitions logged: {$logged}");

        return self::SUCCESS;
    }
}