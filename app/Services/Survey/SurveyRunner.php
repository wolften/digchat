<?php

namespace App\Services\Survey;

use App\Models\Conversation;
use App\Models\SurveyAnswer;
use App\Models\SurveyQuestion;
use App\Models\SurveyResponse;
use App\Services\Audit\ActivityLogger;
use App\Services\WhatsApp\MessageSender;

class SurveyRunner
{
    public function __construct(
        private MessageSender $sender,
        private ActivityLogger $activity,
    ) {
    }

    /**
     * Process an inbound message from a contact in surveying status.
     *
     * @param  array<string, mixed>  $waMessage  Raw WhatsApp message object.
     */
    public function handle(Conversation $conversation, ?string $body, array $waMessage): void
    {
        $response = SurveyResponse::with(['survey.questions'])
            ->find($conversation->survey_response_id);

        if (! $response || $response->isCompleted()) {
            return;
        }

        $survey    = $response->survey;
        $questions = $survey->questions; // ordered by position
        $current   = $questions->get($response->current_position);

        if (! $current) {
            $this->finish($conversation, $response, $survey->thank_you_message);
            return;
        }

        $optionId    = $waMessage['interactive']['button_reply']['id']
            ?? $waMessage['interactive']['list_reply']['id']
            ?? null;
        $optionLabel = $waMessage['interactive']['button_reply']['title']
            ?? $waMessage['interactive']['list_reply']['title']
            ?? $waMessage['button']['text']
            ?? $body;

        $matched = collect($current->options ?? [])->first(
            fn ($opt) => ($optionId && $opt['id'] === $optionId)
                || $opt['label'] === $optionLabel
        );

        SurveyAnswer::create([
            'survey_response_id' => $response->id,
            'survey_question_id' => $current->id,
            'option_id'          => $matched['id'] ?? $optionId,
            'option_label'       => $matched['label'] ?? $optionLabel,
        ]);

        $nextPosition = $response->current_position + 1;
        $nextQuestion = $questions->get($nextPosition);

        if ($nextQuestion) {
            $response->forceFill(['current_position' => $nextPosition])->save();
            $this->sendQuestion($conversation, $nextQuestion, $survey->name);
        } else {
            $this->finish($conversation, $response, $survey->thank_you_message);
        }
    }

    private function sendQuestion(Conversation $conversation, SurveyQuestion $question, ?string $header = null): void
    {
        (new SurveyQuestionSender($this->sender))->send($conversation, $question, $header);
    }

    private function finish(Conversation $conversation, SurveyResponse $response, ?string $thankYouMessage): void
    {
        if ($thankYouMessage) {
            $this->sender->sendText($conversation, $thankYouMessage);
        }

        $response->forceFill([
            'status'       => SurveyResponse::STATUS_COMPLETED,
            'completed_at' => now(),
        ])->save();

        $conversation->forceFill([
            'status'             => Conversation::STATUS_CLOSED,
            'survey_response_id' => null,
            'sector_id'          => null,
        ])->save();

        $this->activity->conversationClosed(null, $conversation, 'survey_completed');
    }
}
