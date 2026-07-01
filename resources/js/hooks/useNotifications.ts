import { useEffect, useRef } from 'react';

type MessageNotificationPayload = {
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

type ConversationUpdatedPayload = {
    conversation: {
        id: number;
        status: string;
        assigned_user_id: number | null;
        snooze_wake_reason?: string | null;
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

        const notify = (title: string, body: string, tag: string, href = '/inbox') => {
            if (permissionRef.current !== 'granted') return;

            const onInbox = window.location.pathname.startsWith('/inbox');
            if (!document.hidden && onInbox) return;

            const options: NotificationOptions & { renotify?: boolean } = {
                body,
                icon: '/favicon.ico',
                tag,
                renotify: true,
            };
            const notification = new Notification(title, options);

            notification.onclick = () => {
                window.focus();
                window.location.href = href;
                notification.close();
            };
        };

        const onMessageCreated = (data: MessageNotificationPayload) => {
            if (data.message.direction !== 'in') return;
            if (!['open', 'surveying'].includes(data.conversation.status)) return;
            if (data.conversation.assigned_user_id !== currentUserId) return;

            notify(
                data.contact.name ?? 'Nova mensagem',
                messagePreview(data.message.type, data.message.body),
                `conv-${data.message.conversation_id}`,
            );
        };

        const onConversationUpdated = (data: ConversationUpdatedPayload) => {
            const conversation = data.conversation;
            if (conversation.assigned_user_id !== currentUserId) return;
            if (conversation.status !== 'open') return;
            if (!conversation.snooze_wake_reason) return;

            const body = conversation.snooze_wake_reason === 'customer_message'
                ? 'O cliente enviou uma nova mensagem.'
                : 'O lembrete de retorno expirou.';

            notify(
                'Conversa retomada',
                body,
                `conv-snooze-${conversation.id}`,
                `/inbox/${conversation.id}`,
            );
        };

        channel.listen('.message.created', onMessageCreated);
        channel.listen('.conversation.updated', onConversationUpdated);

        return () => {
            channel.stopListening('.message.created', onMessageCreated);
            channel.stopListening('.conversation.updated', onConversationUpdated);
        };
    }, [currentUserId]);
}
