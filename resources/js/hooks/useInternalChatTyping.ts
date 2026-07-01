import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type TypingPayload = {
    conversation_id: number;
    user_id: number;
    user_name: string;
    typing: boolean;
};

export function formatTypingLabel(names: string[]): string | null {
    if (names.length === 0) return null;
    if (names.length === 1) return `${names[0]} está digitando...`;
    if (names.length === 2) return `${names[0]} e ${names[1]} estão digitando...`;
    return `${names[0]} e mais ${names.length - 1} estão digitando...`;
}

export function useInternalChatTyping(
    currentUserId: number,
    activeConversationId: number | null,
) {
    const [typingUsers, setTypingUsers] = useState<Map<number, string>>(new Map());
    const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isTypingRef = useRef(false);
    const lastEmitRef = useRef(0);
    const typingTimeoutsRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
    const activeIdRef = useRef(activeConversationId);
    activeIdRef.current = activeConversationId;

    const setTyping = useCallback(async (conversationId: number, typing: boolean) => {
        try {
            await window.axios.post(route('chat-interno.typing', conversationId), { typing });
        } catch {
            // ignore
        }
    }, []);

    const stopTyping = useCallback(
        (conversationId: number | null = activeIdRef.current) => {
            if (stopTimerRef.current) {
                clearTimeout(stopTimerRef.current);
                stopTimerRef.current = null;
            }
            if (!conversationId || !isTypingRef.current) return;
            isTypingRef.current = false;
            void setTyping(conversationId, false);
        },
        [setTyping],
    );

    const notifyTyping = useCallback(
        (conversationId: number) => {
            const now = Date.now();
            if (!isTypingRef.current || now - lastEmitRef.current > 2000) {
                isTypingRef.current = true;
                lastEmitRef.current = now;
                void setTyping(conversationId, true);
            }

            if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
            stopTimerRef.current = setTimeout(() => {
                stopTyping(conversationId);
            }, 3000);
        },
        [setTyping, stopTyping],
    );

    useEffect(() => {
        const echo = window.Echo;
        if (!echo || activeConversationId === null) {
            setTypingUsers(new Map());
            return;
        }

        const channel = echo.private(`internal-conversation.${activeConversationId}`);

        const handler = (data: TypingPayload) => {
            if (data.user_id === currentUserId) return;

            const existing = typingTimeoutsRef.current.get(data.user_id);
            if (existing) clearTimeout(existing);

            if (data.typing) {
                setTypingUsers((prev) => new Map(prev).set(data.user_id, data.user_name));
                typingTimeoutsRef.current.set(
                    data.user_id,
                    setTimeout(() => {
                        setTypingUsers((prev) => {
                            const next = new Map(prev);
                            next.delete(data.user_id);
                            return next;
                        });
                        typingTimeoutsRef.current.delete(data.user_id);
                    }, 4000),
                );
            } else {
                setTypingUsers((prev) => {
                    const next = new Map(prev);
                    next.delete(data.user_id);
                    return next;
                });
                typingTimeoutsRef.current.delete(data.user_id);
            }
        };

        channel.listen('.user.typing', handler);

        return () => {
            channel.stopListening('.user.typing', handler);
            typingTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
            typingTimeoutsRef.current.clear();
            setTypingUsers(new Map());
        };
    }, [activeConversationId, currentUserId]);

    useEffect(() => {
        return () => {
            stopTyping(activeIdRef.current);
        };
    }, [activeConversationId, stopTyping]);

    const typingLabel = useMemo(
        () => formatTypingLabel(Array.from(typingUsers.values())),
        [typingUsers],
    );

    return { typingLabel, notifyTyping, stopTyping };
}