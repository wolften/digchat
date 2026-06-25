<?php

namespace App\Http\Controllers;

use App\Jobs\ProcessInboundMessage;
use App\Models\AppSetting;
use App\Models\Channel;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Log;

class WhatsAppWebhookController extends Controller
{
    public function __invoke(Request $request): Response
    {
        if ($request->isMethod('get')) {
            return $this->verify($request);
        }

        return $this->receive($request);
    }

    private function verify(Request $request): Response
    {
        $mode      = $request->query('hub_mode');
        $token     = $request->query('hub_verify_token');
        $challenge = $request->query('hub_challenge');

        if ($mode !== 'subscribe') {
            return response('Forbidden', 403);
        }

        // Verifica contra qualquer canal WhatsApp ativo ou o valor legado de app_settings
        $match = Channel::where('type', Channel::TYPE_WHATSAPP)
            ->where('is_active', true)
            ->get()
            ->first(fn ($ch) => ($ch->config['verify_token'] ?? null) === $token);

        $legacyToken = AppSetting::get('whatsapp_verify_token')
            ?: config('services.whatsapp.verify_token');

        if ($match || $token === $legacyToken) {
            return response((string) $challenge, 200);
        }

        return response('Forbidden', 403);
    }

    private function receive(Request $request): Response
    {
        $payload = $request->json()->all();

        // Identifica o canal pelo phone_number_id presente no payload
        $phoneNumberId = data_get($payload, 'entry.0.changes.0.value.metadata.phone_number_id');
        $channel = null;

        if ($phoneNumberId) {
            $channel = Channel::where('type', Channel::TYPE_WHATSAPP)
                ->where('is_active', true)
                ->get()
                ->first(fn ($ch) => ($ch->config['phone_number_id'] ?? null) === $phoneNumberId);
        }

        // Fallback: primeiro canal WhatsApp ativo
        $channel = $channel ?? Channel::firstActiveWhatsapp();

        if (! $this->signatureIsValid($request, $channel)) {
            Log::warning('WhatsApp webhook: assinatura inválida.', [
                'phone_number_id' => $phoneNumberId,
                'channel_id'      => $channel?->id,
            ]);

            return response('Invalid signature', 403);
        }

        ProcessInboundMessage::dispatch($payload, $channel?->id);

        return response('EVENT_RECEIVED', 200);
    }

    private function signatureIsValid(Request $request, ?Channel $channel): bool
    {
        $appSecret = ($channel?->config['app_secret'] ?? null)
            ?: AppSetting::get('whatsapp_app_secret')
            ?: config('services.whatsapp.app_secret');

        if (empty($appSecret)) {
            return true;
        }

        $signature = $request->header('X-Hub-Signature-256');

        if (empty($signature)) {
            return false;
        }

        $expected = 'sha256=' . hash_hmac('sha256', $request->getContent(), $appSecret);

        return hash_equals($expected, $signature);
    }
}
