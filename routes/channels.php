<?php

use App\Models\Conversation;
use App\Models\InternalConversation;
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

// Lista de conversas do chat interno.
Broadcast::channel('internal-conversations', function (User $user) {
    return $user->is_active;
});

// Thread de uma conversa interna específica.
Broadcast::channel('internal-conversation.{conversationId}', function (User $user, int $conversationId) {
    if (! $user->is_active) {
        return false;
    }

    $conversation = InternalConversation::query()->find($conversationId);

    return $conversation?->isParticipant($user) ?? false;
});

// Canal pessoal (notificações do chat interno).
Broadcast::channel('user.{userId}', function (User $user, int $userId) {
    return $user->is_active && (int) $user->id === $userId;
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
