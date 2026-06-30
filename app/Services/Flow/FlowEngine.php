<?php

namespace App\Services\Flow;

use App\Models\Conversation;
use App\Models\Flow;
use App\Models\Message;
use App\Contracts\MessagingChannel;
use App\Services\BusinessHoursService;
use Illuminate\Support\Facades\Log;

class FlowEngine
{
    private const MAX_STEPS = 20;

    public function __construct(
        private MessagingChannel $whatsApp,
    ) {}

    /**
     * Main entry point. Called when a bot-managed conversation receives a message.
     *
     * @param  array<string, mixed>  $rawMessage  Raw WhatsApp message object (for button/list reply ids).
     */
    public function run(Conversation $conversation, ?string $userMessage = null, array $rawMessage = []): void
    {
        $flow = Flow::find($conversation->flow_id);

        if (! $flow) {
            $conversation->update(['status' => Conversation::STATUS_QUEUED]);
            return;
        }

        $currentNodeId = $conversation->current_node_id;

        if ($currentNodeId === null) {
            // First interaction: start from the beginning.
            $startNode = $this->findStartNode($flow);

            if (! $startNode) {
                Log::warning('FlowEngine: flow has no start node', ['flow_id' => $flow->id]);
                $conversation->update(['status' => Conversation::STATUS_QUEUED]);
                return;
            }

            $this->processFrom($conversation, $flow, $startNode['id']);
            return;
        }

        // We're paused at a node (normally a question). Handle the reply.
        $currentNode = $this->findNode($flow, $currentNodeId);

        if (! $currentNode || $currentNode['type'] !== 'question') {
            if (($currentNode['type'] ?? null) === 'ixc_action') {
                $handle = (new IxcBotActionRunner($this->whatsApp))
                    ->handleReply($conversation, $currentNode, $userMessage, $rawMessage);

                if ($handle) {
                    $nextId = $this->findEdgeTarget($flow, $currentNodeId, $handle);
                    if ($nextId) {
                        $this->processFrom($conversation, $flow, $nextId);
                    } else {
                        $conversation->update([
                            'status'          => Conversation::STATUS_QUEUED,
                            'flow_id'         => null,
                            'current_node_id' => null,
                        ]);
                    }
                }

                return;
            }

            $nextId = $this->findEdgeTarget($flow, $currentNodeId);
            if ($nextId) {
                $this->processFrom($conversation, $flow, $nextId);
            } else {
                $conversation->update(['status' => Conversation::STATUS_QUEUED]);
            }
            return;
        }

        // null userMessage (audio, sticker, media) counts as an invalid attempt
        $selectedOptionId = $userMessage !== null
            ? $this->matchOption($currentNode, $userMessage, $rawMessage)
            : null;

        $nextId = $selectedOptionId !== null
            ? $this->findEdgeTarget($flow, $currentNodeId, $selectedOptionId)
            : null;

        if ($nextId) {
            $this->resetAttempts($conversation, $currentNodeId);
            $this->processFrom($conversation, $flow, $nextId);
        } else {
            $this->handleInvalidReply($conversation, $currentNode);
        }
    }

    // -------------------------------------------------------------------------

