export type SlaStatus = 'ok' | 'at_risk' | 'breached';

export interface ConversationSla {
    status: SlaStatus;
    wait_seconds: number;
    target_minutes: number;
    remaining_seconds: number;
    queued_at: string;
}

const AT_RISK_THRESHOLD = 0.8;

export function computeLiveSla(sla: ConversationSla): ConversationSla {
    const waitSeconds = Math.max(
        0,
        Math.floor((Date.now() - new Date(sla.queued_at).getTime()) / 1000),
    );
    const targetSeconds = sla.target_minutes * 60;
    const ratio = targetSeconds > 0 ? waitSeconds / targetSeconds : 0;

    let status: SlaStatus = 'ok';
    if (ratio >= 1) {
        status = 'breached';
    } else if (ratio >= AT_RISK_THRESHOLD) {
        status = 'at_risk';
    }

    return {
        ...sla,
        status,
        wait_seconds: waitSeconds,
        remaining_seconds: Math.max(0, targetSeconds - waitSeconds),
    };
}

export function formatSlaWait(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
        return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
}

export const SLA_STATUS_META: Record<
    SlaStatus,
    {
        label: string;
        badgeClass: string;
        timerClass: string;
        rowClass: string;
    }
> = {
    ok: {
        label: 'No prazo',
        badgeClass:
            'border-emerald-200/80 bg-emerald-50 text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-950/30 dark:text-emerald-400',
        timerClass: 'text-emerald-600 dark:text-emerald-400',
        rowClass: '',
    },
    at_risk: {
        label: 'Em risco',
        badgeClass:
            'border-amber-200/80 bg-amber-50 text-amber-700 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-400',
        timerClass: 'text-amber-600 dark:text-amber-400',
        rowClass: 'border-l-amber-400/70 bg-amber-500/[0.03]',
    },
    breached: {
        label: 'SLA estourado',
        badgeClass:
            'border-red-200/80 bg-red-50 text-red-700 dark:border-red-800/50 dark:bg-red-950/30 dark:text-red-400',
        timerClass: 'text-red-600 dark:text-red-400',
        rowClass: 'border-l-red-500/80 bg-red-500/[0.04]',
    },
};