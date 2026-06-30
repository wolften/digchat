<?php

namespace Tests\Feature;

use App\Models\Channel;
use App\Models\Contact;
use App\Models\Conversation;
use App\Models\Survey;
use App\Models\SurveyAnswer;
use App\Models\SurveyQuestion;
use App\Models\SurveyResponse;
use App\Models\User;
use App\Services\Survey\SurveyQuestionSender;
use App\Services\Survey\SurveyRunner;
use App\Services\WhatsApp\MessageSender;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class SurveyQuestionSenderTest extends TestCase
{
    use RefreshDatabase;

    public function test_whatsapp_rating_with_more_than_three_options_uses_list(): void
    {
        [$conversation, $question] = $this->makeSurveyConversation(Channel::TYPE_WHATSAPP);
        $channel = new RecordingMessagingChannel;

        (new SurveyQuestionSender(new MessageSender($channel)))
            ->send($conversation, $question, 'Pesquisa');

        $this->assertSame('sendList', $channel->lastMethod);
        $this->assertSame('Escolher nota', $channel->lastArgs['buttonText']);
        $this->assertCount(5, $channel->lastArgs['rows']);
        $this->assertSame('1', $channel->lastArgs['rows'][0]['id']);
        $this->assertSame('Ruim', $channel->lastArgs['rows'][0]['description'] ?? null);
    }

    public function test_whatsapp_with_three_or_fewer_options_uses_buttons(): void
    {
        [$conversation] = $this->makeSurveyConversation(Channel::TYPE_WHATSAPP);
        $question = SurveyQuestion::make([
            'text' => 'Como foi?',
            'options' => [
                ['id' => 'sim', 'label' => 'Sim'],
                ['id' => 'nao', 'label' => 'Não'],
            ],
            'is_rating' => false,
        ]);
        $channel = new RecordingMessagingChannel;

        (new SurveyQuestionSender(new MessageSender($channel)))
            ->send($conversation, $question);

        $this->assertSame('sendButtons', $channel->lastMethod);
        $this->assertCount(2, $channel->lastArgs['buttons']);
    }

    public function test_telegram_rating_with_five_options_uses_single_row_grid(): void
    {
        [$conversation, $question] = $this->makeSurveyConversation(Channel::TYPE_TELEGRAM);
        $channel = new RecordingTelegramChannel;

        (new SurveyQuestionSender(new MessageSender($channel)))
            ->send($conversation, $question);

        $this->assertSame('sendButtonGrid', $channel->lastMethod);
        $this->assertSame(5, $channel->lastArgs['columns']);
        $this->assertCount(5, $channel->lastArgs['buttons']);
    }

    public function test_telegram_non_rating_with_many_options_uses_list(): void
    {
        [$conversation] = $this->makeSurveyConversation(Channel::TYPE_TELEGRAM);
        $question = SurveyQuestion::make([
            'text' => 'Escolha um motivo',
            'options' => [
                ['id' => 'a', 'label' => 'Opção A'],
                ['id' => 'b', 'label' => 'Opção B'],
                ['id' => 'c', 'label' => 'Opção C'],
                ['id' => 'd', 'label' => 'Opção D'],
            ],
            'is_rating' => false,
        ]);
        $channel = new RecordingMessagingChannel;

        (new SurveyQuestionSender(new MessageSender($channel)))
            ->send($conversation, $question);

        $this->assertSame('sendList', $channel->lastMethod);
        $this->assertCount(4, $channel->lastArgs['rows']);
    }

    public function test_web_channel_sends_all_options_as_buttons(): void
    {
        [$conversation, $question] = $this->makeSurveyConversation(Channel::TYPE_WEB);
        $channel = new RecordingMessagingChannel;

        (new SurveyQuestionSender(new MessageSender($channel)))
            ->send($conversation, $question);

        $this->assertSame('sendButtons', $channel->lastMethod);
        $this->assertCount(5, $channel->lastArgs['buttons']);
    }

    public function test_survey_runner_accepts_list_reply_answers(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
        $survey = Survey::create([
            'name' => 'Pesquisa',
            'is_active' => true,
            'thank_you_message' => 'Obrigado!',
            'created_by' => $admin->id,
        ]);

        $question = SurveyQuestion::create([
            'survey_id' => $survey->id,
            'position' => 0,
            'text' => 'De 0 a 5, qual nota?',
            'options' => [
                ['id' => '0', 'label' => '0'],
                ['id' => '1', 'label' => '1'],
                ['id' => '2', 'label' => '2'],
                ['id' => '3', 'label' => '3'],
                ['id' => '4', 'label' => '4'],
                ['id' => '5', 'label' => '5'],
            ],
            'is_rating' => true,
        ]);

        $channel = Channel::create([
            'type' => Channel::TYPE_WHATSAPP,
            'name' => 'WhatsApp',
            'config' => [],
            'is_active' => true,
        ]);

        $contact = Contact::create([
            'wa_id' => '5547999999999',
            'channel_id' => $channel->id,
        ]);

        $conversation = $contact->conversations()->create([
            'channel_id' => $channel->id,
            'status' => Conversation::STATUS_SURVEYING,
            'last_message_at' => now(),
        ]);

        $response = SurveyResponse::create([
            'survey_id' => $survey->id,
            'conversation_id' => $conversation->id,
            'contact_id' => $contact->id,
            'status' => SurveyResponse::STATUS_IN_PROGRESS,
            'current_position' => 0,
            'started_at' => now(),
        ]);

        $conversation->forceFill(['survey_response_id' => $response->id])->save();

        $recording = new RecordingMessagingChannel;
        $runner = new SurveyRunner(new MessageSender($recording));

        $runner->handle($conversation, '5', [
            'interactive' => [
                'list_reply' => [
                    'id' => '5',
                    'title' => '5',
                ],
            ],
        ]);

        $this->assertDatabaseHas('survey_answers', [
            'survey_response_id' => $response->id,
            'survey_question_id' => $question->id,
            'option_id' => '5',
            'option_label' => '5',
        ]);

        $response->refresh();
        $conversation->refresh();

        $this->assertSame(SurveyResponse::STATUS_COMPLETED, $response->status);
        $this->assertSame(Conversation::STATUS_CLOSED, $conversation->status);
    }

    /**
     * @return array{0: Conversation, 1: SurveyQuestion}
     */
    private function makeSurveyConversation(string $channelType): array
    {
        $channel = Channel::create([
            'type' => $channelType,
            'name' => ucfirst($channelType),
            'config' => [],
            'is_active' => true,
        ]);

        $contact = Contact::create([
            'wa_id' => $channelType === Channel::TYPE_TELEGRAM ? '123456789' : '5547999999999',
            'channel_id' => $channel->id,
        ]);

        $conversation = $contact->conversations()->create([
            'channel_id' => $channel->id,
            'status' => Conversation::STATUS_SURVEYING,
            'last_message_at' => now(),
        ]);

        $question = SurveyQuestion::make([
            'text' => 'De 0 a 5, qual nota daria para este atendimento?',
            'options' => [
                ['id' => '1', 'label' => '1'],
                ['id' => '2', 'label' => '2'],
                ['id' => '3', 'label' => '3'],
                ['id' => '4', 'label' => '4'],
                ['id' => '5', 'label' => '5'],
            ],
            'is_rating' => true,
        ]);

        return [$conversation, $question];
    }
}

