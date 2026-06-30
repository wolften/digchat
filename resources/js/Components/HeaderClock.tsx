import { PageProps } from '@/types';
import { usePage } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';

const FALLBACK_TIMEZONE = 'America/Sao_Paulo';

function resolveTimezone(inertiaTimezone?: string): string {
    if (inertiaTimezone) {
        return inertiaTimezone;
    }

    return (
        document.querySelector('meta[name="app-timezone"]')?.getAttribute('content')
        ?? FALLBACK_TIMEZONE
    );
}

function formatTime(timezone: string): string {
    return new Intl.DateTimeFormat('pt-BR', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    }).format(new Date());
}

export function HeaderClock() {
    const { appTimezone } = usePage<PageProps>().props;
    const timezone = useMemo(() => resolveTimezone(appTimezone), [appTimezone]);
    const [time, setTime] = useState(() => formatTime(timezone));

    useEffect(() => {
        const tick = () => setTime(formatTime(timezone));
        tick();
        const id = window.setInterval(tick, 1000);
        return () => window.clearInterval(id);
    }, [timezone]);

    return (
        <div
            className="flex items-center rounded-lg border border-accent/20 bg-accent/5 px-2.5 py-1"
            title={`Horário do sistema (${timezone})`}
        >
            <time
                dateTime={time}
                className="font-mono text-xs font-semibold tabular-nums tracking-wide text-accent"
            >
                {time}
            </time>
        </div>
    );
}