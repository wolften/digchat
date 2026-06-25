<?php

namespace App\Jobs;

use App\Models\Contact;
use App\Services\WhatsApp\WhatsAppService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class FetchContactAvatar implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;

    public function __construct(public readonly int $contactId) {}

    public function handle(): void
    {
        $contact = Contact::find($this->contactId);
        if (! $contact) {
            return;
        }

        $meta = $contact->meta ?? [];

        if (data_get($meta, 'avatar_url')) {
            return;
        }

        $channel = $contact->channel;

        // Telegram contacts don't have profile pictures via this path.
        if ($channel && $channel->type !== 'whatsapp') {
            $meta['avatar_fetch_attempted'] = true;
            $contact->meta = $meta;
            $contact->save();
            return;
        }

        $whatsApp = new WhatsAppService($channel);
        $pictureUrl = $whatsApp->getContactProfilePictureUrl($contact->wa_id);

        // Auth error (expired token): don't mark as attempted so the job retries
        // automatically the next time the contact sends a message.
        if ($whatsApp->getLastErrorMessage()) {
            Log::warning('FetchContactAvatar: auth error, skipping mark attempted', [
                'contact_id' => $this->contactId,
                'error'      => $whatsApp->getLastErrorMessage(),
            ]);
            return;
        }

        // Mark attempted now — either we got a URL or the contact has no public photo.
        $meta['avatar_fetch_attempted'] = true;

        if ($pictureUrl) {
            try {
                $imageData = Http::timeout(15)->get($pictureUrl)->body();

                if (! empty($imageData)) {
                    $path = "avatars/{$contact->id}.jpg";
                    Storage::disk('public')->put($path, $imageData);
                    $meta['avatar_url'] = Storage::disk('public')->url($path);
                }
            } catch (\Throwable $e) {
                Log::warning('FetchContactAvatar: image download failed', [
                    'contact_id' => $this->contactId,
                    'error'      => $e->getMessage(),
                ]);
            }
        }

        $contact->meta = $meta;
        $contact->save();
    }
}
