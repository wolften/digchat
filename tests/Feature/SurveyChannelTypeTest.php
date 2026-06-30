<?php

namespace Tests\Feature;

use App\Models\Channel;
use App\Models\Contact;
use App\Models\Conversation;
use App\Models\Survey;
use App\Models\SurveyResponse;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SurveyChannelTypeTest extends TestCase
{
    use RefreshDatabase;

    public function test_responses_endpoint_returns_web_channel_from_conversation(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
        $survey = $this->makeSurvey($admin);

        $webChannel = Channel::create([
            'type' => Channel::TYPE_WEB,
            'name' => 'Chat Web',
            'config' => [],
            'is_active' => true,
        ]);

        $contact = Contact::create([
            'wa_id' => 'web_abc-123',
            'name' => 'Rodolfo',
            'channel_id' => $webChannel->id,
        ]);

        $conversation = $contact->conversations()->create([
            'channel_id' => $webChannel->id,
            'status' => Conversation::STATUS_CLOSED,
            'last_message_at' => now(),
        ]);

        SurveyResponse::create([
            'survey_id' => $survey->id,
            'conversation_id' => $conversation->id,
            'contact_id' => $contact->id,
            'status' => SurveyResponse::STATUS_COMPLETED,
            'completed_at' => now(),
        ]);

        $response = $this->actingAs($admin)
            ->getJson(route('pesquisas.responses', $survey));

        $response->assertOk();
        $response->assertJsonPath('recent.0.channel_type', 'web');
    }

    public function test_responses_endpoint_infers_web_channel_from_contact_wa_id(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
        $survey = $this->makeSurvey($admin);

        $contact = Contact::create([
            'wa_id' => 'web_orphan-session',
            'name' => 'Visitante',
        ]);

        SurveyResponse::create([
            'survey_id' => $survey->id,
            'conversation_id' => null,
            'contact_id' => $contact->id,
            'status' => SurveyResponse::STATUS_COMPLETED,
            'completed_at' => now(),
        ]);

        $response = $this->actingAs($admin)
            ->getJson(route('pesquisas.responses', $survey));

        $response->assertOk();
        $response->assertJsonPath('recent.0.channel_type', 'web');
    }

    public function test_response_detail_defaults_to_whatsapp_without_web_signals(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
        $survey = $this->makeSurvey($admin);

        $contact = Contact::create([
            'wa_id' => '5547999999999',
            'name' => 'Cliente',
        ]);

        $surveyResponse = SurveyResponse::create([
            'survey_id' => $survey->id,
            'conversation_id' => null,
            'contact_id' => $contact->id,
            'status' => SurveyResponse::STATUS_COMPLETED,
            'completed_at' => now(),
        ]);

        $response = $this->actingAs($admin)
            ->getJson(route('pesquisas.response.detail', $surveyResponse));

        $response->assertOk();
        $response->assertJsonPath('channel_type', 'whatsapp');
    }

    private function makeSurvey(User $admin): Survey
    {
        return Survey::create([
            'name' => 'Pesquisa de satisfação',
            'description' => null,
            'is_active' => true,
            'thank_you_message' => 'Obrigado!',
            'created_by' => $admin->id,
        ]);
    }
}