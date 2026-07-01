<?php

namespace App\Console\Commands;

use App\Services\Conversation\ConversationSnoozeService;
use Illuminate\Console\Command;

class WakeSnoozedConversations extends Command
{
    protected $signature = 'conversations:wake-snoozed';

    protected $description = 'Resume snoozed conversations whose reminder time has passed.';

    public function handle(ConversationSnoozeService $snooze): int
    {
        $woken = $snooze->wakeExpired();
        $this->components->info("Woke {$woken} snoozed conversation(s).");

        return self::SUCCESS;
    }
}