import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
    'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-accent/30',
    {
        variants: {
            variant: {
                default: 'border-ink/[0.14] bg-accent/18 text-accent shadow-sm dark:border-accent/30',
                secondary: 'border-ink/[0.12] bg-ink/[0.07] text-ink/70',
                queued: 'border-ink/[0.14] bg-amber-400/18 text-amber-800 shadow-sm dark:border-amber-300/35 dark:bg-amber-400/16 dark:text-amber-200',
                bot: 'border-ink/[0.14] bg-sky-400/12 text-sky-700 shadow-sm dark:border-sky-400/35 dark:bg-sky-400/12 dark:text-sky-300',
                destructive: 'border-ink/[0.14] bg-red-500/12 text-red-700 dark:border-red-400/30 dark:bg-red-500/14 dark:text-red-200',
                outline: 'border-ink/[0.14] bg-transparent text-ink/70',
            },
        },
        defaultVariants: {
            variant: 'default',
        },
    },
);

export interface BadgeProps
    extends React.HTMLAttributes<HTMLDivElement>,
        VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
    return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
