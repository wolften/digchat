import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type InboxViewer = {
    user_id: number;
    user_name: string;
    profile_photo_url: string | null;
};

type ViewingPayload = {
    conversation_id: number;
    viewers: InboxViewer[];
};

const HEARTBEAT_MS = 25_000;

export function formatViewingLabel(names: string[]): string | null {
    if (names.length === 0) return null;
    if (names.length === 1) return `${names[0]} também está vendo esta conversa`;
    if (names.length === 2) return `${names[0]} e ${names[1]} também estão vendo esta conversa`;
    return `${names[0]}, ${names[1]} e mais ${names.length - 2} também estão vendo esta conversa`;
}

export function useInboxViewing(currentUserId: number, activeConversationId: number | null) {
    const [viewers, setViewers] = useState<InboxViewer[]>([]);
    const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const activeIdRef = useRef(activeConversationId);
    activeIdRef.current = activeConversationId;

    const applyViewers = useCallback(
        (next: InboxViewer[]) => {
            setViewers(next.filter((viewer) => viewer.user_id !== currentUserId));
        },
        [currentUserId],
    );

    const announceViewing = useCallback(
        async (conversationId: number, viewing: boolean) => {
            try {
                const response = await window.axios.post<{ viewers: InboxViewer[] }>(
                    route('inbox.viewing', conversationId),
                    { viewing },
                );
                if (viewing) {
                    applyViewers(response.data.viewers ?? []);
                }
            } catch {
                // ignore
            }
        },
        [applyViewers],
    );

    const stopViewing = useCallback(
        (conversationId: number | null = activeIdRef.current) => {
            if (heartbeatRef.current) {
                clearInterval(heartbeatRef.current);
                heartbeatRef.current = null;
            }
            if (!conversationId) return;
            void announceViewing(conversationId, false);
        },
        [announceViewing],
    );

    useEffect(() => {
        if (activeConversationId === null) {
            setViewers([]);
            return;
        }

        const conversationId = activeConversationId;
        void announceViewing(conversationId, true);

        heartbeatRef.current = setInterval(() => {
            void announceViewing(conversationId, true);
        }, HEARTBEAT_MS);

        return () => {
            if (heartbeatRef.current) {
                clearInterval(heartbeatRef.current);
                heartbeatRef.current = null;
            }
            void announceViewing(conversationId, false);
            setViewers([]);
        };
    }, [activeConversationId, announceViewing]);

    useEffect(() => {
        const echo = window.Echo;
        if (!echo || activeConversationId === null) return;

        const channel = echo.private(`conversation.${activeConversationId}`);

        const handler = (data: ViewingPayload) => {
            applyViewers(data.viewers ?? []);
        };

        channel.listen('.user.viewing', handler);

        return () => {
            channel.stopListening('.user.viewing', handler);
        };
    }, [activeConversationId, applyViewers]);

    useEffect(() => {
        return () => {
            stopViewing(activeIdRef.current);
        };
    }, [stopViewing]);

    const viewingLabel = useMemo(
        () => formatViewingLabel(viewers.map((viewer) => viewer.user_name)),
        [viewers],
    );

    return { viewers, viewingLabel };
}