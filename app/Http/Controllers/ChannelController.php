<?php

namespace App\Http\Controllers;

use App\Models\Channel;
use App\Services\Telegram\TelegramService;
use App\Services\WhatsApp\WhatsAppService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ChannelController extends Controller
{
    public function index(): Response
    {
        $channels = Channel::orderBy('type')->orderBy('name')->get()->map(fn (Channel $ch) => [
            'id'          => $ch->id,
            'type'        => $ch->type,
            'name'        => $ch->name,
            'is_active'   => $ch->is_active,
            'webhook_url' => $ch->webhookUrl(),
            'meta'        => $this->safeMeta($ch),
        ]);

        return Inertia::render('Canais/Index', ['channels' => $channels]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validated($request);

        $channel = Channel::create([
            'type'      => $data['type'],
            'name'      => $data['name'],
            'config'    => $data['config'],
            'is_active' => $data['is_active'] ?? true,
        ]);

        if ($channel->type === Channel::TYPE_TELEGRAM && ! empty($data['config']['bot_token'])) {
            $telegram = new TelegramService($channel);
            $telegram->setWebhook(
                $channel->webhookUrl(),
                $data['config']['webhook_secret'] ?? null,
            );
        }

        return redirect()->route('canais.index')
            ->with('success', 'Canal criado com sucesso.');
    }

    public function update(Request $request, Channel $channel): RedirectResponse
    {
        $data = $this->validated($request);

        $channel->update([
            'type'      => $data['type'],
            'name'      => $data['name'],
            'config'    => $data['config'],
            'is_active' => $data['is_active'] ?? $channel->is_active,
        ]);

        if ($channel->type === Channel::TYPE_TELEGRAM && ! empty($data['config']['bot_token'])) {
            $telegram = new TelegramService($channel->fresh());
            $telegram->setWebhook(
                $channel->webhookUrl(),
                $data['config']['webhook_secret'] ?? null,
            );
        }

        return redirect()->route('canais.index')
            ->with('success', 'Canal atualizado com sucesso.');
    }

    public function destroy(Channel $channel): RedirectResponse
    {
        if ($channel->type === Channel::TYPE_TELEGRAM) {
            (new TelegramService($channel))->deleteWebhook();
        }

        $channel->delete();

        return redirect()->route('canais.index')
            ->with('success', 'Canal removido.');
    }

    public function testConnection(Channel $channel): JsonResponse
    {
        $result = match ($channel->type) {
            Channel::TYPE_TELEGRAM => (new TelegramService($channel))->healthCheck(),
            default                => (new WhatsAppService($channel))->healthCheck(),
        };

        return response()->json($result);
    }

    public function registerWebhook(Channel $channel): JsonResponse
    {
        if ($channel->type !== Channel::TYPE_TELEGRAM) {
            return response()->json(['status' => 'error', 'message' => 'Somente canais Telegram precisam registrar webhook.'], 422);
        }

        $telegram = new TelegramService($channel);
        $ok = $telegram->setWebhook(
            $channel->webhookUrl(),
            $channel->config['webhook_secret'] ?? null,
        );

        if ($ok) {
            return response()->json(['status' => 'ok', 'message' => 'Webhook registrado com sucesso.']);
        }

        return response()->json([
            'status'  => 'error',
            'message' => $telegram->getLastErrorMessage() ?? 'Falha ao registrar webhook.',
        ], 422);
    }

    /** @return array<string, mixed> */
    private function validated(Request $request): array
    {
        $type = $request->input('type');

        $rules = [
            'type'             => 'required|in:whatsapp,telegram',
            'name'             => 'required|string|max:255',
            'is_active'        => 'boolean',
            'config'           => 'required|array',
        ];

        if ($type === Channel::TYPE_WHATSAPP) {
            $rules['config.access_token']    = 'nullable|string';
            $rules['config.phone_number_id'] = 'nullable|string';
            $rules['config.api_version']     = 'nullable|string|max:10';
            $rules['config.verify_token']    = 'nullable|string';
            $rules['config.app_secret']      = 'nullable|string';
            $rules['config.waba_id']         = 'nullable|string';
        } else {
            $rules['config.bot_token']        = 'required|string';
            $rules['config.webhook_secret']   = 'nullable|string';
            $rules['config.webhook_base_url'] = 'nullable|url';
        }

        return $request->validate($rules);
    }

    /** Remove informações sensíveis antes de enviar ao front */
    private function safeMeta(Channel $channel): array
    {
        if ($channel->type === Channel::TYPE_WHATSAPP) {
            return [
                'phone_number_id' => $channel->config['phone_number_id'] ?? null,
                'api_version'     => $channel->config['api_version'] ?? null,
                'waba_id'         => $channel->config['waba_id'] ?? null,
                'has_token'       => ! empty($channel->config['access_token']),
                'has_app_secret'  => ! empty($channel->config['app_secret']),
            ];
        }

        if ($channel->type === Channel::TYPE_TELEGRAM) {
            return [
                'has_token'          => ! empty($channel->config['bot_token']),
                'has_webhook_secret' => ! empty($channel->config['webhook_secret']),
                'webhook_base_url'   => $channel->config['webhook_base_url'] ?? null,
            ];
        }

        return [];
    }
}
