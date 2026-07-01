import { useEffect, useRef } from 'react';
import { router } from '@inertiajs/react';

export type InboxRealtimeMessage = {
    id: number;
    conversation_id: number;
    direction: 'in' | 'out';
    type: string;
    body: string | null;
    media_url?: string | null;
    status: string | null;
    is_internal?: boolean;
    sender_user_id?: number | null;
    sender: { id: number; name: string; profile_photo_url?: string | null } | null;
    created_at: string | null;
};

type ConversationPatch = {
    id: number;
    status?: string;
    assigned_user_id?: number | null;
    last_message_at?: string | null;
    snoozed_until?: string | null;
    snooze_note?: string | null;
    snooze_wake_reason?: string | null;
};

type UseInboxRealtimeOptions = {
    activeConversationId: number | null;
    onMessage: (message: InboxRealtimeMessage) => void;
    onConversationUpdated?: (patch: ConversationPatch) => void;
};

export function useInboxRealtime({
    activeConversationId,
    onMessage,
    onConversationUpdated,
}: UseInboxRealtimeOptions) {
    const activeIdRef = useRef(activeConversationId);
    activeIdRef.current = activeConversationId;

    const onMessageRef = useRef(onMessage);
    onMessageRef.current = onMessage;

    const onConversationUpdatedRef = useRef(onConversationUpdated);
    onConversationUpdatedRef.current = onConversationUpdated;

    useEffect(() => {
        const echo = window.Echo;
        if (!echo) return;

        const channel = echo.private('conversations');

        const handleMessageCreated = (data: { message: InboxRealtimeMessage }) => {
            const message = data.message;
            if (message.conversation_id === activeIdRef.current) {
                onMessageRef.current(message);
            }

            router.reload({ only: ['conversations', 'counts'] });
        };

        const handleConversationUpdated = (data: { conversation: ConversationPatch }) => {
            onConversationUpdatedRef.current?.(data.conversation);

            const reloadKeys =
                data.conversation.id === activeIdRef.current
                    ? ['conversations', 'counts', 'selected']
                    : ['conversations', 'counts'];

            router.reload({ only: reloadKeys });
        };

        channel.listen('.message.created', handleMessageCreated);
        channel.listen('.conversation.updated', handleConversationUpdated);

        return () => {
            channel.stopListening('.message.created', handleMessageCreated);
            channel.stopListening('.conversation.updated', handleConversationUpdated);
        };
    }, []);
}

export function inboxMessageFromRealtime(payload: InboxRealtimeMessage): {
    id: number;
    direction: 'in' | 'out';
    type: string;
    body: string | null;
    media_url?: string | null;
    status: string | null;
    is_internal?: boolean;
    sender: { id: number; name: string } | null;
    created_at: string | null;
} {
    return {
        id: payload.id,
        direction: payload.direction,
        type: payload.type,
        body: payload.body,
        media_url: payload.media_url ?? null,
        status: payload.status,
        is_internal: payload.is_internal,
        sender: payload.sender
            ? { id: payload.sender.id, name: payload.sender.name }
            : null,
        created_at: payload.created_at,
    };
}