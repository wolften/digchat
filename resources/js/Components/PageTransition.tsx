import { cn } from '@/lib/utils';
import { type ReactNode } from 'react';

type PageTransitionProps = {
    children: ReactNode;
    transitionKey: number | string | null;
    className?: string;
};

export function PageTransition({ children, transitionKey, className }: PageTransitionProps) {
    return (
        <div
            key={transitionKey ?? undefined}
            className={cn(
                'animate-in fade-in-0 duration-200 ease-out motion-reduce:animate-none',
                className,
            )}
        >
            {children}
        </div>
    );
}