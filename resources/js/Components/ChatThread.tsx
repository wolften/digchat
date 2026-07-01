import {
    MessageScroller,
    MessageScrollerButton,
    MessageScrollerContent,
    MessageScrollerItem,
    MessageScrollerProvider,
    MessageScrollerViewport,
} from '@/Components/ui/message-scroller';
import { cn } from '@/lib/utils';

interface ChatThreadProps {
    children: React.ReactNode;
    className?: string;
    viewportClassName?: string;
    contentClassName?: string;
}

export function ChatThread({
    children,
    className,
    viewportClassName,
    contentClassName,
}: ChatThreadProps) {
    return (
        <MessageScrollerProvider autoScroll defaultScrollPosition="end">
            <MessageScroller className={cn('relative flex min-h-0 flex-1 flex-col', className)}>
                <MessageScrollerViewport className={cn('chat-bg flex-1 p-4', viewportClassName)}>
                    <MessageScrollerContent className={contentClassName}>
                        {children}
                    </MessageScrollerContent>
                </MessageScrollerViewport>
                <MessageScrollerButton />
            </MessageScroller>
        </MessageScrollerProvider>
    );
}

export { MessageScrollerItem };