<?php

namespace App\Http\Controllers;

use App\Jobs\ProcessTelegramMessage;
use App\Models\Channel;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Log;

class TelegramWebhookController extends Controller
{
    public function __invoke(Request $request, Channel $channel): Response
    {
        if (! $channel->is_active || $channel->type !== Channel::TYPE_TELEGRAM) {
            return response('Not found', 404);
        }

        $secretToken = $channel->config['webhook_secret'] ?? null;
        if ($secretToken) {
            $header = $request->header('X-Telegram-Bot-Api-Secret-Token');
            if ($header !== $secretToken) {
                Log::warning('Telegram webhook: secret token inválido.', ['channel_id' => $channel->id]);

                return response('Forbidden', 403);
            }
        }

        $payload = $request->json()->all();

        ProcessTelegramMessage::dispatch($payload, $channel->id);

        return response('', 200);
    }
}
