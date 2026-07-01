<?php

namespace App\Http\Controllers;

use App\Models\Sector;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class SectorController extends Controller
{
    public function index(): Response
    {
        $sectors = Sector::with('users:id,name,role,profile_photo_path')->orderBy('name')->get()
            ->map(fn (Sector $s) => [
                'id' => $s->id,
                'name' => $s->name,
                'description' => $s->description,
                'is_active' => $s->is_active,
                'users' => $s->users->map(fn (User $u) => [
                    ...$u->publicSummary(),
                    'role' => $u->role,
                ])->values(),
            ]);

        $attendants = User::where('role', User::ROLE_ATENDENTE)
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'profile_photo_path'])
            ->map(fn (User $u) => $u->publicSummary());

        return Inertia::render('Setores/Index', [
            'sectors' => $sectors,
            'attendants' => $attendants,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'description' => ['nullable', 'string', 'max:255'],
            'is_active' => ['boolean'],
        ]);

        Sector::create($validated);

        return back()->with('success', 'Setor criado.');
    }

    public function update(Request $request, Sector $sector): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'description' => ['nullable', 'string', 'max:255'],
            'is_active' => ['boolean'],
        ]);

        $sector->update($validated);

        return back()->with('success', 'Setor atualizado.');
    }

    public function destroy(Sector $sector): RedirectResponse
    {
        $active = $sector->conversations()->whereIn('status', ['queued', 'open'])->exists();

        if ($active) {
            return back()->withErrors(['sector' => 'Existem conversas ativas neste setor. Transfira-as antes de excluir.']);
        }

        $sector->delete();

        return back()->with('success', 'Setor excluído.');
    }

    public function syncUsers(Request $request, Sector $sector): RedirectResponse
    {
        $validated = $request->validate([
            'user_ids' => ['present', 'array'],
            'user_ids.*' => ['integer', 'exists:users,id'],
        ]);

        $sector->users()->sync($validated['user_ids']);

        return back()->with('success', 'Atendentes atualizados.');
    }
}
