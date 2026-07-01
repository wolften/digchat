<?php

namespace App\Services\Audit;

use App\Enums\ActivityEvent;
use App\Models\ActivityLog;
use App\Models\Channel;
use App\Models\Conversation;
use App\Models\Sector;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;

class ActivityLogger
{
    public function userLoggedIn(User $user, ?Request $request = null): ActivityLog
    {
        return $this->record(
            ActivityEvent::AuthLogin,
            $user,
            $user,
            [
                'ip' => $request?->ip(),
            ],
            sprintf('%s entrou no sistema.', $user->name),
        );
    }

    public function userLoggedOut(User $user): ActivityLog
    {
        return $this->record(
            ActivityEvent::AuthLogout,
            $user,
            $user,
            [],
            sprintf('%s saiu do sistema.', $user->name),
        );
    }

    public function presenceChanged(User $user, string $from, string $to): ?ActivityLog
    {
        $event = match ($to) {
            'online' => ActivityEvent::PresenceOnline,
            'away' => ActivityEvent::PresenceAway,
            'offline' => ActivityEvent::PresenceOffline,
            default => null,
        };

        if ($event === null) {
            return null;
        }

        $labels = [
            'online' => 'online',
            'away' => 'ausente',
            'offline' => 'offline',
            'inactive' => 'inativo',
        ];

        return $this->record(
            $event,
            $user,
            $user,
            ['from' => $from, 'to' => $to],
            sprintf(
                '%s ficou %s (antes: %s).',
                $user->name,
                $labels[$to] ?? $to,
                $labels[$from] ?? $from,
            ),
        );
    }

    public function conversationAssigned(
        ?User $actor,
        Conversation $conversation,
        User $assignee,
        string $trigger = 'manual',
    ): ActivityLog {
        $context = $this->conversationContext($conversation);

        return $this->record(
            ActivityEvent::ConversationAssigned,
            $actor,
            $conversation,
            array_merge($context, [
                'assignee_id' => $assignee->id,
                'assignee_name' => $assignee->name,
                'trigger' => $trigger,
            ]),
            $actor
                ? sprintf('%s assumiu o atendimento %s.', $actor->name, $this->conversationLabel($conversation))
                : sprintf('Sistema atribuiu o atendimento %s a %s.', $this->conversationLabel($conversation), $assignee->name),
        );
    }

    public function conversationTransferred(
        User $actor,
        Conversation $conversation,
        ?int $fromUserId,
        ?string $fromUserName,
        ?int $fromSectorId,
        ?string $fromSectorName,
        ?int $toUserId = null,
        ?string $toUserName = null,
        ?int $toSectorId = null,
        ?string $toSectorName = null,
        string $mode = 'user',
    ): ActivityLog {
        $context = $this->conversationContext($conversation);

        $description = $mode === 'user'
            ? sprintf(
                '%s transferiu o atendimento %s para %s.',
                $actor->name,
                $this->conversationLabel($conversation),
                $toUserName ?? 'outro atendente',
            )
            : sprintf(
                '%s transferiu o atendimento %s para o setor %s.',
                $actor->name,
                $this->conversationLabel($conversation),
                $toSectorName ?? 'outro setor',
            );

        return $this->record(
            ActivityEvent::ConversationTransferred,
            $actor,
            $conversation,
            array_merge($context, [
                'mode' => $mode,
                'from_user_id' => $fromUserId,
                'from_user_name' => $fromUserName,
                'from_sector_id' => $fromSectorId,
                'from_sector_name' => $fromSectorName,
                'to_user_id' => $toUserId,
                'to_user_name' => $toUserName,
                'to_sector_id' => $toSectorId,
                'to_sector_name' => $toSectorName,
            ]),
            $description,
        );
    }

