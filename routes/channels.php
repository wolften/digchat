<?php

use App\Models\Conversation;
use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

/*
| Canais de broadcast (Reverb). Apenas usuários autenticados e ativos
| podem ouvir os canais de atendimento.
*/

// Canal geral de conversas (lista da inbox) — qualquer atendente/gestor/admin ativo.
Broadcast::channel('conversations', function (User $user) {
    return $user->is_active;
});

// Canal geral de chat interno entre atendentes.
Broadcast::channel('internal-chat', function (User $user) {
    return $user->is_active;
});

// Thread de uma conversa específica.
Broadcast::channel('conversation.{conversationId}', function (User $user, int $conversationId) {
    if (! $user->is_active) {
        return false;
    }

    $conversation = Conversation::query()->find($conversationId);
    if (! $conversation) {
        return false;
    }

    return $conversation->canBeViewedBy($user);
});
