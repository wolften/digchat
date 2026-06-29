<?php

namespace App\Http\Controllers;

use App\Models\Tag;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class TagController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('Etiquetas/Index', [
            'tags' => Tag::orderBy('name')->get(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name'      => ['required', 'string', 'max:50', 'unique:tags,name'],
            'color'     => ['required', 'string', 'in:blue,green,amber,red,purple,teal,coral,pink'],
            'is_active' => ['boolean'],
        ]);

        Tag::create($validated);

        return back()->with('success', 'Etiqueta criada.');
    }

    public function update(Request $request, Tag $tag): RedirectResponse
    {
        $validated = $request->validate([
            'name'      => ['required', 'string', 'max:50', 'unique:tags,name,' . $tag->id],
            'color'     => ['required', 'string', 'in:blue,green,amber,red,purple,teal,coral,pink'],
            'is_active' => ['boolean'],
        ]);

        $tag->update($validated);

        return back()->with('success', 'Etiqueta atualizada.');
    }

    public function destroy(Tag $tag): RedirectResponse
    {
        $tag->delete();

        return back()->with('success', 'Etiqueta removida.');
    }
}
