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
    const hasOutsideFooter = Boolean(footer && !footerInside);

    if (avatar) {
        return (
            <Message align={align} className={cn('transition-opacity duration-300', className)}>
                <MessageContent
                    className={cn(
                        'grid w-full max-w-[75%] grid-cols-[auto_1fr] gap-x-2 gap-y-1',
                        contentClassName,
                    )}
                >
                    {header ? (
                        <MessageHeader className="col-start-2 row-start-1">
                            {header}
                        </MessageHeader>
                    ) : null}
                    <MessageAvatar
                        className={cn(
                            'col-start-1 self-end',
                            header ? 'row-start-2' : 'row-start-1',
                        )}
                    >
                        {avatar}
                    </MessageAvatar>
                    <div
                        className={cn(
                            'col-start-2 flex min-w-0 flex-col gap-1',
                            header ? 'row-start-2' : 'row-start-1',
                        )}
                    >
                        <Bubble variant={variant} align={align} className={bubbleClassName}>
                            <BubbleContent variant={variant} align={align}>
                                {children}
                                {footerInside && footer ? (
                                    <div className="mt-1">{footer}</div>
                                ) : null}
                            </BubbleContent>
                        </Bubble>
                    </div>
                    {hasOutsideFooter ? (
                        <MessageFooter
                            className={cn(
                                'col-start-2',
                                header ? 'row-start-3' : 'row-start-2',
                            )}
                        >
                            {footer}
                        </MessageFooter>
                    ) : null}
                </MessageContent>
            </Message>
        );
    }

    return (
        <Message align={align} className={cn('transition-opacity duration-300', className)}>
            <MessageContent className={contentClassName}>
                {header ? <MessageHeader>{header}</MessageHeader> : null}
                <Bubble variant={variant} align={align} className={bubbleClassName}>
                    <BubbleContent variant={variant} align={align}>
                        {children}
                        {footerInside && footer ? (
                            <div className="mt-1">{footer}</div>
                        ) : null}
                    </BubbleContent>
                </Bubble>
                {hasOutsideFooter ? <MessageFooter>{footer}</MessageFooter> : null}
            </MessageContent>
        </Message>
    );
}