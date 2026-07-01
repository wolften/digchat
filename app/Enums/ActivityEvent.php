<?php

namespace App\Enums;

enum ActivityEvent: string
{
    case AuthLogin = 'auth.login';
    case AuthLogout = 'auth.logout';

    case PresenceOnline = 'presence.online';
    case PresenceAway = 'presence.away';
    case PresenceOffline = 'presence.offline';

    case ConversationAssigned = 'conversation.assigned';
    case ConversationTransferred = 'conversation.transferred';
    case ConversationClosed = 'conversation.closed';
    case ConversationForceClosed = 'conversation.force_closed';
    case ConversationSnoozed = 'conversation.snoozed';
    case ConversationWoken = 'conversation.woken';

    case UserCreated = 'user.created';
    case UserUpdated = 'user.updated';
    case UserDeleted = 'user.deleted';

    case SectorCreated = 'sector.created';
    case SectorUpdated = 'sector.updated';
    case SectorDeleted = 'sector.deleted';

    case ChannelCreated = 'channel.created';
    case ChannelUpdated = 'channel.updated';
    case ChannelDeleted = 'channel.deleted';

    case SettingsUpdated = 'settings.updated';

    public function label(): string
    {
        return match ($this) {
            self::AuthLogin => 'Login',
            self::AuthLogout => 'Logout',
            self::PresenceOnline => 'Ficou online',
            self::PresenceAway => 'Ficou ausente',
            self::PresenceOffline => 'Ficou offline',
            self::ConversationAssigned => 'Atendimento assumido',
            self::ConversationTransferred => 'Atendimento transferido',
            self::ConversationClosed => 'Atendimento encerrado',
            self::ConversationForceClosed => 'Atendimento encerrado (forçado)',
            self::ConversationSnoozed => 'Atendimento adiado',
            self::ConversationWoken => 'Atendimento retomado',
            self::UserCreated => 'Usuário criado',
            self::UserUpdated => 'Usuário atualizado',
            self::UserDeleted => 'Usuário removido',
            self::SectorCreated => 'Setor criado',
            self::SectorUpdated => 'Setor atualizado',
            self::SectorDeleted => 'Setor removido',
            self::ChannelCreated => 'Canal criado',
            self::ChannelUpdated => 'Canal atualizado',
            self::ChannelDeleted => 'Canal removido',
            self::SettingsUpdated => 'Configurações alteradas',
        };
    }

    public function category(): string
    {
        return match ($this) {
            self::AuthLogin, self::AuthLogout => 'auth',
            self::PresenceOnline, self::PresenceAway, self::PresenceOffline => 'presence',
            self::ConversationAssigned,
            self::ConversationTransferred,
            self::ConversationClosed,
            self::ConversationForceClosed,
            self::ConversationSnoozed,
            self::ConversationWoken => 'conversation',
            self::UserCreated, self::UserUpdated, self::UserDeleted,
            self::SectorCreated, self::SectorUpdated, self::SectorDeleted,
            self::ChannelCreated, self::ChannelUpdated, self::ChannelDeleted,
            self::SettingsUpdated => 'admin',
        };
    }

    /** @return array<string, string> */
    public static function options(): array
    {
        $options = [];

        foreach (self::cases() as $case) {
            $options[$case->value] = $case->label();
        }

        return $options;
    }
}