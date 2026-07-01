<?php

namespace App\Services\Conversation;

use App\Models\AppSetting;
use App\Models\Channel;
use App\Models\Conversation;
use App\Models\User;
use App\Services\Audit\ActivityLogger;
use App\Services\Telegram\TelegramService;
use App\Services\WebChat\WebChatService;
use App\Services\WhatsApp\MessageSender;
use App\Services\WhatsApp\WhatsAppService;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ConversationDistributionService
{
    public function __construct(private ActivityLogger $activity)
    {
    }

    public const STRATEGY_ROUND_ROBIN = 'round_robin';
    public const STRATEGY_LEAST_BUSY = 'least_busy';

    public function isEnabled(): bool
    {
        return AppSetting::bool('auto_assign_conversations_enabled');
    }

    public function tryAssign(Conversation $conversation): bool
    {
        if (! $this->isEnabled()) {
            return false;
        }

        if ($conversation->status !== Conversation::STATUS_QUEUED || $conversation->assigned_user_id !== null) {
            return false;
        }

        $assignee = $this->pickAssignee($conversation);

        if (! $assignee) {
            return false;
        }

        return $this->assign($conversation, $assignee);
    }

    public function assign(Conversation $conversation, User $assignee): bool
    {
        $updated = Conversation::query()
            ->whereKey($conversation->id)
            ->where('status', Conversation::STATUS_QUEUED)
            ->whereNull('assigned_user_id')
            ->update([
                'assigned_user_id' => $assignee->id,
                'status' => Conversation::STATUS_OPEN,
            ]);

        if ($updated === 0) {
            return false;
        }

        $conversation->refresh();
        $conversation->closeSiblingActiveConversations();

        $this->activity->conversationAssigned(null, $conversation, $assignee, 'auto_assign');
        $this->rememberRoundRobinCursor($conversation, $assignee);
        $this->notifyCustomer($conversation, $assignee);

        return true;
    }

    public function pickAssignee(Conversation $conversation): ?User
    {
        $candidates = $this->eligibleAgents($conversation);

        if ($candidates->isEmpty()) {
            return null;
        }

        $strategy = $this->strategy();

        if ($strategy === self::STRATEGY_ROUND_ROBIN) {
            return $this->pickRoundRobin($conversation, $candidates);
        }

        return $this->pickLeastBusy($candidates);
    }

    /** @return Collection<int, User> */
    public function eligibleAgents(Conversation $conversation): Collection
    {
        $sectorId = $conversation->sector_id;
        $maxOpen = max(0, (int) AppSetting::get('auto_assign_max_open_per_agent', 0));

        $agents = User::query()
            ->where('is_active', true)
            ->whereIn('role', [User::ROLE_ATENDENTE, User::ROLE_GESTOR])
            ->when(
                $sectorId,
                fn ($q) => $q->whereHas('sectors', fn ($q2) => $q2->where('sectors.id', $sectorId)),
            )
            ->withCount([
                'conversations as open_conversations_count' => fn ($q) => $q
                    ->where('status', Conversation::STATUS_OPEN),
            ])
            ->orderBy('name')
            ->orderBy('id')
            ->get();

        if ($maxOpen > 0) {
            $agents = $agents
                ->filter(fn (User $user) => $user->open_conversations_count < $maxOpen)
                ->values();
        }

        if (! AppSetting::bool('auto_assign_online_only', true)) {
            return $agents;
        }

        $onlineIds = $this->onlineUserIds();

        return $agents->filter(fn (User $user) => $onlineIds->contains($user->id))->values();
    }

    /** @return Collection<int, int> */
    private function onlineUserIds(): Collection
    {
        $onlineAfter = now()->subMinutes(5)->timestamp;

        $fromSessions = DB::table(config('session.table', 'sessions'))
            ->whereNotNull('user_id')
            ->where('last_activity', '>=', $onlineAfter)
            ->pluck('user_id');

        $fromLastSeen = User::query()
            ->where('is_active', true)
            ->where('last_seen_at', '>=', now()->subMinutes(5))
            ->pluck('id');

        return $fromSessions
            ->merge($fromLastSeen)
            ->unique()
            ->values();
    }

    private function strategy(): string
    {
        $strategy = (string) AppSetting::get('auto_assign_strategy', self::STRATEGY_LEAST_BUSY);

        return in_array($strategy, [self::STRATEGY_ROUND_ROBIN, self::STRATEGY_LEAST_BUSY], true)
            ? $strategy
            : self::STRATEGY_LEAST_BUSY;
    }

    /** @param Collection<int, User> $candidates */
    private function pickLeastBusy(Collection $candidates): User
    {
        return $candidates
            ->sortBy(fn (User $user) => [$user->open_conversations_count, $user->id])
            ->first();
    }

    /** @param Collection<int, User> $candidates */
    private function pickRoundRobin(Conversation $conversation, Collection $candidates): User
    {
        $ids = $candidates->pluck('id')->values();
        $cursorKey = $this->roundRobinCursorKey($conversation);
        $lastId = (int) AppSetting::get($cursorKey, 0);

        $index = $ids->search($lastId);
        $nextIndex = $index === false ? 0 : ($index + 1) % $ids->count();

        return $candidates->firstWhere('id', $ids[$nextIndex]);
    }

    private function rememberRoundRobinCursor(Conversation $conversation, User $assignee): void
    {
        AppSetting::set($this->roundRobinCursorKey($conversation), (string) $assignee->id);
    }

    private function roundRobinCursorKey(Conversation $conversation): string
    {
        $sectorId = $conversation->sector_id ?? 'global';

        return "auto_assign_rr_cursor_sector_{$sectorId}";
    }

    private function notifyCustomer(Conversation $conversation, User $assignee): void
    {
        try {
            $sender = $this->senderFor($conversation);
            $sender->sendText(
                $conversation,
                sprintf('Usuário %s assumiu seu atendimento.', $assignee->name),
            );
        } catch (\Throwable $e) {
            Log::warning('ConversationDistributionService: failed to notify customer', [
                'conversation_id' => $conversation->id,
                'assignee_id' => $assignee->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    private function senderFor(Conversation $conversation): MessageSender
    {
        $channel = $conversation->channel;

        $service = match ($channel?->type) {
            Channel::TYPE_TELEGRAM => new TelegramService($channel),
            Channel::TYPE_WEB      => new WebChatService($channel),
            Channel::TYPE_WHATSAPP => new WhatsAppService($channel),
            default                => new WhatsAppService(),
        };

        return new MessageSender($service);
    }
}