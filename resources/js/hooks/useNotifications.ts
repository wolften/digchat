import { useEffect, useRef } from 'react';

type NotificationPayload = {
    message: {
        id: number;
        conversation_id: number;
        direction: string;
        type: string;
        body: string | null;
    };
    conversation: {
        status: string;
        assigned_user_id: number | null;
    };
    contact: {
        name: string | null;
    };
};

function messagePreview(type: string, body: string | null): string {
    if (type === 'text' || type === 'template') return body ?? '';
    const labels: Record<string, string> = {
        image: '📷 Imagem',
        video: '🎥 Vídeo',
        audio: '🎤 Áudio',
        document: '📄 Documento',
        sticker: '😊 Figurinha',
    };
    return labels[type] ?? 'Nova mensagem';
}

export function useNotifications(currentUserId: number) {
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

        const channel = echo.private('conversations');

        const handler = (data: NotificationPayload) => {
            if (data.message.direction !== 'in') return;
            if (!['open', 'surveying'].includes(data.conversation.status)) return;
            if (data.conversation.assigned_user_id !== currentUserId) return;
            if (permissionRef.current !== 'granted') return;

            // Notify when browser is hidden OR user navigated away from inbox
            const onInbox = window.location.pathname.startsWith('/inbox');
            if (!document.hidden && onInbox) return;

            const title = data.contact.name ?? 'Nova mensagem';
            const body = messagePreview(data.message.type, data.message.body);

            const notification = new Notification(title, {
                body,
                icon: '/favicon.ico',
                tag: `conv-${data.message.conversation_id}`,
                renotify: true,
            });

            notification.onclick = () => {
                window.focus();
                window.location.href = '/inbox';
                notification.close();
            };
        };

        channel.listen('.message.created', handler);

        return () => {
            channel.stopListening('.message.created', handler);
        };
    }, [currentUserId]);
}
