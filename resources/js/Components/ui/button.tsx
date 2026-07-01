import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
    "group/button inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-transparent bg-clip-padding text-sm font-medium text-ink transition-all outline-none select-none focus-visible:border-accent/60 focus-visible:ring-2 focus-visible:ring-accent/30 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    {
        variants: {
            variant: {
                default: 'bg-accent text-canvas shadow-[0_0_0_1px_rgb(var(--accent-rgb)/0.35)] hover:bg-accent/90 hover:shadow-[0_0_24px_rgb(var(--accent-rgb)/0.25)]',
                destructive: 'bg-destructive/12 text-red-300 hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20',
                outline: 'border-accent/25 bg-white text-ink/80 hover:border-accent/40 hover:bg-accent/10 hover:text-ink dark:border-ink/[0.12] dark:bg-ink/[0.04]',
                secondary: 'bg-ink/[0.08] text-ink/80 hover:bg-ink/[0.13] hover:text-ink',
                ghost: 'text-ink/65 hover:bg-ink/[0.07] hover:text-ink',
                link: 'text-accent underline-offset-4 hover:underline',
            },
            size: {
                default: 'h-8 px-2.5 py-1.5',
                sm: 'h-7 rounded-lg px-2.5 text-[0.8rem] [&_svg:not([class*=size-])]:size-3.5',
                lg: 'h-9 rounded-lg px-3.5',
                icon: 'h-8 w-8',
            },
        },
        defaultVariants: {
            variant: 'default',
            size: 'default',
        },
    },
);

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
        VariantProps<typeof buttonVariants> {
    asChild?: boolean;
    inert?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild = false, inert, ...props }, ref) => {
        const Comp = asChild ? Slot : 'button';
        return (
            <Comp
                className={cn(buttonVariants({ variant, size, className }))}
                ref={ref}
                {...(inert ? { inert: '' as const } : {})}
                {...props}
            />
        );
    },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
