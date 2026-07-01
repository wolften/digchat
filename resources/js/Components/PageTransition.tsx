import { cn } from '@/lib/utils';
import { usePage } from '@inertiajs/react';
import { type ReactNode } from 'react';

type PageTransitionProps = {
    children: ReactNode;
    className?: string;
};

export function PageTransition({ children, className }: PageTransitionProps) {
    const { component, url } = usePage();
    const pathname = url.split('?')[0];
    const transitionKey = `${component}:${pathname}`;

    return (
        <div
            key={transitionKey}
            className={cn(
                'animate-in fade-in-0 duration-200 ease-out motion-reduce:animate-none',
                className,
            )}
        >
            {children}
        </div>
    );
}