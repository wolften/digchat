<?php

namespace App\Http\Controllers;

use App\Models\Channel;
use App\Services\Audit\ActivityLogger;
use App\Services\Telegram\TelegramService;
use App\Services\WebChat\WebChatService;
use App\Services\WhatsApp\WhatsAppService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
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

        $config = $data['config'];

        // Gera a api_key automaticamente para canais web (nunca vem do front).
        if ($data['type'] === Channel::TYPE_WEB) {
            $config['api_key'] = Str::random(40);
        }

        $channel = Channel::create([
            'type'      => $data['type'],
            'name'      => $data['name'],
            'config'    => $config,
            'is_active' => $data['is_active'] ?? true,
        ]);

        if ($channel->type === Channel::TYPE_TELEGRAM && ! empty($data['config']['bot_token'])) {
            $telegram = new TelegramService($channel);
            if (! $telegram->setWebhook($channel->webhookUrl(), $data['config']['webhook_secret'] ?? null)) {
                return redirect()->route('canais.index')->with('warning',
                    'Canal criado, mas o webhook do Telegram não pôde ser registrado: '
                    . ($telegram->getLastErrorMessage() ?? 'erro desconhecido')
                    . '. As mensagens não chegarão até que o webhook seja registrado com sucesso.');
            }
        }

        app(ActivityLogger::class)->channelCreated($request->user(), $channel);

        return redirect()->route('canais.index')
            ->with('success', 'Canal criado com sucesso.');
    }

    public function update(Request $request, Channel $channel): RedirectResponse
    {
        $data = $this->validated($request, isUpdate: true);

        $config = $this->mergeUnchangedSecrets($channel, $data['config']);
        $before = $channel->only(['type', 'name', 'is_active']);
        $configChanged = json_encode($channel->config ?? []) !== json_encode($config);

        $channel->update([
            'type'      => $data['type'],
            'name'      => $data['name'],
            'config'    => $config,
            'is_active' => $data['is_active'] ?? $channel->is_active,
        ]);

        $changes = [];
        foreach ($before as $key => $value) {
            if ($channel->{$key} != $value) {
                $changes[$key] = ['from' => $value, 'to' => $channel->{$key}];
            }
        }

        if ($configChanged) {
            $changes['config'] = ['from' => null, 'to' => 'updated'];
        }

        app(ActivityLogger::class)->channelUpdated($request->user(), $channel, $changes);

        if ($channel->type === Channel::TYPE_TELEGRAM && ! empty($config['bot_token'])) {
            $telegram = new TelegramService($channel->fresh());
            if (! $telegram->setWebhook($channel->webhookUrl(), $config['webhook_secret'] ?? null)) {
                return redirect()->route('canais.index')->with('warning',
                    'Canal atualizado, mas o webhook do Telegram não pôde ser registrado: '
                    . ($telegram->getLastErrorMessage() ?? 'erro desconhecido')
                    . '. As mensagens não chegarão até que o webhook seja registrado com sucesso.');
            }
        }

        return redirect()->route('canais.index')
            ->with('success', 'Canal atualizado com sucesso.');
    }

    public function destroy(Channel $channel): RedirectResponse
    {
        if ($channel->type === Channel::TYPE_TELEGRAM) {
            (new TelegramService($channel))->deleteWebhook();
        }

        app(ActivityLogger::class)->channelDeleted(request()->user(), $channel);

        $channel->delete();

        return redirect()->route('canais.index')
            ->with('success', 'Canal removido.');
    }

    public function regenerateApiKey(Channel $channel): JsonResponse
    {
        if ($channel->type !== Channel::TYPE_WEB) {
            return response()->json(['status' => 'error', 'message' => 'Apenas canais Web possuem API Key.'], 422);
        }

        $newKey = Str::random(40);
        $channel->update(['config' => array_merge($channel->config ?? [], ['api_key' => $newKey])]);

        return response()->json(['status' => 'ok', 'api_key' => $newKey]);
    }

    public function testConnection(Channel $channel): JsonResponse
    {
        $result = match ($channel->type) {
            Channel::TYPE_TELEGRAM => (new TelegramService($channel))->healthCheck(),
            Channel::TYPE_WEB      => (new WebChatService($channel))->healthCheck(),
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
    private function validated(Request $request, bool $isUpdate = false): array
    {
        $type = $request->input('type');

        $rules = [
            'type'      => 'required|in:whatsapp,telegram,web',
            'name'      => 'required|string|max:255',
            'is_active' => 'boolean',
            'config'    => 'required|array',
        ];

        if ($type === Channel::TYPE_WHATSAPP) {
            $rules['config.access_token']    = 'nullable|string';
            $rules['config.phone_number_id'] = 'nullable|string';
            $rules['config.api_version']     = 'nullable|string|max:10';
            $rules['config.verify_token']    = 'nullable|string';
            $rules['config.app_secret']      = 'nullable|string';
            $rules['config.waba_id']         = 'nullable|string';
        } elseif ($type === Channel::TYPE_TELEGRAM) {
            // No update, campo em branco significa "manter o token atual" (ver mergeUnchangedSecrets).
            $rules['config.bot_token']        = $isUpdate ? 'nullable|string' : 'required|string';
            $rules['config.webhook_secret']   = 'nullable|string';
            $rules['config.webhook_base_url'] = 'nullable|url';
        } else {
            // Web: apenas configurações visuais/posição vindas do front
            $rules['config.position']    = 'nullable|in:bottom-right,bottom-left,top-right,top-left';
            $rules['config.accent_color'] = 'nullable|string|max:20';
            $rules['config.title']        = 'nullable|string|max:80';
            $rules['config.subtitle']     = 'nullable|string|max:120';
        }

        return $request->validate($rules);
    }

    /**
     * O front sempre envia os campos de segredo (token, secrets) em branco ao editar,
     * para não reexibi-los. Um valor vazio nesses campos significa "manter o atual".
     *
     * @param array<string, mixed> $config
     * @return array<string, mixed>
     */
    private function mergeUnchangedSecrets(Channel $channel, array $config): array
    {
        $secretKeys = match ($channel->type) {
            Channel::TYPE_WHATSAPP => ['access_token', 'app_secret', 'verify_token'],
            Channel::TYPE_TELEGRAM => ['bot_token', 'webhook_secret'],
            Channel::TYPE_WEB      => ['api_key'],
            default                => [],
        };

        foreach ($secretKeys as $key) {
            if (empty($config[$key]) && ! empty($channel->config[$key])) {
                $config[$key] = $channel->config[$key];
            }
        }

        return $config;
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

        if ($channel->type === Channel::TYPE_WEB) {
            return [
                'api_key'      => $channel->config['api_key'] ?? null,
                'position'     => $channel->config['position'] ?? 'bottom-right',
                'accent_color' => $channel->config['accent_color'] ?? '#6d28d9',
                'title'        => $channel->config['title'] ?? 'Suporte',
                'subtitle'     => $channel->config['subtitle'] ?? 'Responderemos em breve',
            ];
        }

        return [];
    }
}
