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
);

const bubbleContentVariants = cva(
    'w-fit max-w-full min-w-0 overflow-hidden rounded-2xl border px-3 py-2 text-sm leading-relaxed shadow-sm [overflow-wrap:anywhere] [button]:text-left',
    {
        variants: {
            variant: {
                incoming:
                    'border-transparent bg-white text-gray-800 dark:bg-zinc-700 dark:text-zinc-100',
                'outgoing-attendant':
                    'border-transparent bg-green-50 text-green-950 dark:bg-green-900 dark:text-green-50',
                'outgoing-automation':
                    'border-transparent bg-sky-50 text-sky-950 dark:bg-sky-900 dark:text-sky-50',
                'outgoing-internal':
                    'border-transparent bg-red-50 text-red-950 dark:bg-red-950 dark:text-red-50',
                'outgoing-accent':
                    'border-transparent bg-accent text-canvas dark:text-black',
                'incoming-muted':
                    'border-transparent bg-white text-gray-800 dark:bg-zinc-700 dark:text-zinc-100',
            },
            align: {
                start: 'rounded-bl-sm',
                end: 'rounded-br-sm',
            },
        },
        defaultVariants: {
            variant: 'incoming',
            align: 'start',
        },
    },
);

function Bubble({
    variant = 'incoming',
    align = 'start',
    className,
    ...props
}: React.ComponentProps<'div'> & {
    variant?: ChatBubbleVariant;
    align?: 'start' | 'end';
}) {
    return (
        <div
            data-slot="bubble"
            data-variant={variant}
            data-align={align}
            className={cn(bubbleVariants(), className)}
            {...props}
        />
    );
}

function BubbleContent({
    asChild = false,
    variant = 'incoming',
    align = 'start',
    className,
    ...props
}: React.ComponentProps<'div'> &
    VariantProps<typeof bubbleContentVariants> & {
        asChild?: boolean;
        align?: 'start' | 'end';
    }) {
    const Comp = asChild ? Slot : 'div';

    return (
        <Comp
            data-slot="bubble-content"
            className={cn(bubbleContentVariants({ variant, align }), className)}
            {...props}
        />
    );
}

export { BubbleGroup, Bubble, BubbleContent, bubbleVariants, bubbleContentVariants };
export type ChatBubbleVariant = NonNullable<
    VariantProps<typeof bubbleContentVariants>['variant']
>;