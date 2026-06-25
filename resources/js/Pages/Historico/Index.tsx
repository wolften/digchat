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
import { cn } from '@/lib/utils';
import { PageProps } from '@/types';
import { Head, router } from '@inertiajs/react';
import {
    Bot,
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

    return (
        <div className={cn('mb-1.5 flex', isIn ? 'justify-start' : 'justify-end')}>
            <div className="max-w-[76%]">
                {!isIn && (
                    <p className="mb-0.5 text-right text-[10px] text-ink/40">
                        {msg.sender?.name ?? 'Bot'}
                    </p>
                )}
                <div
                    className={cn(
                        'rounded-2xl px-3 py-2 text-sm leading-relaxed',
                        isIn
                            ? 'rounded-tl-sm bg-ink/[0.07] text-ink'
                            : isHuman
                              ? 'rounded-tr-sm bg-accent text-canvas'
                              : 'rounded-tr-sm bg-accent/15 text-ink',
                    )}
                >
                    {mediaLabel && MediaIcon ? (
                        <span className="flex items-center gap-1.5 opacity-70">
                            <MediaIcon className="h-3.5 w-3.5" />
                            {msg.body ? `${msg.body} · ${mediaLabel}` : mediaLabel}
                        </span>
                    ) : (
                        <span className="whitespace-pre-wrap break-words">{msg.body ?? '—'}</span>
                    )}
                </div>
                <p className={cn('mt-0.5 text-[10px] text-ink/30', isIn ? 'text-left' : 'text-right')}>
                    {formatTime(msg.created_at)}
                </p>
            </div>
        </div>
    );
}

// ─── Divider ─────────────────────────────────────────────────────────────────

function Divider({ label, variant = 'muted' }: { label: string; variant?: 'muted' | 'accent' | 'danger' }) {
    return (
        <div className="my-3 flex items-center gap-2">
            <div className="h-px flex-1 bg-ink/[0.08]" />
            <span
                className={cn(
                    'rounded-full px-2.5 py-0.5 text-[10px]',
                    variant === 'accent' && 'bg-accent/10 text-accent',
                    variant === 'muted' && 'bg-ink/[0.06] text-ink/40',
                    variant === 'danger' && 'bg-red-500/10 text-red-400',
                )}
            >
                {label}
            </span>
            <div className="h-px flex-1 bg-ink/[0.08]" />
        </div>
    );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
    return (
        <div className="rounded-xl bg-ink/[0.04] px-3 py-2.5">
            <p className="text-[11px] text-ink/45">{label}</p>
            <p className="text-xl font-semibold text-ink/88">{value}</p>
            <p className="text-[11px] text-ink/35">{sub}</p>
        </div>
    );
}

// ─── ConvRow ─────────────────────────────────────────────────────────────────

