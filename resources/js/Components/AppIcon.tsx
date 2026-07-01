import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

const loadedUrls = new Set<string>();

function preloadIcon(url: string): Promise<void> {
    if (loadedUrls.has(url)) {
        return Promise.resolve();
    }

    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            loadedUrls.add(url);
            resolve();
        };
        img.onerror = () => resolve();
        img.src = url;
    });
}

type AppIconProps = {
    src: string;
    alt: string;
    className?: string;
};

export function AppIcon({ src, alt, className }: AppIconProps) {
    const [ready, setReady] = useState(() => loadedUrls.has(src));

    useEffect(() => {
        if (loadedUrls.has(src)) {
            setReady(true);
            return;
        }

        let cancelled = false;
        preloadIcon(src).then(() => {
            if (!cancelled) setReady(true);
        });

        return () => {
            cancelled = true;
        };
    }, [src]);

    return (
        <div
            className={cn(
                'bg-cover bg-center bg-no-repeat bg-accent/10',
                !ready && 'animate-pulse',
                className,
            )}
            style={ready ? { backgroundImage: `url("${src}")` } : undefined}
            role="img"
            aria-label={alt}
        />
    );
}

export function preloadAppIcon(url: string | null | undefined): void {
    if (url) void preloadIcon(url);
}