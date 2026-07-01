import {
    computeLiveSla,
    formatSlaWait,
    SLA_STATUS_META,
    type ConversationSla,
} from '@/lib/sla';
import { cn } from '@/lib/utils';
import { AlertTriangle, Clock, Timer } from 'lucide-react';

interface SlaIndicatorProps {
    sla: ConversationSla;
    variant?: 'badge' | 'compact' | 'inline';
    className?: string;
}

export default function SlaIndicator({
    sla,
    variant = 'badge',
    className,
}: SlaIndicatorProps) {
    const live = computeLiveSla(sla);
    const meta = SLA_STATUS_META[live.status];
    const waitLabel = formatSlaWait(live.wait_seconds);
    const title = `TME: ${waitLabel} · Meta: ${live.target_minutes} min`;

    if (variant === 'compact') {
        return (
            <span
                className={cn(
                    'inline-flex items-center gap-1 text-xs font-medium tabular-nums',
                    meta.timerClass,
                    className,
                )}
                title={title}
            >
                {live.status === 'breached' ? (
                    <AlertTriangle className="h-3 w-3 shrink-0" />
                ) : (
                    <Clock className="h-3 w-3 shrink-0" />
                )}
                {waitLabel}
            </span>
        );
    }

    if (variant === 'inline') {
        return (
            <span
                className={cn(
                    'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums',
                    meta.badgeClass,
                    className,
                )}
                title={title}
            >
                {live.status === 'breached' ? (
                    <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
                ) : live.status === 'at_risk' ? (
                    <Timer className="h-2.5 w-2.5 shrink-0" />
                ) : (
                    <Clock className="h-2.5 w-2.5 shrink-0" />
                )}
                {live.status === 'ok' ? waitLabel : meta.label}
                {live.status !== 'ok' && (
                    <span className="opacity-80">· {waitLabel}</span>
                )}
            </span>
        );
    }

    return (
        <span
            className={cn(
                'inline-flex h-5 shrink-0 items-center gap-1 rounded-full border px-2 text-[10px] font-semibold leading-none',
                meta.badgeClass,
                className,
            )}
            title={title}
        >
            {live.status === 'breached' ? (
                <AlertTriangle className="h-3 w-3" />
            ) : live.status === 'at_risk' ? (
                <Timer className="h-3 w-3" />
            ) : (
                <Clock className="h-3 w-3" />
            )}
            {live.status === 'ok' ? waitLabel : meta.label}
        </span>
    );
}