import * as React from 'react';

import { cn } from '@/lib/utils';

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
    ({ className, type, ...props }, ref) => {
        return (
            <input
                type={type}
                className={cn(
                    'flex h-8 w-full min-w-0 rounded-lg border border-ink/[0.12] bg-ink/[0.04] px-2.5 py-1 text-base text-ink/90 shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-ink/70 placeholder:text-ink/45 focus-visible:outline-none focus-visible:border-accent/50 focus-visible:ring-1 focus-visible:ring-accent/30 disabled:cursor-not-allowed disabled:bg-ink/[0.03] disabled:opacity-50 md:text-sm',
                    className,
                )}
                ref={ref}
                {...props}
            />
        );
    },
);
Input.displayName = 'Input';

export { Input };