    public function conversationClosed(
        ?User $actor,
        Conversation $conversation,
        string $reason = 'manual',
        ?string $finalStatus = null,
    ): ActivityLog {
        $context = $this->conversationContext($conversation);

        $reasonLabels = [
            'manual' => 'encerrado',
            'auto_inactive' => 'encerrado por inatividade',
            'survey_completed' => 'encerrado após pesquisa',
            'flow_end' => 'encerrado pelo fluxo',
            'surveying' => 'enviado para pesquisa',
        ];

        $verb = $reasonLabels[$reason] ?? 'encerrado';

        return $this->record(
            ActivityEvent::ConversationClosed,
            $actor,
            $conversation,
            array_merge($context, [
                'reason' => $reason,
                'final_status' => $finalStatus ?? $conversation->status,
            ]),
            $actor
                ? sprintf('%s %s o atendimento %s.', $actor->name, $verb, $this->conversationLabel($conversation))
                : sprintf('Sistema %s o atendimento %s.', $verb, $this->conversationLabel($conversation)),
        );
    }

    public function conversationForceClosed(User $actor, Conversation $conversation): ActivityLog
    {
        $context = $this->conversationContext($conversation);

        return $this->record(
            ActivityEvent::ConversationForceClosed,
            $actor,
            $conversation,
            $context,
            sprintf('%s forçou o encerramento do atendimento %s.', $actor->name, $this->conversationLabel($conversation)),
        );
    }

    public function conversationSnoozed(
        User $actor,
        Conversation $conversation,
        CarbonInterface $until,
        ?string $note = null,
    ): ActivityLog {
        $context = $this->conversationContext($conversation);

        return $this->record(
            ActivityEvent::ConversationSnoozed,
            $actor,
            $conversation,
            array_merge($context, [
                'snoozed_until' => $until->toIso8601String(),
                'note' => $note,
            ]),
            sprintf('%s adiou o atendimento %s.', $actor->name, $this->conversationLabel($conversation)),
        );
    }

    public function conversationWoken(
        Conversation $conversation,
        string $reason = 'manual',
        ?User $actor = null,
    ): ActivityLog {
        $context = $this->conversationContext($conversation);

        $reasonLabels = [
            'manual' => 'retomou',
            'expired' => 'reativou (lembrete expirado)',
            'customer_message' => 'reativou (mensagem do cliente)',
        ];

        $verb = $reasonLabels[$reason] ?? 'retomou';

        return $this->record(
            ActivityEvent::ConversationWoken,
            $actor,
            $conversation,
            array_merge($context, ['reason' => $reason]),
            $actor
                ? sprintf('%s %s o atendimento %s.', $actor->name, $verb, $this->conversationLabel($conversation))
                : sprintf('Sistema %s o atendimento %s.', $verb, $this->conversationLabel($conversation)),
        );
    }

    public function userCreated(User $actor, User $created): ActivityLog
    {
        return $this->record(
            ActivityEvent::UserCreated,
            $actor,
            $created,
            [
                'name' => $created->name,
                'email' => $created->email,
                'role' => $created->role,
                'is_active' => $created->is_active,
            ],
            sprintf('%s criou o usuário %s (%s).', $actor->name, $created->name, $created->email),
        );
    }

    /** @param  array<string, mixed>  $changes */
    public function userUpdated(User $actor, User $user, array $changes): ?ActivityLog
    {
        if ($changes === []) {
            return null;
        }

        return $this->record(
            ActivityEvent::UserUpdated,
            $actor,
            $user,
            ['changes' => $changes],
            sprintf('%s atualizou o usuário %s.', $actor->name, $user->name),
        );
    }

    public function userDeleted(User $actor, User $deleted): ActivityLog
    {
        return $this->record(
            ActivityEvent::UserDeleted,
            $actor,
            null,
            [
                'user_id' => $deleted->id,
                'name' => $deleted->name,
                'email' => $deleted->email,
                'role' => $deleted->role,
            ],
            sprintf('%s removeu o usuário %s.', $actor->name, $deleted->name),
        );
    }

    public function sectorCreated(User $actor, Sector $sector): ActivityLog
    {
        return $this->record(
            ActivityEvent::SectorCreated,
            $actor,
            $sector,
            ['name' => $sector->name],
            sprintf('%s criou o setor %s.', $actor->name, $sector->name),
        );
    }

    /** @param  array<string, mixed>  $changes */
    public function sectorUpdated(User $actor, Sector $sector, array $changes): ?ActivityLog
    {
        if ($changes === []) {
            return null;
        }

        return $this->record(
            ActivityEvent::SectorUpdated,
            $actor,
            $sector,
            ['changes' => $changes],
            sprintf('%s atualizou o setor %s.', $actor->name, $sector->name),
        );
    }

