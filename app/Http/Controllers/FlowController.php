<?php

namespace App\Http\Controllers;

use App\Models\Flow;
use App\Models\Sector;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class FlowController extends Controller
{
    public function index(): Response
    {
        $flows = Flow::orderByDesc('created_at')
            ->get(['id', 'name', 'description', 'is_active', 'is_default', 'created_at']);

        return Inertia::render('Flows/Index', [
            'flows' => $flows,
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('Flows/Editor', [
            'flow'    => null,
            'sectors' => Sector::where('is_active', true)->orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name'           => 'required|string|max:255',
            'description'    => 'nullable|string|max:1000',
            'definition_raw' => 'required|string',
            'is_active'      => 'boolean',
            'is_default'     => 'boolean',
        ]);

        $definition = json_decode($validated['definition_raw'], true);
        abort_if(! is_array($definition), 422, 'Definição inválida.');

        if ($validated['is_default'] ?? false) {
            Flow::query()->update(['is_default' => false]);
        }

        $flow = Flow::create([
            'name'        => $validated['name'],
            'description' => $validated['description'] ?? null,
            'definition'  => $definition,
            'is_active'   => $validated['is_active'] ?? false,
            'is_default'  => $validated['is_default'] ?? false,
            'created_by'  => auth()->id(),
        ]);

        return redirect()->route('flows.edit', $flow)->with('success', 'Fluxo criado com sucesso!');
    }

    public function edit(Flow $flow): Response
    {
        return Inertia::render('Flows/Editor', [
            'flow'    => $flow->only(['id', 'name', 'description', 'definition', 'is_active', 'is_default']),
            'sectors' => Sector::where('is_active', true)->orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function update(Request $request, Flow $flow): RedirectResponse
    {
        $validated = $request->validate([
            'name'           => 'required|string|max:255',
            'description'    => 'nullable|string|max:1000',
            'definition_raw' => 'required|string',
            'is_active'      => 'boolean',
            'is_default'     => 'boolean',
        ]);

        $definition = json_decode($validated['definition_raw'], true);
        abort_if(! is_array($definition), 422, 'Definição inválida.');

        if ($validated['is_default'] ?? false) {
            Flow::where('id', '!=', $flow->id)->update(['is_default' => false]);
        }

        $flow->update([
            'name'        => $validated['name'],
            'description' => $validated['description'] ?? null,
            'definition'  => $definition,
            'is_active'   => $validated['is_active'] ?? false,
            'is_default'  => $validated['is_default'] ?? false,
        ]);

        return back()->with('success', 'Fluxo salvo!');
    }

    public function destroy(Flow $flow): RedirectResponse
    {
        $flow->delete();

        return redirect()->route('flows.index')->with('success', 'Fluxo excluído.');
    }

    public function activate(Request $request, Flow $flow): RedirectResponse
    {
        $validated = $request->validate([
            'is_active'  => 'sometimes|boolean',
            'is_default' => 'sometimes|boolean',
        ]);

        if ($validated['is_default'] ?? false) {
            Flow::where('id', '!=', $flow->id)->update(['is_default' => false]);
        }

        $flow->update($validated);

        return back()->with('success', 'Fluxo atualizado.');
    }
}
