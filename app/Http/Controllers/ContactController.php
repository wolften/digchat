<?php

namespace App\Http\Controllers;

use App\Models\Contact;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ContactController extends Controller
{
    public function updateNotes(Request $request, Contact $contact): JsonResponse
    {
        $validated = $request->validate([
            'notes' => ['nullable', 'string', 'max:10000'],
        ]);

        $contact->update(['notes' => $validated['notes'] ?? null]);

        return response()->json(['ok' => true]);
    }
}
