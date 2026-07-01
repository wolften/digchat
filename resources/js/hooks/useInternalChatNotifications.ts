import { router } from '@inertiajs/react';
import { useEffect, useRef } from 'react';

type InternalNotificationPayload = {
    message: {
        id: number;
        internal_conversation_id: number;
        body: string;
        user_id: number;
        user_name: string;
    };
    conversation: {
        id: number;
        type: 'general' | 'direct';
    };
};

export function useInternalChatNotifications(currentUserId: number) {
    const permissionRef = useRef<NotificationPermission>(
        typeof Notification !== 'undefined' ? Notification.permission : 'default',
    );

    useEffect(() => {
        if (!('Notification' in window)) return;
        if (Notification.permission === 'granted') {
            permissionRef.current = 'granted';
            return;
        }
        if (Notification.permission === 'denied') return;
        Notification.requestPermission().then((p) => {
            permissionRef.current = p;
        });
    }, []);

    useEffect(() => {
        const echo = window.Echo;
        if (!echo) return;

        const channel = echo.private(`user.${currentUserId}`);

        const handler = (data: InternalNotificationPayload) => {
            if (data.message.user_id === currentUserId) return;
            if (permissionRef.current !== 'granted') return;

            const onChatPage = window.location.pathname.startsWith('/chat-interno');
            const activeMatch = window.location.pathname.match(/\/chat-interno\/(\d+)/);
            const activeId = activeMatch ? Number(activeMatch[1]) : null;

            if (!document.hidden && onChatPage && activeId === data.message.internal_conversation_id) {
                return;
            }

            const title =
                data.conversation.type === 'general'
                    ? 'Chat Interno — Chat Geral'
                    : data.message.user_name;

            const options: NotificationOptions & { renotify?: boolean } = {
                body: data.message.body,
                icon: '/favicon.ico',
                tag: `internal-chat-${data.message.internal_conversation_id}`,
                renotify: true,
            };

            const notification = new Notification(title, options);

            notification.onclick = () => {
                window.focus();
                router.visit(route('chat-interno.show', data.message.internal_conversation_id));
                notification.close();
            };
        };

        channel.listen('.message.created', handler);

        return () => {
            channel.stopListening('.message.created', handler);
        };
    }, [currentUserId]);
}