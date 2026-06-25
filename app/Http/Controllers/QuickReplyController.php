<?php

namespace App\Http\Controllers;

use App\Models\QuickReply;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class QuickReplyController extends Controller
{
    public function index(): Response
    {
        $replies = QuickReply::orderBy('trigger')->get();

        return Inertia::render('RespostasRapidas/Index', ['replies' => $replies]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'trigger'   => ['required', 'string', 'max:50', 'unique:quick_replies,trigger', 'regex:/^[a-z0-9_]+$/'],
            'title'     => ['required', 'string', 'max:100'],
            'content'   => ['required', 'string'],
            'is_active' => ['boolean'],
        ]);

        QuickReply::create($validated);

        return back()->with('success', 'Resposta rápida criada.');
    }

    public function update(Request $request, QuickReply $quickReply): RedirectResponse
    {
        $validated = $request->validate([
            'trigger'   => ['required', 'string', 'max:50', "unique:quick_replies,trigger,{$quickReply->id}", 'regex:/^[a-z0-9_]+$/'],
            'title'     => ['required', 'string', 'max:100'],
            'content'   => ['required', 'string'],
            'is_active' => ['boolean'],
        ]);

        $quickReply->update($validated);

        return back()->with('success', 'Resposta rápida atualizada.');
    }

    public function destroy(QuickReply $quickReply): RedirectResponse
    {
        $quickReply->delete();

        return back()->with('success', 'Resposta rápida excluída.');
    }
}
