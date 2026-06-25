<?php

namespace App\Http\Controllers;

use App\Models\IntegrationConfig;
use App\Services\Ixc\IxcClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class IntegrationConfigController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'type'      => ['required', 'in:ixc'],
            'name'      => ['required', 'string', 'max:255'],
            'base_url'  => ['required', 'url', 'max:255'],
            'token'     => ['required', 'string', 'max:512'],
            'is_active' => ['boolean'],
        ]);

        IntegrationConfig::create($validated);

        return back()->with('success', 'Integração criada com sucesso.');
    }

    public function update(Request $request, IntegrationConfig $integrationConfig): RedirectResponse
    {
        $validated = $request->validate([
            'name'      => ['required', 'string', 'max:255'],
            'base_url'  => ['required', 'url', 'max:255'],
            'token'     => ['nullable', 'string', 'max:512'],
            'is_active' => ['boolean'],
        ]);

        if (empty($validated['token'])) {
            unset($validated['token']);
        }

        $integrationConfig->update($validated);

        return back()->with('success', 'Integração atualizada.');
    }

    public function destroy(IntegrationConfig $integrationConfig): RedirectResponse
    {
        $integrationConfig->delete();

        return back()->with('success', 'Integração removida.');
    }

    public function testConnection(IntegrationConfig $integrationConfig): JsonResponse
    {
        $client = new IxcClient($integrationConfig);
        $ok     = $client->testConnection();

        return response()->json([
            'ok'      => $ok,
            'message' => $ok ? 'Conexão estabelecida com sucesso.' : 'Não foi possível conectar à API do IXC.',
        ]);
    }
}