    public function sectorDeleted(User $actor, Sector $sector): ActivityLog
    {
        return $this->record(
            ActivityEvent::SectorDeleted,
            $actor,
            null,
            [
                'sector_id' => $sector->id,
                'name' => $sector->name,
            ],
            sprintf('%s removeu o setor %s.', $actor->name, $sector->name),
        );
    }

    public function channelCreated(User $actor, Channel $channel): ActivityLog
    {
        return $this->record(
            ActivityEvent::ChannelCreated,
            $actor,
            $channel,
            ['name' => $channel->name, 'type' => $channel->type],
            sprintf('%s criou o canal %s (%s).', $actor->name, $channel->name, $channel->type),
        );
    }

    /** @param  array<string, mixed>  $changes */
    public function channelUpdated(User $actor, Channel $channel, array $changes): ?ActivityLog
    {
        if ($changes === []) {
            return null;
        }

        return $this->record(
            ActivityEvent::ChannelUpdated,
            $actor,
            $channel,
            ['changes' => $changes],
            sprintf('%s atualizou o canal %s.', $actor->name, $channel->name),
        );
    }

    public function channelDeleted(User $actor, Channel $channel): ActivityLog
    {
        return $this->record(
            ActivityEvent::ChannelDeleted,
            $actor,
            null,
            [
                'channel_id' => $channel->id,
                'name' => $channel->name,
                'type' => $channel->type,
            ],
            sprintf('%s removeu o canal %s.', $actor->name, $channel->name),
        );
    }

    /** @param  list<string>  $keysChanged */
    public function settingsUpdated(User $actor, array $keysChanged, string $scope = 'general'): ActivityLog
    {
        $scopeLabel = match ($scope) {
            'system' => 'do sistema',
            'integrations' => 'de integrações',
            default => '',
        };

        $keysSummary = $this->summarizeSettingKeys($keysChanged);

        $description = $scopeLabel !== ''
            ? sprintf('%s alterou configurações %s (%s).', $actor->name, $scopeLabel, $keysSummary)
            : sprintf('%s alterou configurações (%s).', $actor->name, $keysSummary);

        return $this->record(
            ActivityEvent::SettingsUpdated,
            $actor,
            null,
            [
                'scope' => $scope,
                'keys' => $keysChanged,
            ],
            $description,
        );
    }

    /** @param  list<string>  $keys */
    private function summarizeSettingKeys(array $keys): string
    {
        $count = count($keys);

        if ($count === 0) {
            return 'nenhuma';
        }

        if ($count <= 3) {
            return implode(', ', $keys);
        }

        $preview = implode(', ', array_slice($keys, 0, 3));

        return sprintf('%s e mais %d', $preview, $count - 3);
    }

    /** @param  array<string, mixed>  $properties */
    private function record(
        ActivityEvent $event,
        ?User $actor,
        ?Model $subject,
        array $properties,
        string $description,
    ): ActivityLog {
        return ActivityLog::create([
            'event' => $event->value,
            'actor_user_id' => $actor?->id,
            'subject_type' => $subject?->getMorphClass(),
            'subject_id' => $subject?->getKey(),
            'properties' => $properties,
            'description' => $this->truncateDescription($description),
        ]);
    }

    private function truncateDescription(string $description, int $maxLength = 500): string
    {
        if (mb_strlen($description) <= $maxLength) {
            return $description;
        }

        return mb_substr($description, 0, $maxLength - 3).'...';
    }

    /** @return array<string, mixed> */
    private function conversationContext(Conversation $conversation): array
    {
        $conversation->loadMissing(['contact:id,name,profile_name,wa_id', 'sector:id,name', 'assignedUser:id,name']);

        return [
            'conversation_id' => $conversation->id,
            'protocol_number' => $conversation->protocol_number,
            'contact_name' => $conversation->contact?->displayName(),
            'sector_id' => $conversation->sector_id,
            'sector_name' => $conversation->sector?->name,
            'assigned_user_id' => $conversation->assigned_user_id,
            'assigned_user_name' => $conversation->assignedUser?->name,
        ];
    }

    private function conversationLabel(Conversation $conversation): string
    {
        if ($conversation->protocol_number) {
            return '#'.$conversation->protocol_number;
        }

        return '#'.$conversation->id;
    }
}