    private function processFrom(Conversation $conversation, Flow $flow, string $startNodeId): void
    {
        $currentId = $startNodeId;

        for ($step = 0; $step < self::MAX_STEPS; $step++) {
            $node = $this->findNode($flow, $currentId);

            if (! $node) {
                $conversation->update(['status' => Conversation::STATUS_QUEUED]);
                return;
            }

            switch ($node['type']) {
                case 'start':
                    break;

                case 'message':
                    $this->sendMessage($conversation, $node);
                    break;

                case 'question':
                    $this->resetAttempts($conversation, $node['id']);
                    $this->sendQuestion($conversation, $node);
                    $conversation->update(['current_node_id' => $node['id']]);
                    return;

                case 'ixc_action':
                    $handle = (new IxcBotActionRunner($this->whatsApp))->start($conversation, $node);

                    if (! $handle) {
                        $conversation->update(['current_node_id' => $node['id']]);
                        return;
                    }

                    $nextId = $this->findEdgeTarget($flow, $currentId, $handle);

                    if (! $nextId) {
                        $conversation->update([
                            'status'          => Conversation::STATUS_QUEUED,
                            'flow_id'         => null,
                            'current_node_id' => null,
                        ]);
                        return;
                    }

                    $currentId = $nextId;
                    continue 2;

                case 'business_hours_check':
                    $checkSectorId = isset($node['data']['sector_id']) && $node['data']['sector_id']
                        ? (int) $node['data']['sector_id']
                        : $conversation->sector_id;
                    $isOpen = (new BusinessHoursService())->isOpen($checkSectorId);
                    $nextId = $this->findEdgeTarget($flow, $currentId, $isOpen ? 'open' : 'closed');
                    if (! $nextId) {
                        $conversation->update(['status' => Conversation::STATUS_QUEUED, 'flow_id' => null, 'current_node_id' => null]);
                        return;
                    }
                    $currentId = $nextId;
                    continue 2;

                case 'handoff':
                    $sectorId = ! empty($node['data']['sector_id']) ? (int) $node['data']['sector_id'] : null;
                    $conversation->update([
                        'status'          => Conversation::STATUS_QUEUED,
                        'sector_id'       => $sectorId ?? $conversation->sector_id,
                        'flow_id'         => null,
                        'current_node_id' => null,
                    ]);
                    return;

                case 'end':
                    $conversation->update([
                        'status'          => Conversation::STATUS_CLOSED,
                        'flow_id'         => null,
                        'current_node_id' => null,
                    ]);
                    return;

                default:
                    Log::warning("FlowEngine: unknown node type '{$node['type']}'", ['flow_id' => $flow->id]);
                    break;
            }

            $nextId = $this->findEdgeTarget($flow, $currentId);

            if (! $nextId) {
                $conversation->update([
                    'status'          => Conversation::STATUS_QUEUED,
                    'flow_id'         => null,
                    'current_node_id' => null,
                ]);
                return;
            }

            $currentId = $nextId;
        }

        Log::warning('FlowEngine: max steps reached', ['conversation_id' => $conversation->id]);
        $conversation->update(['status' => Conversation::STATUS_QUEUED]);
    }

    private function sendMessage(Conversation $conversation, array $node): void
    {
        $text = trim((string) ($node['data']['message'] ?? ''));

        if ($text === '') {
            return;
        }

        $text        = $this->interpolate($text, $conversation);
        $waId        = $conversation->contact->wa_id;
        $waMessageId = $this->whatsApp->sendText($waId, $text);

        if ($waMessageId) {
            $conversation->messages()->create([
                'direction'     => Message::DIRECTION_OUT,
                'type'          => 'text',
                'body'          => $text,
                'wa_message_id' => $waMessageId,
                'status'        => 'sent',
            ]);
        }
    }

    private function sendQuestion(Conversation $conversation, array $node): void
    {
        $text    = trim((string) ($node['data']['message'] ?? ''));
        $options = array_values($node['data']['options'] ?? []);

        if ($text === '' || empty($options)) {
            return;
        }

        $text        = $this->interpolate($text, $conversation);
        $waId        = $conversation->contact->wa_id;
        $waMessageId = null;

        if (count($options) <= 3) {
            $buttons = array_map(fn ($o) => [
                'id'    => (string) $o['id'],
                'title' => (string) $o['label'],
            ], $options);

            $waMessageId = $this->whatsApp->sendButtons($waId, $text, $buttons);
        } else {
            $rows = array_map(fn ($o) => [
                'id'    => (string) $o['id'],
                'title' => (string) $o['label'],
            ], $options);

            $waMessageId = $this->whatsApp->sendList($waId, $text, 'Ver opções', $rows);
        }

        if ($waMessageId) {
            $preview = $text . "\n" . implode(' | ', array_column($options, 'label'));
            $conversation->messages()->create([
                'direction'     => Message::DIRECTION_OUT,
                'type'          => 'interactive',
                'body'          => $preview,
                'wa_message_id' => $waMessageId,
                'status'        => 'sent',
            ]);
        }
    }

