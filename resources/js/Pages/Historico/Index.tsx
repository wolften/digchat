import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/Components/ui/select';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { mediaCaption } from '@/lib/messageMedia';
import { cn } from '@/lib/utils';
import { PageProps } from '@/types';
import { Head, router } from '@inertiajs/react';
import {
    Bot,
    Calendar,
    ChevronLeft,
    ChevronRight,
    Clock,
    Download,
    FileText,
    History,
    ImageIcon,
    MessageCircle,
    Mic,
    Search,
    Star,
    UserRound,
    Video,
} from 'lucide-react';
import { Fragment, useEffect, useRef, useState } from 'react';

// ─── Icons ───────────────────────────────────────────────────────────────────

const WhatsAppIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
);

const TelegramIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
);

// ─── Types ──────────────────────────────────────────────────────────────────

interface ConvItem {
    id: number;
    contact: { id: number; name: string; wa_id: string };
    assigned_user: { id: number; name: string } | null;
    sector: { id: number; name: string } | null;
    bot_only: boolean;
    duration_minutes: number | null;
    survey_answer: string | null;
    survey_completed: boolean;
    last_message_at: string | null;
    created_at: string | null;
    channel_type: 'whatsapp' | 'telegram' | null;
    channel_name: string | null;
}

interface Msg {
    id: number;
    direction: 'in' | 'out';
    type: string;
    body: string | null;
    media_url?: string | null;
    sender: { id: number; name: string } | null;
    created_at: string | null;
}

interface Detail {
    id: number;
    contact: { id: number; name: string; wa_id: string };
    assigned_user: { id: number; name: string } | null;
    sector: { id: number; name: string } | null;
    duration_minutes: number | null;
    created_at: string | null;
    last_message_at: string | null;
    messages: Msg[];
    survey: {
        status: string;
        completed_at: string | null;
        answers: { option_label: string }[];
    } | null;
}

interface PaginatedList {
    data: ConvItem[];
    current_page: number;
    last_page: number;
    total: number;
}

interface Filters {
    date_from: string;
    date_to: string;
    sector_id: number | null;
    user_id: number | null;
    search: string | null;
    channel: string | null;
}

interface Props extends PageProps {
    conversations: PaginatedList;
    selected: Detail | null;
    sectors: { id: number; name: string }[];
    users: { id: number; name: string }[];
    stats: {
        total: number;
        avg_duration_minutes: number | null;
        bot_only_pct: number;
        survey_completed: number;
    };
    filters: Filters;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function initials(name: string): string {
    return name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase() ?? '')
        .join('');
}

