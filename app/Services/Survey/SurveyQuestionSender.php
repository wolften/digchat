<?php

namespace App\Services\Survey;

use App\Models\Channel;
use App\Models\Conversation;
use App\Models\SurveyQuestion;
use App\Services\WhatsApp\MessageSender;

class SurveyQuestionSender
{
    private const WHATSAPP_BUTTON_LIMIT = 3;

    private const RATING_DESCRIPTIONS = [
        '0' => 'Péssimo',
        '1' => 'Ruim',
        '2' => 'Regular',
        '3' => 'Bom',
        '4' => 'Muito bom',
        '5' => 'Excelente',
    ];

    public function __construct(private MessageSender $sender)
    {
    }

    public function send(Conversation $conversation, SurveyQuestion $question, ?string $header = null): void
    {
        $conversation->loadMissing('channel');
        $channelType = $conversation->channel?->type ?? Channel::TYPE_WHATSAPP;
        $options = $this->normalizeOptions($question);

        if ($options === []) {
            return;
        }

        match ($channelType) {
            Channel::TYPE_TELEGRAM => $this->sendTelegram($conversation, $question, $options, $header),
            Channel::TYPE_WEB      => $this->sendWeb($conversation, $question, $options, $header),
            default                => $this->sendWhatsApp($conversation, $question, $options, $header),
        };
    }

    /**
     * @return array<int, array{id: string, title: string, label: string}>
     */
    private function normalizeOptions(SurveyQuestion $question): array
    {
        return collect($question->options ?? [])
            ->map(fn ($opt) => [
                'id'    => (string) $opt['id'],
                'title' => mb_substr((string) $opt['label'], 0, 20),
                'label' => (string) $opt['label'],
            ])
            ->values()
            ->all();
    }

    /**
     * @param  array<int, array{id: string, title: string, label: string}>  $options
     */
    private function sendWhatsApp(Conversation $conversation, SurveyQuestion $question, array $options, ?string $header): void
    {
        if (count($options) <= self::WHATSAPP_BUTTON_LIMIT) {
            $buttons = array_map(
                fn ($o) => ['id' => $o['id'], 'title' => $o['title']],
                $options,
            );
            $this->sender->sendButtons($conversation, $question->text, $buttons, $header);

            return;
        }

        $this->sender->sendList(
            $conversation,
            $question->text,
            $question->is_rating ? 'Escolher nota' : 'Ver opções',
            $this->buildRows($question, $options),
            $question->is_rating ? 'Notas' : 'Opções',
        );
    }

    /**
     * @param  array<int, array{id: string, title: string, label: string}>  $options
     */
    private function sendTelegram(Conversation $conversation, SurveyQuestion $question, array $options, ?string $header): void
    {
        $buttons = array_map(
            fn ($o) => ['id' => $o['id'], 'title' => $o['title']],
            $options,
        );

        if (count($options) <= self::WHATSAPP_BUTTON_LIMIT) {
            $this->sender->sendButtons($conversation, $question->text, $buttons, $header);

            return;
        }

        if ($question->is_rating) {
            $this->sender->sendButtonGrid(
                $conversation,
                $question->text,
                $buttons,
                $this->ratingGridColumns(count($options)),
                $header,
            );

            return;
        }

        $rows = $this->buildRows($question, $options);
        $this->sender->sendList($conversation, $question->text, 'Ver opções', $rows);
    }

    /**
     * @param  array<int, array{id: string, title: string, label: string}>  $options
     */
    private function sendWeb(Conversation $conversation, SurveyQuestion $question, array $options, ?string $header): void
    {
        $buttons = array_map(
            fn ($o) => ['id' => $o['id'], 'title' => $o['title']],
            $options,
        );

        $this->sender->sendButtons($conversation, $question->text, $buttons, $header);
    }

    /**
     * @param  array<int, array{id: string, title: string, label: string}>  $options
     * @return array<int, array{id: string, title: string, description?: string}>
     */
    private function buildRows(SurveyQuestion $question, array $options): array
    {
        return array_map(function (array $option) use ($question) {
            $row = [
                'id'    => $option['id'],
                'title' => $question->is_rating
                    ? mb_substr($option['title'], 0, 24)
                    : mb_substr($option['label'], 0, 24),
            ];

            if ($question->is_rating) {
                $description = self::RATING_DESCRIPTIONS[$option['id']]
                    ?? ($option['label'] !== $option['title'] ? $option['label'] : null);

                if ($description) {
                    $row['description'] = mb_substr($description, 0, 72);
                }
            }

            return $row;
        }, $options);
    }

    private function ratingGridColumns(int $count): int
    {
        return $count <= 5 ? $count : 3;
    }
}