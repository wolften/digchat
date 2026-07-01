<?php

namespace App\Services;

use App\Contracts\MessagingChannel;
use App\Models\AppSetting;
use App\Models\Conversation;
use App\Models\Flow;
use App\Services\WhatsApp\MessageSender;

class OutOfHoursGate
{
    public function __construct(
        private BusinessHoursService $businessHours = new BusinessHoursService,
    ) {}

    /**
     * Returns true when the conversation is outside business hours and the bot must not run.
     */
    public function blocksBotFlow(Conversation $conversation, MessagingChannel $channel): bool
    {
        if ($this->businessHours->isOpen($conversation->sector_id)) {
            return false;
        }

        $flow = $conversation->flow_id
            ? Flow::find($conversation->flow_id)
            : Flow::defaultFlow();

        if ($flow?->hasBusinessHoursCheck()) {
            return false;
        }

        $oohMsg = $this->businessHours->outOfHoursMessage($conversation->sector_id);

        if ($oohMsg) {
            $lastNotified    = $conversation->last_ooh_notified_at;
            $intervalHours   = (int) AppSetting::get('ooh_notify_interval_hours', 4);
            $shouldNotify    = ! $lastNotified || now()->diffInHours($lastNotified) >= $intervalHours;

            if ($shouldNotify) {
                (new MessageSender($channel))->sendText($conversation, $oohMsg);
                $conversation->update(['last_ooh_notified_at' => now()]);
            }
        }

        return true;
    }
}