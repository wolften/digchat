import { usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { PageProps } from '@/types';

export function useInternalChatBadge() {
    const page = usePage<PageProps>();
    const serverCount = page.props.internalChatBadgeCount ?? 0;
    const [count, setCount] = useState(serverCount);
    const userId = page.props.auth.user.id;

    useEffect(() => {
        setCount(serverCount);
    }, [serverCount]);

    useEffect(() => {
        const echo = window.Echo;
        if (!echo) return;

        const channel = echo.private(`user.${userId}`);

        const handler = (data: {
            message: { user_id: number; internal_conversation_id: number };
        }) => {
            if (data.message.user_id === userId) return;

            const onChatPage = window.location.pathname.startsWith('/chat-interno');
            const activeMatch = window.location.pathname.match(/\/chat-interno\/(\d+)/);
            const viewingActive =
                onChatPage &&
                activeMatch &&
                Number(activeMatch[1]) === data.message.internal_conversation_id;

            if (!document.hidden && viewingActive) return;

            setCount((n) => n + 1);
        };

        channel.listen('.message.created', handler);

        return () => {
            channel.stopListening('.message.created', handler);
        };
    }, [userId]);

    return { count, setCount };
}