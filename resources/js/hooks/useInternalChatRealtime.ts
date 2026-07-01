import { useEffect, useRef } from 'react';

export type InternalChatMessage = {
    id: number;
    body: string;
    user_id: number;
    user_name: string;
    user_profile_photo_url?: string | null;
    created_at: string;
};

export type InternalConversationSummary = {
    id: number;
    type: 'general' | 'direct';
    title: string;
    other_user?: { id: number; name: string; profile_photo_url?: string | null } | null;
    last_message?: string | null;
    last_message_user_name?: string | null;
    last_message_at?: string | null;
    unread_count: number;
    other_last_read_at?: string | null;
};

export type InternalConversationDetail = InternalConversationSummary & {
    messages: InternalChatMessage[];
    my_last_read_at?: string | null;
};

type ConversationPatch = {
    id: number;
    type?: 'general' | 'direct';
    last_message?: string | null;
    last_message_user_name?: string | null;
    last_message_at?: string | null;
};

type UseInternalChatRealtimeOptions = {
    currentUserId: number;
    activeConversationId: number | null;
    onMessage: (conversationId: number, message: InternalChatMessage) => void;
    onConversationUpdated: (patch: ConversationPatch) => void;
    onConversationRead: (conversationId: number, userId: number, lastReadAt: string) => void;
    onUnreadBump: (conversationId: number) => void;
};

export function useInternalChatRealtime({
    currentUserId,
    activeConversationId,
    onMessage,
    onConversationUpdated,
    onConversationRead,
    onUnreadBump,
}: UseInternalChatRealtimeOptions) {
    const activeIdRef = useRef(activeConversationId);
    activeIdRef.current = activeConversationId;

    useEffect(() => {
        const echo = window.Echo;
        if (!echo) return;

        const listChannel = echo.private('internal-conversations');

        const onListMessage = (data: {
            message: InternalChatMessage & { internal_conversation_id: number };
        }) => {
            const conversationId = data.message.internal_conversation_id;
            onMessage(conversationId, data.message);

            if (
                data.message.user_id !== currentUserId &&
                activeIdRef.current !== conversationId
            ) {
                onUnreadBump(conversationId);
            }
        };

        const onListUpdated = (data: { conversation: ConversationPatch }) => {
            onConversationUpdated(data.conversation);
        };

        listChannel.listen('.message.created', onListMessage);
        listChannel.listen('.conversation.updated', onListUpdated);

        return () => {
            listChannel.stopListening('.message.created', onListMessage);
            listChannel.stopListening('.conversation.updated', onListUpdated);
        };
    }, [currentUserId, onMessage, onConversationUpdated, onUnreadBump]);

    useEffect(() => {
        const echo = window.Echo;
        if (!echo || activeConversationId === null) return;

        const threadChannel = echo.private(`internal-conversation.${activeConversationId}`);

        const onThreadMessage = (data: {
            message: InternalChatMessage & { internal_conversation_id: number };
        }) => {
            onMessage(activeConversationId, data.message);
        };

        const onThreadRead = (data: {
            conversation_id: number;
            user_id: number;
            last_read_at: string;
        }) => {
            onConversationRead(data.conversation_id, data.user_id, data.last_read_at);
        };

        threadChannel.listen('.message.created', onThreadMessage);
        threadChannel.listen('.conversation.read', onThreadRead);

        return () => {
            threadChannel.stopListening('.message.created', onThreadMessage);
            threadChannel.stopListening('.conversation.read', onThreadRead);
        };
    }, [activeConversationId, onMessage, onConversationRead]);
}