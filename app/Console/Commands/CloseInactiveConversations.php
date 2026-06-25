<?php

namespace App\Console\Commands;

use App\Models\AppSetting;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\Survey;
use App\Models\SurveyResponse;
use App\Services\WhatsApp\MessageSender;
use Illuminate\Console\Command;

class CloseInactiveConversations extends Command
{
    protected $signature = 'conversations:close-inactive';

    protected $description = 'Close open conversations when the customer has not replied within the configured inactivity window.';

    public function handle(): int
    {
        if (! AppSetting::bool('auto_close_inactive_conversations_enabled')) {
            $this->components->info('Auto close is disabled.');

            return self::SUCCESS;
        }

        $minutes = (int) AppSetting::get('auto_close_inactive_conversations_minutes', 60);
        $minutes = max(1, $minutes);
        $cutoff = now()->subMinutes($minutes);
        $closed = 0;

        // Resolve survey to send on inactivity close (loaded once, used across all conversations).
        $survey = null;
        $sender = null;
        if (
            AppSetting::bool('survey_on_inactivity_close_enabled')
            && AppSetting::bool('survey_on_close_enabled')
        ) {
            $surveyId = (int) AppSetting::get('survey_on_close_survey_id', 0);
            if ($surveyId) {
                $candidate = Survey::with('questions')->find($surveyId);
                if ($candidate && $candidate->is_active && $candidate->questions->isNotEmpty()) {
                    $survey = $candidate;
                    $sender = app(MessageSender::class);
                }
            }
        }

        Conversation::query()
            ->where('status', Conversation::STATUS_OPEN)
            ->where('last_message_at', '<=', $cutoff)
            ->chunkById(100, function ($conversations) use (&$closed, $cutoff, $survey, $sender): void {
                foreach ($conversations as $conversation) {
                    $lastMessage = $conversation->messages()->latest()->first();

                    // Skip if no message, last message is from the client (inbound),
                    // last message failed, or a new message arrived after the cutoff
                    // (race condition guard: attendant may have replied while this chunk ran).
                    if (
                        ! $lastMessage
                        || $lastMessage->direction !== Message::DIRECTION_OUT
                        || $lastMessage->status === 'failed'
                        || $lastMessage->created_at > $cutoff
                    ) {
                        continue;
                    }

                    if ($survey && $sender) {
                        $response = SurveyResponse::create([
                            'survey_id'        => $survey->id,
                            'conversation_id'  => $conversation->id,
                            'contact_id'       => $conversation->contact_id,
                            'status'           => SurveyResponse::STATUS_IN_PROGRESS,
                            'current_position' => 0,
                            'started_at'       => now(),
                        ]);

                        $conversation->forceFill([
                            'status'             => Conversation::STATUS_SURVEYING,
                            'survey_response_id' => $response->id,
                        ])->save();

                        $firstQuestion = $survey->questions->first();
                        $buttons = collect($firstQuestion->options ?? [])
                            ->take(3)
                            ->map(fn ($opt) => ['id' => $opt['id'], 'title' => mb_substr($opt['label'], 0, 20)])
                            ->values()
                            ->all();

                        $sender->sendButtons($conversation, $firstQuestion->text, $buttons, $survey->name);
                    } else {
                        $conversation->forceFill(['status' => Conversation::STATUS_CLOSED])->save();
                    }

                    $closed++;
                }
            });

        $this->components->info("Closed {$closed} inactive conversation(s).");

        return self::SUCCESS;
    }
}
