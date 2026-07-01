import {
    Bubble,
    BubbleContent,
    type ChatBubbleVariant,
} from '@/Components/ui/bubble';
import {
    Message,
    MessageAvatar,
    MessageContent,
    MessageFooter,
    MessageHeader,
} from '@/Components/ui/message';
import { cn } from '@/lib/utils';

export type { ChatBubbleVariant };

interface ChatMessageProps {
    align: 'start' | 'end';
    variant: ChatBubbleVariant;
    avatar?: React.ReactNode;
    header?: React.ReactNode;
    footer?: React.ReactNode;
    footerInside?: boolean;
    children: React.ReactNode;
    className?: string;
    contentClassName?: string;
    bubbleClassName?: string;
}

export function ChatMessage({
    align,
    variant,
    avatar,
    header,
    footer,
    footerInside = false,
    children,
    className,
    contentClassName,
    bubbleClassName,
}: ChatMessageProps) {
    return (
        <Message align={align} className={cn('transition-opacity duration-300', className)}>
            {avatar ? <MessageAvatar>{avatar}</MessageAvatar> : null}
            <MessageContent className={contentClassName}>
                {header ? <MessageHeader>{header}</MessageHeader> : null}
                <Bubble variant={variant} align={align} className={bubbleClassName}>
                    <BubbleContent align={align}>
                        {children}
                        {footerInside && footer ? (
                            <div className="mt-1">{footer}</div>
                        ) : null}
                    </BubbleContent>
                </Bubble>
                {!footerInside && footer ? <MessageFooter>{footer}</MessageFooter> : null}
            </MessageContent>
        </Message>
    );
}