    private function handleInvalidReply(Conversation $conversation, array $node): void
    {
        $maxRetries     = max(1, (int) ($node['data']['max_retries'] ?? 3));
        $retryMessage   = trim((string) ($node['data']['retry_message'] ?? ''));
        $fallbackMsg    = trim((string) ($node['data']['fallback_message'] ?? ''));
        $fallbackSector = ! empty($node['data']['fallback_sector_id'])
            ? (int) $node['data']['fallback_sector_id']
            : null;

        $attempts = $this->incrementAttempts($conversation, $node['id']);

        if ($attempts >= $maxRetries) {
            $this->resetAttempts($conversation, $node['id']);

            if ($fallbackMsg !== '') {
                $this->whatsApp->sendText($conversation->contact->wa_id, $fallbackMsg);
            }

            $conversation->update([
                'status'          => Conversation::STATUS_QUEUED,
                'sector_id'       => $fallbackSector ?? $conversation->sector_id,
                'flow_id'         => null,
                'current_node_id' => null,
            ]);

            return;
        }

        if ($retryMessage !== '') {
            $this->whatsApp->sendText($conversation->contact->wa_id, $retryMessage);
        }

        $this->sendQuestion($conversation, $node);
    }

    private function incrementAttempts(Conversation $conversation, string $nodeId): int
    {
        $context  = $conversation->context ?? [];
        $attempts = (int) ($context['attempts'][$nodeId] ?? 0) + 1;
        $context['attempts'][$nodeId] = $attempts;
        $conversation->update(['context' => $context]);

        return $attempts;
    }

    private function resetAttempts(Conversation $conversation, string $nodeId): void
    {
        $context = $conversation->context ?? [];

        if (isset($context['attempts'][$nodeId])) {
            unset($context['attempts'][$nodeId]);
            $conversation->update(['context' => $context]);
        }
    }

    /**
     * Match a user reply (text or button/list id) to a question option.
     *
     * @param  array<string, mixed>  $rawMessage
     */
    private function matchOption(array $node, string $userMessage, array $rawMessage): ?string
    {
        $options = $node['data']['options'] ?? [];

        $replyId = data_get($rawMessage, 'interactive.button_reply.id')
            ?? data_get($rawMessage, 'interactive.list_reply.id');

        if ($replyId !== null) {
            foreach ($options as $option) {
                if ((string) $option['id'] === (string) $replyId) {
                    return (string) $option['id'];
                }
            }
        }

        $lower = mb_strtolower(trim($userMessage));
        foreach ($options as $option) {
            if (mb_strtolower(trim((string) $option['label'])) === $lower) {
                return (string) $option['id'];
            }
        }

        return null;
    }

    private function findEdgeTarget(Flow $flow, string $sourceNodeId, ?string $sourceHandle = null): ?string
    {
        foreach ($flow->edges as $edge) {
            if (($edge['source'] ?? '') !== $sourceNodeId) {
                continue;
            }

            $edgeHandle = $edge['sourceHandle'] ?? null;

            if ($sourceHandle === null) {
                if ($edgeHandle === null || $edgeHandle === '') {
                    return $edge['target'];
                }
            } else {
                if ($edgeHandle === $sourceHandle) {
                    return $edge['target'];
                }
            }
        }

        return null;
    }

    private function findNode(Flow $flow, string $nodeId): ?array
    {
        foreach ($flow->nodes as $node) {
            if ((string) ($node['id'] ?? '') === $nodeId) {
                return $node;
            }
        }
        return null;
    }

    private function findStartNode(Flow $flow): ?array
    {
        foreach ($flow->nodes as $node) {
            if (($node['type'] ?? '') === 'start') {
                return $node;
            }
        }
        return null;
    }

    private function interpolate(string $text, Conversation $conversation): string
    {
        $name = $conversation->contact->profile_name ?? 'Cliente';
        return str_replace(['{{nome}}', '{{name}}'], $name, $text);
    }
}
