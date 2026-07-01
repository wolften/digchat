<?php

namespace App\Http\Controllers;

use App\Models\Conversation;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class ConversationTagController extends Controller
{
    public function sync(Request $request, Conversation $conversation): RedirectResponse
    {
        abort_unless($conversation->canBeViewedBy($request->user()), 403);

        $validated = $request->validate([
            'tag_ids'   => ['array'],
            'tag_ids.*' => ['integer', 'exists:tags,id'],
        ]);

        $conversation->contact->tags()->sync($validated['tag_ids'] ?? []);

        return back();
    }
}