class RecordingMessagingChannel implements \App\Contracts\MessagingChannel
{
    public string $lastMethod = '';

    /** @var array<string, mixed> */
    public array $lastArgs = [];

    public function sendText(string $to, string $body): ?string
    {
        return $this->record('sendText', compact('to', 'body'));
    }

    public function sendButtons(string $to, string $body, array $buttons, ?string $header = null): ?string
    {
        return $this->record('sendButtons', compact('to', 'body', 'buttons', 'header'));
    }

    public function sendList(string $to, string $body, string $buttonText, array $rows, ?string $sectionTitle = null): ?string
    {
        return $this->record('sendList', compact('to', 'body', 'buttonText', 'rows', 'sectionTitle'));
    }

    public function sendFile(string $to, UploadedFile $file, string $type, ?string $caption = null, ?string $filename = null, ?string $forcedMimeType = null): ?string
    {
        return $this->record('sendFile', compact('to', 'type'));
    }

    public function supportsMediaFetch(): bool
    {
        return false;
    }

    public function markAsRead(string $messageId): bool
    {
        return true;
    }

    public function isConfigured(): bool
    {
        return true;
    }

    public function getLastErrorMessage(): ?string
    {
        return null;
    }

    private function record(string $method, array $args): string
    {
        $this->lastMethod = $method;
        $this->lastArgs = $args;

        return 'fake-message-id';
    }
}

class RecordingTelegramChannel extends RecordingMessagingChannel
{
    public function sendButtonGrid(string $to, string $body, array $buttons, int $columns = 3, ?string $header = null): ?string
    {
        $this->lastMethod = 'sendButtonGrid';
        $this->lastArgs = compact('to', 'body', 'buttons', 'columns', 'header');

        return 'fake-message-id';
    }
}