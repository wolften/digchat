<?php

namespace App\Console\Commands;

use App\Models\Conversation;
use App\Services\Conversation\ConversationDistributionService;
use Illuminate\Console\Command;

class DistributeQueuedConversations extends Command
{
    protected $signature = 'conversations:distribute-queued';

    protected $description = 'Distribui automaticamente conversas na fila sem atendente atribuído.';

    public function handle(ConversationDistributionService $distribution): int
    {
        if (! $distribution->isEnabled()) {
            $this->components->info('Distribuição automática desabilitada.');

            return self::SUCCESS;
        }

        $assigned = 0;

        Conversation::query()
            ->where('status', Conversation::STATUS_QUEUED)
            ->whereNull('assigned_user_id')
            ->orderBy('queued_at')
            ->orderBy('id')
            ->chunkById(50, function ($conversations) use ($distribution, &$assigned): void {
                foreach ($conversations as $conversation) {
                    if ($distribution->tryAssign($conversation)) {
                        $assigned++;
                    }
                }
            });

        $this->components->info("Distribuição concluída. {$assigned} conversa(s) atribuída(s).");

        return self::SUCCESS;
    }
}