import * as React from 'react';
import {
    MessageScroller as MessageScrollerPrimitive,
    useMessageScroller,
    useMessageScrollerScrollable,
    useMessageScrollerVisibility,
} from '@shadcn/react/message-scroller';
import { ArrowDown } from 'lucide-react';

import { Button } from '@/Components/ui/button';
import { cn } from '@/lib/utils';

function MessageScrollerProvider(
    props: React.ComponentProps<typeof MessageScrollerPrimitive.Provider>,
) {
    return <MessageScrollerPrimitive.Provider {...props} />;
}

function MessageScroller({
    className,
    ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Root>) {
    return (
        <MessageScrollerPrimitive.Root
            data-slot="message-scroller"
            className={cn(
                'group/message-scroller relative flex h-full min-h-0 w-full flex-col overflow-hidden',
                className,
            )}
            {...props}
        />
    );
}

function MessageScrollerViewport({
    className,
    ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Viewport>) {
    return (
        <MessageScrollerPrimitive.Viewport
            data-slot="message-scroller-viewport"
            className={cn(
                'h-full min-h-0 min-w-0 w-full overflow-y-auto overscroll-contain [scrollbar-gutter:stable]',
                'scrollbar-thin',
                className,
            )}
            {...props}
        />
    );
}

function MessageScrollerContent({
    className,
    ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Content>) {
    return (
        <MessageScrollerPrimitive.Content
            data-slot="message-scroller-content"
            className={cn('flex h-max min-h-full w-full flex-col', className)}
            {...props}
        />
    );
}

function MessageScrollerItem({
    className,
    ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Item>) {
    return (
        <MessageScrollerPrimitive.Item
            data-slot="message-scroller-item"
            className={cn('min-w-0 shrink-0', className)}
            {...props}
        />
    );
}

function MessageScrollerButton({
    direction = 'end',
    className,
    children,
    ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Button>) {
    return (
        <MessageScrollerPrimitive.Button
            data-slot="message-scroller-button"
            direction={direction}
            className={cn(
                'absolute left-1/2 z-10 -translate-x-1/2 transition-[transform,opacity] duration-200',
                'data-[active=false]:pointer-events-none data-[active=false]:scale-95 data-[active=false]:opacity-0',
                'data-[active=true]:translate-y-0 data-[active=true]:scale-100 data-[active=true]:opacity-100',
                direction === 'end' && 'bottom-4 data-[active=false]:translate-y-full',
                direction === 'start' && 'top-4 data-[active=false]:-translate-y-full [&_svg]:rotate-180',
                className,
            )}
            render={
                <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 rounded-full border-ink/15 bg-canvas text-ink shadow-md hover:border-accent/40 hover:bg-canvas hover:text-accent"
                />
            }
            {...props}
        >
            {children ?? (
                <>
                    <ArrowDown className="h-4 w-4" />
                    <span className="sr-only">
                        {direction === 'end' ? 'Ir para mensagens recentes' : 'Ir para o início'}
                    </span>
                </>
            )}
        </MessageScrollerPrimitive.Button>
    );
}

export {
    MessageScrollerProvider,
    MessageScroller,
    MessageScrollerViewport,
    MessageScrollerContent,
    MessageScrollerItem,
    MessageScrollerButton,
    useMessageScroller,
    useMessageScrollerScrollable,
    useMessageScrollerVisibility,
};