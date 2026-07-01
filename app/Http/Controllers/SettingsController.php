<?php

namespace App\Http\Controllers;

use App\Models\AppSetting;
use App\Models\IntegrationConfig;
use App\Models\Survey;
use App\Services\WhatsApp\WhatsAppService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class SettingsController extends Controller
{
    public function index(): Response
    {
        $settings     = AppSetting::allCached();
        $surveys      = Survey::where('is_active', true)->orderBy('name')->get(['id', 'name']);
        $integrations = IntegrationConfig::orderBy('type')->orderBy('name')->get([
            'id',
            'type',
            'name',
            'base_url',
            'is_active',
        ]);

        return Inertia::render('Configuracoes/Index', [
            'settings'     => $settings,
            'surveys'      => $surveys,
            'integrations' => $integrations,
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'whatsapp_access_token'   => ['nullable', 'string', 'max:512'],
            'whatsapp_phone_number_id' => ['nullable', 'string', 'max:100'],
            'whatsapp_api_version'    => ['nullable', 'string', 'max:20'],
            'whatsapp_verify_token'   => ['nullable', 'string', 'max:255'],
            'whatsapp_app_secret'     => ['nullable', 'string', 'max:255'],
            'whatsapp_waba_id'        => ['nullable', 'string', 'max:100'],
            'groq_api_key'            => ['nullable', 'string', 'max:255'],
            'auto_transcribe_audio'   => ['nullable', 'boolean'],
        ]);

        if ($request->exists('auto_transcribe_audio')) {
            AppSetting::set(
                'auto_transcribe_audio',
                $request->boolean('auto_transcribe_audio') ? '1' : '0',
            );
        }

        // Preserve existing values for fields sent empty (don't overwrite with null unless explicitly cleared)
        $toSave = array_filter($validated, fn ($v) => $v !== null && $v !== '');
        unset($toSave['auto_transcribe_audio']);

        AppSetting::setMany($toSave);

        return back()->with('success', 'Configurações salvas.');
    }

    public function whatsappHealth(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'whatsapp_access_token'   => ['nullable', 'string', 'max:512'],
            'whatsapp_phone_number_id' => ['nullable', 'string', 'max:100'],
            'whatsapp_api_version'    => ['nullable', 'string', 'max:20'],
        ]);

        $accessToken = trim((string) ($validated['whatsapp_access_token'] ?? ''));
        $phoneNumberId = trim((string) ($validated['whatsapp_phone_number_id'] ?? ''));
        $apiVersion = trim((string) ($validated['whatsapp_api_version'] ?? ''));

        if ($accessToken === '' || $phoneNumberId === '') {
            return response()->json([
                'status' => 'error',
                'title' => 'WhatsApp não configurado',
                'message' => 'Informe o Access Token e o Phone Number ID antes de testar a conexão.',
                'details' => [
                    'missing' => implode(', ', array_values(array_filter([
                        $accessToken === '' ? 'access_token' : null,
                        $phoneNumberId === '' ? 'phone_number_id' : null,
                    ]))),
                ],
            ]);
        }

        $service = new WhatsAppService([
            'access_token' => $accessToken,
            'phone_number_id' => $phoneNumberId,
            'api_version' => $apiVersion !== '' ? $apiVersion : null,
        ]);

        return response()->json($service->healthCheck());
    }

    public function updateSystem(Request $request): RedirectResponse
    {
        $request->validate([
            'app_name'     => ['nullable', 'string', 'max:80'],
            'app_subtitle' => ['nullable', 'string', 'max:120'],
            'app_icon' => ['nullable', 'image', 'mimes:png,jpg,jpeg,svg,webp', 'max:512'],
            'notify_customer_on_transfer' => ['nullable'],
            'auto_close_inactive_conversations_enabled' => ['nullable', 'boolean'],
            'auto_close_inactive_conversations_minutes' => ['required', 'integer', 'min:1', 'max:10080'],
            'survey_on_close_enabled' => ['nullable', 'boolean'],
            'survey_on_close_survey_id' => ['nullable', 'integer', 'exists:surveys,id'],
            'survey_on_inactivity_close_enabled' => ['nullable', 'boolean'],
            'ooh_notify_interval_hours'          => ['nullable', 'integer', 'min:1', 'max:72'],
        ]);

        if ($request->filled('app_name')) {
            AppSetting::set('app_name', $request->string('app_name')->trim());
        }

        if ($request->filled('app_subtitle')) {
            AppSetting::set('app_subtitle', $request->string('app_subtitle')->trim());
        }

        AppSetting::set(
            'notify_customer_on_transfer',
            $request->boolean('notify_customer_on_transfer') ? '1' : '0',
        );

        AppSetting::set(
            'auto_close_inactive_conversations_enabled',
            $request->boolean('auto_close_inactive_conversations_enabled') ? '1' : '0',
        );

        AppSetting::set(
            'auto_close_inactive_conversations_minutes',
            (string) $request->integer('auto_close_inactive_conversations_minutes'),
        );

        AppSetting::set(
            'survey_on_close_enabled',
            $request->boolean('survey_on_close_enabled') ? '1' : '0',
        );

        $surveyId = $request->input('survey_on_close_survey_id');
        AppSetting::set('survey_on_close_survey_id', $surveyId ? (string) (int) $surveyId : '');

        AppSetting::set(
            'survey_on_inactivity_close_enabled',
            $request->boolean('survey_on_inactivity_close_enabled') ? '1' : '0',
        );

        $intervalHours = $request->integer('ooh_notify_interval_hours');
        if ($intervalHours >= 1) {
            AppSetting::set('ooh_notify_interval_hours', (string) $intervalHours);
        }

        if ($request->hasFile('app_icon')) {
            $old = AppSetting::get('app_icon_path');
            if ($old && Storage::disk('public')->exists($old)) {
                Storage::disk('public')->delete($old);
            }

            $path = $request->file('app_icon')->store('icons', 'public');
            AppSetting::set('app_icon_path', $path);
            AppSetting::set('app_icon_url', asset(Storage::url($path)));
        }

        return back()->with('success', 'Configurações do sistema salvas.');
    }
}