function formatDuration(mins: number | null): string {
    if (mins === null || mins < 0) return '—';
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatTime(iso: string | null): string {
    if (!iso) return '';
    try {
        return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch {
        return '';
    }
}

function formatDateTime(iso: string | null): string {
    if (!iso) return '';
    try {
        return new Date(iso).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return '';
    }
}

function formatRelativeDate(iso: string | null): string {
    if (!iso) return '';
    try {
        const date = new Date(iso);
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const convStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const diffDays = Math.round((todayStart.getTime() - convStart.getTime()) / 86400000);

        if (diffDays === 0) return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        if (diffDays === 1) return 'Ontem';
        if (diffDays < 7) return date.toLocaleDateString('pt-BR', { weekday: 'short' });
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    } catch {
        return '';
    }
}

// ─── Timeline ────────────────────────────────────────────────────────────────

type TlEvent =
    | { kind: 'msgs'; msgs: Msg[] }
    | { kind: 'handoff'; time: string | null; name: string }
    | { kind: 'closed'; time: string | null }
    | { kind: 'survey'; time: string | null; answers: { option_label: string }[] };

function buildTimeline(detail: Detail): TlEvent[] {
    const events: TlEvent[] = [];
    let handoffDone = false;
    let batch: Msg[] = [];

    for (const msg of detail.messages) {
        const isHuman = msg.direction === 'out' && msg.sender !== null;

        if (isHuman && !handoffDone) {
            if (batch.length) {
                events.push({ kind: 'msgs', msgs: [...batch] });
                batch = [];
            }
            events.push({ kind: 'handoff', time: msg.created_at, name: msg.sender!.name });
            handoffDone = true;
        }

        batch.push(msg);
    }

    if (batch.length) events.push({ kind: 'msgs', msgs: batch });
    events.push({ kind: 'closed', time: detail.last_message_at });

    if (detail.survey?.status === 'completed' && detail.survey.answers.length > 0) {
        events.push({
            kind: 'survey',
            time: detail.survey.completed_at,
            answers: detail.survey.answers,
        });
    }

    return events;
}

// ─── MessageBubble ────────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: Msg }) {
    const isIn = msg.direction === 'in';
    const isHuman = msg.direction === 'out' && msg.sender !== null;

    const mediaLabel =
        msg.type === 'image' ? 'Imagem' :
        msg.type === 'audio' ? 'Áudio' :
        msg.type === 'video' ? 'Vídeo' :
        msg.type === 'document' ? 'Documento' : null;

    const MediaIcon =
        msg.type === 'image' ? ImageIcon :
        msg.type === 'audio' ? Mic :
        msg.type === 'video' ? Video :
        msg.type === 'document' ? FileText : null;

    const caption = mediaCaption(msg.body, msg.type);

    return (
        <div className={cn('mb-2 flex', isIn ? 'justify-start' : 'justify-end')}>
            <div className="max-w-[78%]">
                {!isIn && (
                    <p className="mb-1 text-right text-[10px] font-medium text-ink/35">
                        {msg.sender?.name ?? 'Bot'}
                    </p>
                )}
                <div
                    className={cn(
                        'overflow-hidden rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm',
                        isIn
                            ? 'rounded-tl-sm bg-ink/[0.06] text-ink'
                            : isHuman
                              ? 'rounded-tr-sm bg-accent text-canvas'
                              : 'rounded-tr-sm bg-accent/[0.12] text-ink ring-1 ring-accent/20',
                    )}
                >
                    {mediaLabel && MediaIcon ? (
                        <span className="flex items-center gap-2 opacity-70">
                            <MediaIcon className="h-3.5 w-3.5 shrink-0" />
                            <span>{caption ? `${caption} · ${mediaLabel}` : mediaLabel}</span>
                        </span>
                    ) : (
                        <span className="[overflow-wrap:anywhere] whitespace-pre-wrap">{msg.body ?? '—'}</span>
                    )}
                </div>
                <p className={cn('mt-1 text-[10px] text-ink/30', isIn ? 'text-left' : 'text-right')}>
                    {formatTime(msg.created_at)}
                </p>
            </div>
        </div>
    );
}

// ─── Divider ─────────────────────────────────────────────────────────────────

function Divider({ label, variant = 'muted' }: { label: string; variant?: 'muted' | 'accent' | 'danger' }) {
    return (
        <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-ink/[0.07]" />
            <span
                className={cn(
                    'rounded-full px-3 py-1 text-[10px] font-medium tracking-wide',
                    variant === 'accent' && 'bg-accent/10 text-accent ring-1 ring-accent/20',
                    variant === 'muted' && 'bg-ink/[0.05] text-ink/40',
                    variant === 'danger' && 'bg-red-500/10 text-red-400',
                )}
            >
                {label}
            </span>
            <div className="h-px flex-1 bg-ink/[0.07]" />
        </div>
    );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({
    label,
    value,
    sub,
    icon: Icon,
    iconClass,
}: {
    label: string;
    value: string;
    sub: string;
    icon: React.ElementType;
    iconClass: string;
}) {
    return (
        <div className="group relative overflow-hidden rounded-2xl border border-accent/10 bg-ink/[0.025] px-4 py-3.5 transition-colors hover:border-accent/20 hover:bg-ink/[0.04]">
            <div className={cn('absolute right-3.5 top-3.5 rounded-xl p-2', iconClass)}>
                <Icon className="h-4 w-4" />
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-ink/40">{label}</p>
            <p className="mt-1.5 text-2xl font-bold tracking-tight text-ink/90">{value}</p>
            <p className="mt-0.5 text-[11px] text-ink/35">{sub}</p>
        </div>
    );
}

// ─── ChannelBadge ─────────────────────────────────────────────────────────────

function ChannelBadge({ type, name }: { type: 'whatsapp' | 'telegram' | null; name: string | null }) {
    if (type === 'telegram') {
        return (
            <span className="inline-flex h-4 shrink-0 items-center gap-0.5 rounded-full border border-blue-300/50 bg-blue-50 px-1.5 text-[10px] font-medium text-blue-600 dark:border-blue-400/25 dark:bg-blue-950/40 dark:text-blue-400">
                <TelegramIcon className="h-2.5 w-2.5" />
                {name ?? 'Telegram'}
            </span>
        );
    }
    return (
        <span className="inline-flex h-4 shrink-0 items-center gap-0.5 rounded-full border border-green-300/50 bg-green-50 px-1.5 text-[10px] font-medium text-green-600 dark:border-green-400/25 dark:bg-green-950/40 dark:text-green-400">
            <WhatsAppIcon className="h-2.5 w-2.5" />
            {name ?? 'WhatsApp'}
        </span>
    );
}

// ─── ConvRow ─────────────────────────────────────────────────────────────────

function ConvRow({ conv, selected, onClick }: { conv: ConvItem; selected: boolean; onClick: () => void }) {
    return (
        <li className="relative">
            {selected && (
                <span className="absolute inset-y-0 left-0 z-10 w-[3px] rounded-r-full bg-accent" />
            )}
            <button
                type="button"
                onClick={onClick}
                className={cn(
                    'w-full px-4 py-3.5 text-left transition-all',
                    selected
                        ? 'bg-accent/[0.08]'
                        : 'hover:bg-ink/[0.03]',
                )}
            >
                <div className="flex items-start gap-3">
                    <div className={cn(
                        'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-bold transition-colors',
                        selected
                            ? 'bg-accent text-canvas'
                            : 'border border-accent/25 bg-accent/10 text-accent',
                    )}>
                        {initials(conv.contact.name)}
                    </div>

                    <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                            <span className={cn(
                                'truncate text-sm font-semibold',
                                selected ? 'text-ink/95' : 'text-ink/80',
                            )}>
                                {conv.contact.name}
                            </span>
                            <span className="shrink-0 text-[10px] text-ink/35">
                                {formatRelativeDate(conv.last_message_at)}
                            </span>
                        </div>

                        <div className="mt-1.5 flex flex-wrap items-center gap-1">
                            <ChannelBadge type={conv.channel_type} name={conv.channel_name} />

                            {conv.sector && (
                                <Badge variant="outline" className="h-4 border-ink/15 px-1.5 text-[10px] font-normal text-ink/50">
                                    {conv.sector.name}
                                </Badge>
                            )}

                            {conv.bot_only ? (
                                <span className="inline-flex h-4 items-center gap-0.5 rounded-full bg-accent/10 px-1.5 text-[10px] font-medium text-accent">
                                    <Bot className="h-2.5 w-2.5" />
                                    Bot
                                </span>
                            ) : conv.assigned_user ? (
                                <span className="flex items-center gap-0.5 text-[10px] text-ink/40">
                                    <UserRound className="h-2.5 w-2.5" />
                                    {conv.assigned_user.name}
                                </span>
                            ) : null}

                            {conv.duration_minutes !== null && (
                                <span className="flex items-center gap-0.5 text-[10px] text-ink/30">
                                    <Clock className="h-2.5 w-2.5" />
                                    {formatDuration(conv.duration_minutes)}
                                </span>
                            )}

                            {conv.survey_completed && conv.survey_answer && (
                                <span className="flex items-center gap-0.5 text-[10px] text-amber-500">
                                    <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                                    {conv.survey_answer}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </button>
        </li>
    );
}

// ─── DetailPanel ─────────────────────────────────────────────────────────────

function DetailPanel({ detail }: { detail: Detail }) {
    const threadRef = useRef<HTMLDivElement>(null);
    const timeline = buildTimeline(detail);

    useEffect(() => {
        threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
    }, [detail.id]);

    return (
        <>
            {/* Header */}
            <div className="shrink-0 border-b border-accent/10 bg-ink/[0.015] px-4 py-2.5">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-canvas shadow-sm shadow-accent/30">
                        {initials(detail.contact.name)}
                    </div>

                    <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink/90">{detail.contact.name}</p>
                        <p className="text-[10px] text-ink/40">{detail.contact.wa_id}</p>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                        {detail.sector && (
                            <span className="inline-flex h-5 items-center rounded-md border border-ink/10 bg-ink/[0.04] px-2 text-[10px] text-ink/50">
                                {detail.sector.name}
                            </span>
                        )}
                        {detail.assigned_user ? (
                            <span className="inline-flex h-5 items-center gap-1 rounded-md border border-ink/10 bg-ink/[0.04] px-2 text-[10px] text-ink/50">
                                <UserRound className="h-2.5 w-2.5" />
                                {detail.assigned_user.name}
                            </span>
                        ) : (
                            <span className="inline-flex h-5 items-center gap-1 rounded-md border border-accent/20 bg-accent/8 px-2 text-[10px] text-accent">
                                <Bot className="h-2.5 w-2.5" />
                                Bot
                            </span>
                        )}
                        <span className="inline-flex h-5 items-center gap-1 rounded-md border border-ink/10 bg-ink/[0.04] px-2 text-[10px] text-ink/45">
                            <Clock className="h-2.5 w-2.5" />
                            {formatDuration(detail.duration_minutes)}
                        </span>
                        <span className="hidden text-[10px] text-ink/30 xl:block">
                            {formatDateTime(detail.created_at)}
                            {detail.last_message_at && detail.last_message_at !== detail.created_at && (
                                <> → {formatDateTime(detail.last_message_at)}</>
                            )}
                        </span>
                    </div>
                </div>
            </div>

            {/* Thread */}
            <div ref={threadRef} className="scrollbar-thin flex-1 overflow-y-auto px-5 py-5">
                <Divider label={`Início · ${formatDateTime(detail.created_at)}`} variant="muted" />

                {timeline.map((event, i) => {
                    if (event.kind === 'msgs') {
                        return (
                            <Fragment key={`msgs-${i}`}>
                                {event.msgs.map((msg) => (
                                    <MessageBubble key={msg.id} msg={msg} />
                                ))}
                            </Fragment>
                        );
                    }

                    if (event.kind === 'handoff') {
                        return (
                            <Divider
                                key={`handoff-${i}`}
                                label={`${event.name} assumiu${event.time ? ' · ' + formatTime(event.time) : ''}`}
                                variant="accent"
                            />
                        );
                    }

                    if (event.kind === 'closed') {
                        return (
                            <Divider
                                key={`closed-${i}`}
                                label={`Encerrado${event.time ? ' · ' + formatTime(event.time) : ''}`}
                                variant="muted"
                            />
                        );
                    }

                    if (event.kind === 'survey') {
                        return (
                            <div
                                key={`survey-${i}`}
                                className="mx-auto my-4 max-w-[240px] rounded-2xl border border-amber-300/30 bg-amber-50/50 px-5 py-4 text-center dark:border-amber-400/20 dark:bg-amber-950/20"
                            >
                                <div className="mb-2 flex items-center justify-center gap-1.5">
                                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                                    <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-600/70 dark:text-amber-400/70">
                                        Satisfação
                                    </p>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    {event.answers.map((a, j) => (
                                        <p key={j} className="text-sm font-semibold text-ink/80">
                                            {a.option_label}
                                        </p>
                                    ))}
                                </div>
                                {event.time && (
                                    <p className="mt-2 text-[10px] text-ink/30">{formatTime(event.time)}</p>
                                )}
                            </div>
                        );
                    }

                    return null;
                })}
            </div>
        </>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function HistoricoIndex({
    conversations,
    selected,
    sectors,
    users,
    stats,
    filters,
}: Props) {
    const [localSearch, setLocalSearch] = useState(filters.search ?? '');
    const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        setLocalSearch(filters.search ?? '');
    }, [filters.search]);

    const go = (
        overrides: Record<string, string | number | null | undefined> = {},
        opts: { only?: string[] } = {},
    ) => {
        const base: Record<string, string | number> = {
            date_from: filters.date_from,
            date_to: filters.date_to,
        };
        if (filters.sector_id) base.sector_id = filters.sector_id;
        if (filters.user_id) base.user_id = filters.user_id;
        if (filters.search) base.search = filters.search;
        if (filters.channel) base.channel = filters.channel;

        const params: Record<string, string | number> = { ...base };
        for (const [k, v] of Object.entries(overrides)) {
            if (v !== null && v !== undefined && v !== '') {
                params[k] = v as string | number;
            } else {
                delete params[k];
            }
        }

        router.get(route('historico.index'), params, {
            preserveState: true,
            preserveScroll: true,
            ...opts,
        });
    };

    const selectConv = (id: number) => {
        go({ conversation: id }, { only: ['selected'] });
    };

    const handleSearch = (value: string) => {
        setLocalSearch(value);
        if (searchTimer.current) clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => {
            go({ search: value || null, conversation: undefined });
        }, 400);
    };

    const exportUrl = (() => {
        const p = new URLSearchParams({ date_from: filters.date_from, date_to: filters.date_to });
        if (filters.sector_id) p.set('sector_id', String(filters.sector_id));
        if (filters.user_id) p.set('user_id', String(filters.user_id));
        if (filters.search) p.set('search', filters.search);
        if (filters.channel) p.set('channel', filters.channel);
        return route('historico.export') + '?' + p.toString();
    })();

    return (
        <AuthenticatedLayout header={<h2>Histórico</h2>}>
            <Head title="Histórico" />

            <div className="flex h-full flex-col overflow-hidden">

                {/* ── Stats + Filters ── */}
                <div className="shrink-0 space-y-3 border-b border-accent/10 px-5 py-4">

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                        <StatCard
                            label="Atendimentos"
                            value={stats.total.toLocaleString('pt-BR')}
                            sub="no período"
                            icon={MessageCircle}
                            iconClass="bg-accent/10 text-accent"
                        />
                        <StatCard
                            label="Tempo médio"
                            value={formatDuration(stats.avg_duration_minutes)}
                            sub="por conversa"
                            icon={Clock}
                            iconClass="bg-blue-500/10 text-blue-500"
                        />
                        <StatCard
                            label="Bot resolveu"
                            value={`${stats.bot_only_pct}%`}
                            sub="sem atendente humano"
                            icon={Bot}
                            iconClass="bg-violet-500/10 text-violet-500"
                        />
                        <StatCard
                            label="Pesquisas"
                            value={stats.survey_completed.toLocaleString('pt-BR')}
                            sub="respondidas"
                            icon={Star}
                            iconClass="bg-amber-500/10 text-amber-500"
                        />
                    </div>

                    {/* Filters */}
                    <div className="scrollbar-thin flex items-center gap-1.5 overflow-x-auto pb-px">

                        {/* Search */}
                        <div className="relative shrink-0">
                            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/35" />
                            <Input
                                className="h-8 w-40 pl-8 text-xs"
                                placeholder="Buscar contato..."
                                value={localSearch}
                                onChange={(e) => handleSearch(e.target.value)}
                            />
                        </div>

                        <div className="mx-0.5 h-4 w-px shrink-0 bg-ink/12" />

                        {/* Date range */}
                        <div className="flex shrink-0 items-center gap-1.5 rounded-lg border border-ink/10 bg-ink/[0.025] px-2.5 py-1.5">
                            <Calendar className="h-3 w-3 shrink-0 text-ink/35" />
                            <Input
                                type="date"
                                className="h-5 w-[5.75rem] border-0 bg-transparent p-0 text-[11px] shadow-none focus-visible:ring-0"
                                value={filters.date_from}
                                onChange={(e) => go({ date_from: e.target.value, conversation: undefined })}
                            />
                            <span className="text-[11px] text-ink/25">–</span>
                            <Input
                                type="date"
                                className="h-5 w-[5.75rem] border-0 bg-transparent p-0 text-[11px] shadow-none focus-visible:ring-0"
                                value={filters.date_to}
                                onChange={(e) => go({ date_to: e.target.value, conversation: undefined })}
                            />
                        </div>

                        <div className="mx-0.5 h-4 w-px shrink-0 bg-ink/12" />

                        {/* Selects */}
                        <Select
                            value={filters.sector_id ? String(filters.sector_id) : 'all'}
                            onValueChange={(v) => go({ sector_id: v === 'all' ? null : Number(v), conversation: undefined })}
                        >
                            <SelectTrigger className="h-8 w-36 shrink-0 text-xs">
                                <SelectValue placeholder="Setor" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos os setores</SelectItem>
                                {sectors.map((s) => (
                                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select
                            value={filters.user_id ? String(filters.user_id) : 'all'}
                            onValueChange={(v) => go({ user_id: v === 'all' ? null : Number(v), conversation: undefined })}
                        >
                            <SelectTrigger className="h-8 w-36 shrink-0 text-xs">
                                <SelectValue placeholder="Atendente" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos os atendentes</SelectItem>
                                {users.map((u) => (
                                    <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select
                            value={filters.channel ?? 'all'}
                            onValueChange={(v) => go({ channel: v === 'all' ? null : v, conversation: undefined })}
                        >
                            <SelectTrigger className="h-8 w-36 shrink-0 text-xs">
                                <SelectValue placeholder="Canal" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos os canais</SelectItem>
                                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                                <SelectItem value="telegram">Telegram</SelectItem>
                            </SelectContent>
                        </Select>

                        {/* Spacer + Export */}
                        <div className="flex-1" />
                        <a href={exportUrl} download className="shrink-0">
                            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                                <Download className="h-3.5 w-3.5" />
                                CSV
                            </Button>
                        </a>
                    </div>
                </div>

                {/* ── Content ── */}
                <div className="flex min-h-0 flex-1 overflow-hidden">

                    {/* Left: Conversation list */}
                    <div className="flex w-[300px] shrink-0 flex-col overflow-hidden border-r border-accent/10">

                        {conversations.data.length === 0 ? (
                            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
                                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ink/[0.04]">
                                    <History className="h-7 w-7 text-ink/20" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-ink/40">Nenhum atendimento</p>
                                    <p className="mt-0.5 text-xs text-ink/25">Tente ajustar os filtros</p>
                                </div>
                            </div>
                        ) : (
                            <ul className="scrollbar-thin flex-1 overflow-y-auto divide-y divide-accent/[0.07]">
                                {conversations.data.map((c) => (
                                    <ConvRow
                                        key={c.id}
                                        conv={c}
                                        selected={selected?.id === c.id}
                                        onClick={() => selectConv(c.id)}
                                    />
                                ))}
                            </ul>
                        )}

                        {conversations.last_page > 1 && (
                            <div className="flex shrink-0 items-center justify-between border-t border-accent/10 px-3 py-2">
                                <span className="text-[11px] text-ink/35">
                                    {conversations.total.toLocaleString('pt-BR')} · {conversations.current_page}/{conversations.last_page}
                                </span>
                                <div className="flex gap-0.5">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 rounded-lg"
                                        disabled={conversations.current_page === 1}
                                        onClick={() => go({ page: conversations.current_page - 1 })}
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 rounded-lg"
                                        disabled={conversations.current_page === conversations.last_page}
                                        onClick={() => go({ page: conversations.current_page + 1 })}
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right: Detail */}
                    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                        {selected ? (
                            <DetailPanel detail={selected} />
                        ) : (
                            <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
                                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-accent/15 bg-accent/5">
                                    <MessageCircle className="h-8 w-8 text-accent/30" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-ink/35">Selecione um atendimento</p>
                                    <p className="mt-0.5 text-xs text-ink/25">para visualizar o histórico completo</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