function ConvRow({ conv, selected, onClick }: { conv: ConvItem; selected: boolean; onClick: () => void }) {
    return (
        <li>
            <button
                type="button"
                onClick={onClick}
                className={cn(
                    'w-full px-3 py-3 text-left transition-colors hover:bg-ink/[0.04]',
                    selected && 'bg-accent/10',
                )}
            >
                <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-accent/25 bg-accent/12 text-[11px] font-semibold text-accent">
                        {initials(conv.contact.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                            <span className="truncate text-sm font-medium text-ink/85">
                                {conv.contact.name}
                            </span>
                            <span className="shrink-0 whitespace-nowrap text-[10px] text-ink/35">
                                {formatDateTime(conv.last_message_at)}
                            </span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                            {conv.sector && (
                                <Badge variant="outline" className="h-4 px-1.5 text-[10px] font-normal">
                                    {conv.sector.name}
                                </Badge>
                            )}
                            {conv.bot_only ? (
                                <Badge className="h-4 gap-0.5 bg-accent/12 px-1.5 text-[10px] font-normal text-accent hover:bg-accent/20">
                                    <Bot className="h-2.5 w-2.5" />
                                    Bot
                                </Badge>
                            ) : conv.assigned_user ? (
                                <span className="flex items-center gap-0.5 text-[10px] text-ink/45">
                                    <UserRound className="h-2.5 w-2.5" />
                                    {conv.assigned_user.name}
                                </span>
                            ) : null}
                            {conv.duration_minutes !== null && (
                                <span className="flex items-center gap-0.5 text-[10px] text-ink/35">
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
            <div className="shrink-0 border-b border-accent/10 px-4 py-3">
                <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-accent/25 bg-accent/12 text-sm font-semibold text-accent">
                        {initials(detail.contact.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-ink/90">{detail.contact.name}</p>
                        <p className="text-[11px] text-ink/40">{detail.contact.wa_id}</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                        {detail.sector && (
                            <Badge variant="outline" className="h-5 px-2 text-[10px]">
                                {detail.sector.name}
                            </Badge>
                        )}
                        {detail.assigned_user ? (
                            <Badge variant="outline" className="h-5 gap-1 px-2 text-[10px]">
                                <UserRound className="h-3 w-3" />
                                {detail.assigned_user.name}
                            </Badge>
                        ) : (
                            <Badge className="h-5 gap-1 bg-accent/12 px-2 text-[10px] font-normal text-accent hover:bg-accent/20">
                                <Bot className="h-3 w-3" />
                                Bot
                            </Badge>
                        )}
                        <span className="flex items-center gap-1 rounded-full border border-ink/10 px-2 py-0.5 text-[10px] text-ink/45">
                            <Clock className="h-3 w-3" />
                            {formatDuration(detail.duration_minutes)}
                        </span>
                    </div>
                </div>
                <p className="mt-1.5 text-[11px] text-ink/35">
                    {formatDateTime(detail.created_at)}
                    {detail.last_message_at && detail.last_message_at !== detail.created_at && (
                        <> → {formatDateTime(detail.last_message_at)}</>
                    )}
                </p>
            </div>

            <div ref={threadRef} className="flex-1 overflow-y-auto px-4 py-4">
                <Divider label={`Conversa iniciada · ${formatDateTime(detail.created_at)}`} variant="muted" />

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
                                label={`${event.name} assumiu o atendimento${event.time ? ' · ' + formatTime(event.time) : ''}`}
                                variant="accent"
                            />
                        );
                    }

                    if (event.kind === 'closed') {
                        return (
                            <Divider
                                key={`closed-${i}`}
                                label={`Atendimento encerrado${event.time ? ' · ' + formatTime(event.time) : ''}`}
                                variant="muted"
                            />
                        );
                    }

                    if (event.kind === 'survey') {
                        return (
                            <div
                                key={`survey-${i}`}
                                className="mx-auto my-3 max-w-xs rounded-xl border border-accent/20 bg-accent/5 px-4 py-3 text-center"
                            >
                                <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-accent/70">
                                    Pesquisa de satisfação
                                </p>
                                <div className="flex flex-col gap-1">
                                    {event.answers.map((a, j) => (
                                        <p key={j} className="flex items-center justify-center gap-1.5 text-sm font-medium text-ink/75">
                                            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                                            {a.option_label}
                                        </p>
                                    ))}
                                </div>
                                {event.time && (
                                    <p className="mt-1.5 text-[10px] text-ink/35">{formatTime(event.time)}</p>
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
        return route('historico.export') + '?' + p.toString();
    })();

    return (
        <AuthenticatedLayout header={<h2>Histórico</h2>}>
            <Head title="Histórico" />

            <div className="flex h-full flex-col overflow-hidden">
                {/* Stats + Filters */}
                <div className="shrink-0 space-y-3 border-b border-accent/10 px-4 py-3">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <StatCard label="Total" value={stats.total.toLocaleString('pt-BR')} sub="atendimentos" />
                        <StatCard label="Tempo médio" value={formatDuration(stats.avg_duration_minutes)} sub="por conversa" />
                        <StatCard label="Bot resolveu" value={`${stats.bot_only_pct}%`} sub="sem atendente humano" />
                        <StatCard label="Pesquisas" value={stats.survey_completed.toLocaleString('pt-BR')} sub="respondidas" />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/35" />
                            <Input
                                className="h-8 w-44 pl-8 text-xs"
                                placeholder="Buscar contato..."
                                value={localSearch}
                                onChange={(e) => handleSearch(e.target.value)}
                            />
                        </div>

                        <Input
                            type="date"
                            className="h-8 w-36 text-xs"
                            value={filters.date_from}
                            onChange={(e) => go({ date_from: e.target.value, conversation: undefined })}
                        />
                        <span className="text-xs text-ink/40">até</span>
                        <Input
                            type="date"
                            className="h-8 w-36 text-xs"
                            value={filters.date_to}
                            onChange={(e) => go({ date_to: e.target.value, conversation: undefined })}
                        />

                        <Select
                            value={filters.sector_id ? String(filters.sector_id) : 'all'}
                            onValueChange={(v) => go({ sector_id: v === 'all' ? null : Number(v), conversation: undefined })}
                        >
                            <SelectTrigger className="h-8 w-40 text-xs">
                                <SelectValue placeholder="Todos os setores" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos os setores</SelectItem>
                                {sectors.map((s) => (
                                    <SelectItem key={s.id} value={String(s.id)}>
                                        {s.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select
                            value={filters.user_id ? String(filters.user_id) : 'all'}
                            onValueChange={(v) => go({ user_id: v === 'all' ? null : Number(v), conversation: undefined })}
                        >
                            <SelectTrigger className="h-8 w-40 text-xs">
                                <SelectValue placeholder="Todos os atendentes" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos os atendentes</SelectItem>
                                {users.map((u) => (
                                    <SelectItem key={u.id} value={String(u.id)}>
                                        {u.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <div className="ml-auto">
                            <a href={exportUrl} download>
                                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                                    <Download className="h-3.5 w-3.5" />
                                    Exportar CSV
                                </Button>
                            </a>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="flex min-h-0 flex-1 overflow-hidden">
                    {/* Left: List */}
                    <div className="flex w-80 shrink-0 flex-col overflow-hidden border-r border-accent/10">
                        <div className="flex-1 overflow-y-auto">
                            {conversations.data.length === 0 ? (
                                <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
                                    <History className="h-8 w-8 text-ink/20" />
                                    <p className="text-sm text-ink/40">Nenhum atendimento encontrado</p>
                                    <p className="text-xs text-ink/30">Tente ajustar os filtros</p>
                                </div>
                            ) : (
                                <ul className="divide-y divide-accent/10">
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
                        </div>

                        {conversations.last_page > 1 && (
                            <div className="flex shrink-0 items-center justify-between border-t border-accent/10 px-3 py-2">
                                <span className="text-[11px] text-ink/40">
                                    {conversations.total.toLocaleString('pt-BR')} total · pág.{' '}
                                    {conversations.current_page}/{conversations.last_page}
                                </span>
                                <div className="flex gap-1">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        disabled={conversations.current_page === 1}
                                        onClick={() => go({ page: conversations.current_page - 1 })}
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
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
                            <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
                                <MessageCircle className="h-10 w-10 text-ink/15" />
                                <p className="text-sm font-medium text-ink/30">
                                    Selecione um atendimento para ver o histórico
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
