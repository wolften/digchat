import * as React from 'react';

import { cn } from '@/lib/utils';

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, onMouseMove, ...props }, ref) => {
        const innerRef = React.useRef<HTMLDivElement>(null);

        const setRefs = React.useCallback(
            (node: HTMLDivElement | null) => {
                (innerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
                if (typeof ref === 'function') ref(node);
                else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
            },
            [ref],
        );

        const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
            const el = innerRef.current;
            if (el) {
                const rect = el.getBoundingClientRect();
                el.style.setProperty('--mx', `${((e.clientX - rect.left) / rect.width) * 100}%`);
                el.style.setProperty('--my', `${((e.clientY - rect.top) / rect.height) * 100}%`);
            }
            onMouseMove?.(e);
        };

        return (
            <div
                ref={setRefs}
                className={cn('glass-card rounded-xl text-ink shadow-sm', className)}
                onMouseMove={handleMouseMove}
                {...props}
            />
        );
    },
);
Card.displayName = 'Card';

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div ref={ref} className={cn('flex flex-col space-y-1.5 p-5', className)} {...props} />
    ),
);
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div ref={ref} className={cn('font-manrope font-semibold leading-none text-ink/90', className)} {...props} />
    ),
);
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div ref={ref} className={cn('text-sm text-ink/55', className)} {...props} />
    ),
);
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div ref={ref} className={cn('p-5 pt-0', className)} {...props} />
    ),
);
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div ref={ref} className={cn('flex items-center p-5 pt-0', className)} {...props} />
    ),
);
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
