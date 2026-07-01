import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

function BubbleGroup({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="bubble-group"
            className={cn('flex min-w-0 flex-col gap-2', className)}
            {...props}
        />
    );
}

const bubbleVariants = cva(
    'group/bubble relative flex w-fit max-w-full min-w-0 flex-col gap-1 group-data-[align=end]/message:self-end data-[align=end]:self-end',
    {
        variants: {
            variant: {
                incoming:
                    '*:data-[slot=bubble-content]:border-black/[0.08] *:data-[slot=bubble-content]:bg-white *:data-[slot=bubble-content]:text-gray-800 dark:*:data-[slot=bubble-content]:border-white/[0.10] dark:*:data-[slot=bubble-content]:bg-zinc-700 dark:*:data-[slot=bubble-content]:text-zinc-100',
                'outgoing-attendant':
                    '*:data-[slot=bubble-content]:border-green-400/50 *:data-[slot=bubble-content]:bg-green-50 *:data-[slot=bubble-content]:text-green-950 dark:*:data-[slot=bubble-content]:border-green-500/40 dark:*:data-[slot=bubble-content]:bg-green-900 dark:*:data-[slot=bubble-content]:text-green-50',
                'outgoing-automation':
                    '*:data-[slot=bubble-content]:border-sky-400/50 *:data-[slot=bubble-content]:bg-sky-50 *:data-[slot=bubble-content]:text-sky-950 dark:*:data-[slot=bubble-content]:border-sky-500/40 dark:*:data-[slot=bubble-content]:bg-sky-900 dark:*:data-[slot=bubble-content]:text-sky-50',
                'outgoing-accent':
                    '*:data-[slot=bubble-content]:border-transparent *:data-[slot=bubble-content]:bg-accent *:data-[slot=bubble-content]:text-canvas dark:*:data-[slot=bubble-content]:text-black',
                'incoming-muted':
                    '*:data-[slot=bubble-content]:border-transparent *:data-[slot=bubble-content]:bg-ink/[0.06] *:data-[slot=bubble-content]:text-ink',
            },
        },
        defaultVariants: {
            variant: 'incoming',
        },
    },
);

function Bubble({
    variant = 'incoming',
    align = 'start',
    className,
    ...props
}: React.ComponentProps<'div'> &
    VariantProps<typeof bubbleVariants> & {
        align?: 'start' | 'end';
    }) {
    return (
        <div
            data-slot="bubble"
            data-variant={variant}
            data-align={align}
            className={cn(bubbleVariants({ variant }), className)}
            {...props}
        />
    );
}

function BubbleContent({
    asChild = false,
    align = 'start',
    className,
    ...props
}: React.ComponentProps<'div'> & {
    asChild?: boolean;
    align?: 'start' | 'end';
}) {
    const Comp = asChild ? Slot : 'div';

    return (
        <Comp
            data-slot="bubble-content"
            className={cn(
                'w-fit max-w-full min-w-0 overflow-hidden rounded-2xl border px-3 py-2 text-sm leading-relaxed shadow-sm [overflow-wrap:anywhere] [button]:text-left',
                align === 'end' ? 'rounded-tr-sm' : 'rounded-tl-sm',
                className,
            )}
            {...props}
        />
    );
}

export { BubbleGroup, Bubble, BubbleContent, bubbleVariants };
export type ChatBubbleVariant = NonNullable<VariantProps<typeof bubbleVariants>['variant']>;