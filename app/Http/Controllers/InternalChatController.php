<?php

namespace App\Http\Controllers;

use App\Events\InternalMessageCreated;
use App\Models\InternalMessage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InternalChatController extends Controller
{
    public function index(): JsonResponse
    {
        $messages = InternalMessage::with('user')
            ->latest()
            ->limit(80)
            ->get()
            ->reverse()
            ->values()
            ->map(fn(InternalMessage $m) => [
                'id'         => $m->id,
                'body'       => $m->body,
                'user_id'    => $m->user_id,
                'user_name'  => $m->user->name,
                'created_at' => $m->created_at->toIso8601String(),
            ]);

        return response()->json($messages);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate(['body' => 'required|string|max:2000']);

        $message = InternalMessage::create([
            'user_id' => $request->user()->id,
            'body'    => $data['body'],
        ]);

        $message->load('user');

        InternalMessageCreated::dispatch($message);

        return response()->json([
            'id'         => $message->id,
            'body'       => $message->body,
            'user_id'    => $message->user_id,
            'user_name'  => $message->user->name,
            'created_at' => $message->created_at->toIso8601String(),
        ], 201);
    }
}
