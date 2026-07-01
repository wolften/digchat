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
    headerInside?: boolean;
    footer?: React.ReactNode;
    footerInside?: boolean;
    children: React.ReactNode;
    className?: string;
    contentClassName?: string;
    bubbleClassName?: string;
}

function bubbleHeaderClass(variant: ChatBubbleVariant): string {
    switch (variant) {
        case 'outgoing-accent':
            return 'mb-1 text-[11px] font-semibold leading-tight text-canvas/75 dark:text-black/65';
        case 'outgoing-attendant':
        case 'outgoing-automation':
        case 'outgoing-internal':
            return 'mb-1 text-[11px] font-semibold leading-tight opacity-80';
        default:
            return 'mb-1 text-[11px] font-semibold leading-tight text-gray-900 dark:text-zinc-100';
    }
}

export function ChatMessage({
    align,
    variant,
    avatar,
    header,
    headerInside = false,
    footer,
    footerInside = false,
    children,
    className,
    contentClassName,
    bubbleClassName,
}: ChatMessageProps) {
    const hasOutsideFooter = Boolean(footer && !footerInside);
    const showOutsideHeader = Boolean(header && !headerInside);
    const showInsideHeader = Boolean(header && headerInside);

    const bubbleBody = (
        <Bubble variant={variant} align={align} className={bubbleClassName}>
            <BubbleContent variant={variant} align={align}>
                {showInsideHeader ? (
                    <p className={bubbleHeaderClass(variant)}>{header}</p>
                ) : null}
                {children}
                {footerInside && footer ? <div className="mt-1">{footer}</div> : null}
            </BubbleContent>
        </Bubble>
    );

    if (avatar) {
        return (
            <Message align={align} className={cn('transition-opacity duration-300', className)}>
                <MessageContent
                    className={cn(
                        'grid w-full max-w-[75%] grid-cols-[auto_1fr] gap-x-2 gap-y-1',
                        contentClassName,
                    )}
                >
                    {showOutsideHeader ? (
                        <MessageHeader className="col-start-2 row-start-1">
                            {header}
                        </MessageHeader>
                    ) : null}
                    <MessageAvatar
                        className={cn(
                            'col-start-1 self-end',
                            showOutsideHeader ? 'row-start-2' : 'row-start-1',
                        )}
                    >
                        {avatar}
                    </MessageAvatar>
                    <div
                        className={cn(
                            'col-start-2 flex min-w-0 flex-col gap-1',
                            showOutsideHeader ? 'row-start-2' : 'row-start-1',
                        )}
                    >
                        {bubbleBody}
                    </div>
                    {hasOutsideFooter ? (
                        <MessageFooter
                            className={cn(
                                'col-start-2',
                                showOutsideHeader ? 'row-start-3' : 'row-start-2',
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
                {showOutsideHeader ? <MessageHeader>{header}</MessageHeader> : null}
                {bubbleBody}
                {hasOutsideFooter ? <MessageFooter>{footer}</MessageFooter> : null}
            </MessageContent>
        </Message>
    );
}