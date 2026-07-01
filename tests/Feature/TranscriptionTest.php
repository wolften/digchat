<?php

namespace Tests\Feature;

use App\Jobs\TranscribeAudioMessage;
use App\Models\AppSetting;
use App\Models\Contact;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class TranscriptionTest extends TestCase
{
    use RefreshDatabase;

    private function makeAudioMessage(?User $viewer = null): Message
    {
        $contact = Contact::create([
            'wa_id' => '5547999990000',
            'profile_name' => 'Cliente',
        ]);

        $conversation = $contact->conversations()->create([
            'status' => Conversation::STATUS_OPEN,
            'assigned_user_id' => $viewer?->id,
            'last_message_at' => now(),
        ]);

        return $conversation->messages()->create([
            'direction' => Message::DIRECTION_IN,
            'type' => 'audio',
            'body' => '[Áudio]',
            'payload' => ['audio' => ['id' => 'media-123']],
        ]);
    }

    public function test_manual_transcribe_dispatches_job(): void
    {
        Queue::fake();

        AppSetting::set('groq_api_key', 'gsk_test_key');

        $atendente = User::factory()->create(['role' => User::ROLE_ATENDENTE]);
        $message = $this->makeAudioMessage($atendente);

        $this->actingAs($atendente)
            ->postJson("/inbox/messages/{$message->id}/transcribe")
            ->assertOk()
            ->assertJsonPath('status', 'queued');

        Queue::assertPushed(TranscribeAudioMessage::class, function (TranscribeAudioMessage $job) use ($message) {
            return $job->messageId === $message->id;
        });
    }

    public function test_manual_transcribe_returns_existing_transcription(): void
    {
        Queue::fake();

        AppSetting::set('groq_api_key', 'gsk_test_key');

        $atendente = User::factory()->create(['role' => User::ROLE_ATENDENTE]);
        $message = $this->makeAudioMessage($atendente);
        $message->forceFill(['transcription' => 'Olá, preciso de ajuda.'])->save();

        $this->actingAs($atendente)
            ->postJson("/inbox/messages/{$message->id}/transcribe")
            ->assertOk()
            ->assertJsonPath('status', 'done')
            ->assertJsonPath('transcription', 'Olá, preciso de ajuda.');

        Queue::assertNotPushed(TranscribeAudioMessage::class);
    }

    public function test_manual_transcribe_requires_groq_key(): void
    {
        Queue::fake();

        $atendente = User::factory()->create(['role' => User::ROLE_ATENDENTE]);
        $message = $this->makeAudioMessage($atendente);

        $this->actingAs($atendente)
            ->postJson("/inbox/messages/{$message->id}/transcribe")
            ->assertStatus(422);

        Queue::assertNotPushed(TranscribeAudioMessage::class);
    }
}