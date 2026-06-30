<?php

namespace App\Services\Transcription;

use App\Models\AppSetting;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class GroqTranscriptionService
{
    private string $apiKey;
    private string $model;

    public function __construct()
    {
        $this->apiKey = (string) AppSetting::get('groq_api_key', '');
        $this->model  = 'whisper-large-v3-turbo';
    }

    public function isConfigured(): bool
    {
        return $this->apiKey !== '';
    }

    /**
     * Transcribe raw audio bytes via Groq Whisper.
     *
     * @return string|null Transcribed text, or null on failure.
     */
    public function transcribe(string $audioContent, string $mimeType, string $filename = 'audio.ogg'): ?string
    {
        if (! $this->isConfigured()) {
            return null;
        }

        try {
            $response = Http::withToken($this->apiKey)
                ->timeout(90)
                ->attach('file', $audioContent, $filename, ['Content-Type' => $mimeType])
                ->post('https://api.groq.com/openai/v1/audio/transcriptions', [
                    'model'           => $this->model,
                    'language'        => 'pt',
                    'response_format' => 'text',
                ]);

            if (! $response->successful()) {
                Log::warning('Groq transcription failed', [
                    'status' => $response->status(),
                    'body'   => $response->body(),
                ]);
                return null;
            }

            $text = trim($response->body());
            return $text !== '' ? $text : null;

        } catch (\Throwable $e) {
            Log::error('Groq transcription exception', ['error' => $e->getMessage()]);
            return null;
        }
    }
}
