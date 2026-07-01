import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { Input } from '@/Components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/Components/ui/select';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { formatDuration as fmtDuration } from '@/lib/formatDuration';
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
    Copy,
    Download,
    FileText,
    Filter,
    History,
    ImageIcon,
    MessageCircle,
    Mic,
    Search,
    Star,
    UserRound,
    Video,
    X,
} from 'lucide-react';
import { toast } from 'sonner';
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

const WebIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M21 2H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h7v2H8v2h8v-2h-2v-2h7c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H3V4h18v12z"/>
    </svg>
);

// ─── Types ──────────────────────────────────────────────────────────────────

interface Tag {
    id: number;
    name: string;
    color: string;
}

interface ConvItem {
    id: number;
    protocol_number: string | null;
    contact: { id: number; name: string; wa_id: string };
    assigned_user: { id: number; name: string } | null;
    sector: { id: number; name: string } | null;
    bot_only: boolean;
    duration_minutes: number | null;
    survey_answer: string | null;
    survey_completed: boolean;
    last_message_at: string | null;
    created_at: string | null;
    channel_type: 'whatsapp' | 'telegram' | 'web' | null;
    channel_name: string | null;
    tags: Tag[];
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
    protocol_number: string | null;
    contact: { id: number; name: string; wa_id: string };
    assigned_user: { id: number; name: string } | null;
    sector: { id: number; name: string } | null;
    channel_type: 'whatsapp' | 'telegram' | 'web' | null;
    channel_name: string | null;
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
    tag_id: number | null;
    search: string | null;
    channel: string | null;
}

interface Props extends PageProps {
    conversations: PaginatedList;
    selected: Detail | null;
    sectors: { id: number; name: string }[];
    users: { id: number; name: string }[];
    tags: Tag[];
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
    return fmtDuration(mins);
}

function historicoFilterTriggerClass(active: boolean): string {
    return cn(
        'h-8 w-full min-w-0 rounded-lg border-transparent bg-ink/[0.03] px-2 text-[10px] font-medium text-ink/55 shadow-none transition-colors hover:bg-ink/[0.06] hover:text-ink/75 focus:ring-1 focus:ring-accent/25',
        active && 'bg-accent/10 text-accent ring-1 ring-accent/20',
    );
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
                            ? 'rounded-tl-sm border border-black/[0.08] bg-white text-gray-800 dark:border-white/[0.10] dark:bg-zinc-700 dark:text-zinc-100'
                            : isHuman
                              ? 'rounded-tr-sm border border-green-400/50 bg-green-50 text-green-950 dark:border-green-500/40 dark:bg-green-900 dark:text-green-50'
                              : 'rounded-tr-sm border border-sky-400/50 bg-sky-50 text-sky-950 dark:border-sky-500/40 dark:bg-sky-900 dark:text-sky-50',
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
    icon,
    iconBg,
}: {
    label: string;
    value: string;
    sub: string;
    icon: React.ReactNode;
    iconBg: string;
}) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {label}
                </CardTitle>
                <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', iconBg)}>
                    {icon}
                </div>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold tracking-tight sm:text-3xl">{value}</div>
                <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
            </CardContent>
        </Card>
    );
}

// ─── ConvRow ─────────────────────────────────────────────────────────────────

const TAG_BADGE_CLASSES: Record<string, string> = {
    blue:   'bg-blue-100 text-blue-800 border-ink/15 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/40',
    green:  'bg-green-100 text-green-800 border-ink/15 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800/40',
    amber:  'bg-amber-100 text-amber-800 border-ink/15 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800/40',
    red:    'bg-red-100 text-red-800 border-ink/15 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800/40',
    purple: 'bg-purple-100 text-purple-800 border-ink/15 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800/40',
    teal:   'bg-teal-100 text-teal-800 border-ink/15 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-800/40',
    coral:  'bg-orange-100 text-orange-800 border-ink/15 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800/40',
    pink:   'bg-pink-100 text-pink-800 border-ink/15 dark:bg-pink-900/30 dark:text-pink-300 dark:border-pink-800/40',
};

function ConvRow({ conv, selected, onClick }: { conv: ConvItem; selected: boolean; onClick: () => void }) {
    const previewParts: string[] = [];
    if (conv.protocol_number) previewParts.push(`#${conv.protocol_number}`);
    if (conv.duration_minutes !== null) previewParts.push(formatDuration(conv.duration_minutes));
    if (conv.survey_completed && conv.survey_answer) previewParts.push(conv.survey_answer);
    const preview = previewParts.join(' · ') || '—';

    return (
        <li>
            <button
                type="button"
                onClick={onClick}
                className={cn(
                    'group relative w-full border-b border-ink/[0.07] px-4 py-3 text-left text-ink transition',
                    selected ? 'bg-accent/[0.08]' : 'hover:bg-ink/[0.05]',
                )}
            >
                {selected && (
                    <span className="absolute inset-y-0 left-0 z-10 w-[3px] rounded-r-full bg-accent" />
                )}

                <div className="flex items-start gap-3">
                    <div className="relative mt-0.5 shrink-0">
                        <div
                            className={cn(
                                'h-10 w-10 overflow-hidden rounded-full transition-colors',
                                selected
                                    ? 'bg-accent shadow-sm shadow-accent/30'
                                    : 'border border-accent/25 bg-accent/10',
                            )}
                        >
                            <div
                                className={cn(
                                    'flex h-full w-full items-center justify-center text-xs font-semibold',
                                    selected ? 'text-canvas' : 'text-accent',
                                )}
                            >
                                {initials(conv.contact.name)}
                            </div>
                        </div>
                        <span
                            className={cn(
                                'absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full ring-2 ring-canvas',
                                conv.channel_type === 'telegram'
                                    ? 'bg-blue-500 text-white'
                                    : conv.channel_type === 'web'
                                      ? 'bg-violet-500 text-white'
                                      : 'bg-green-500 text-white',
                            )}
                            title={conv.channel_name ?? (conv.channel_type === 'telegram' ? 'Telegram' : conv.channel_type === 'web' ? 'Chat Web' : 'WhatsApp')}
                        >
                            {conv.channel_type === 'telegram' ? (
                                <TelegramIcon className="h-2.5 w-2.5" />
                            ) : conv.channel_type === 'web' ? (
                                <WebIcon className="h-2.5 w-2.5" />
                            ) : (
                                <WhatsAppIcon className="h-2.5 w-2.5" />
                            )}
                        </span>
                    </div>

                    <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                            <span className="truncate font-medium">{conv.contact.name}</span>
                            <span className="shrink-0 text-xs text-ink/40">
                                {formatTime(conv.last_message_at) || formatRelativeDate(conv.last_message_at)}
                            </span>
                        </div>
                        <div className="flex items-center gap-1 overflow-hidden text-sm text-ink/48">
                            {conv.survey_completed && (
                                <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" />
                            )}
                            <span className="truncate">{preview}</span>
                        </div>
                    </div>
                </div>

                <div className="mt-2 flex w-full flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-medium leading-none">
                    {conv.bot_only ? (
                        <span className="inline-flex h-5 shrink-0 items-center gap-1 rounded-full border border-ink/15 bg-sky-400/12 px-2 font-semibold text-sky-700 dark:border-sky-400/35 dark:bg-sky-400/12 dark:text-sky-300">
                            <Bot className="h-3 w-3" />
                            Automação
                        </span>
                    ) : (
                        <Badge variant="outline" className="h-5 shrink-0 px-2 py-0 text-[10px] leading-none">
                            Encerrado
                        </Badge>
                    )}

                    {conv.sector && (
                        <span
                            className="inline-flex h-5 max-w-[12rem] min-w-0 items-center gap-1 rounded-full bg-accent/[0.07] px-1.5 text-accent"
                            title={conv.sector.name}
                        >
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent/80" />
                            <span className="min-w-0 truncate">{conv.sector.name}</span>
                        </span>
                    )}

                    {conv.tags?.slice(0, 2).map((tag) => (
                        <span
                            key={tag.id}
                            className={`inline-flex h-5 max-w-[8rem] min-w-0 items-center rounded-full border px-1.5 text-[10px] font-medium ${TAG_BADGE_CLASSES[tag.color] ?? TAG_BADGE_CLASSES.blue}`}
                            title={tag.name}
                        >
                            <span className="min-w-0 truncate">{tag.name}</span>
                        </span>
                    ))}

                    {(conv.tags?.length ?? 0) > 2 && (
                        <span className="text-[10px] text-ink/35">+{conv.tags!.length - 2}</span>
                    )}

                    {conv.assigned_user && (
                        <span
                            className="inline-flex h-5 max-w-[9rem] min-w-0 items-center gap-1 text-ink/50"
                            title={conv.assigned_user.name}
                        >
                            <UserRound className="h-3 w-3 shrink-0 opacity-60" />
                            <span className="min-w-0 truncate">
                                {conv.assigned_user.name.split(' ')[0]}
                            </span>
                        </span>
                    )}
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
            <div className="shrink-0 border-b border-ink/[0.08] bg-gradient-to-r from-accent/[0.08] via-ink/[0.03] to-transparent px-4 py-2.5">
                <div className="flex min-h-14 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-canvas shadow-md shadow-accent/25">
                        {initials(detail.contact.name)}
                    </div>

                    <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-ink/95">
                            {detail.contact.name}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <span className="text-[11px] font-medium text-ink/55">
                                {detail.channel_type === 'telegram'
                                    ? `ID: ${detail.contact.wa_id}`
                                    : detail.channel_type === 'web'
                                      ? 'Chat Web'
                                      : detail.contact.wa_id}
                            </span>

                            {detail.protocol_number && (
                                <button
                                    type="button"
                                    title="Copiar número de protocolo"
                                    onClick={() => {
                                        navigator.clipboard.writeText(detail.protocol_number!);
                                        toast.success('Protocolo copiado!');
                                    }}
                                    className="group inline-flex items-center gap-1 rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold text-accent transition-colors hover:bg-accent/15"
                                >
                                    #{detail.protocol_number}
                                    <Copy className="h-2.5 w-2.5 opacity-70 transition-opacity group-hover:opacity-100" />
                                </button>
                            )}

                            {detail.channel_type === 'telegram' ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:bg-blue-950/30 dark:text-blue-400">
                                    <TelegramIcon className="h-2.5 w-2.5" />
                                    {detail.channel_name ?? 'Telegram'}
                                </span>
                            ) : detail.channel_type === 'web' ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-600 dark:bg-violet-950/30 dark:text-violet-400">
                                    <WebIcon className="h-2.5 w-2.5" />
                                    {detail.channel_name ?? 'Chat Web'}
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-1.5 py-0.5 text-[10px] font-medium text-green-600 dark:bg-green-950/30 dark:text-green-400">
                                    <WhatsAppIcon className="h-2.5 w-2.5" />
                                    {detail.channel_name ?? 'WhatsApp'}
                                </span>
                            )}

                            <span className="inline-flex items-center rounded-full bg-ink/[0.08] px-1.5 py-0.5 text-[10px] font-medium text-ink/65">
                                Encerrado
                            </span>

                            {detail.sector && (
                                <span className="inline-flex items-center rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                                    {detail.sector.name}
                                </span>
                            )}

                            {detail.assigned_user ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-700 dark:bg-sky-950/30 dark:text-sky-300">
                                    <UserRound className="h-2.5 w-2.5" />
                                    {detail.assigned_user.name}
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-950/30 dark:text-violet-400">
                                    <Bot className="h-2.5 w-2.5" />
                                    Automação
                                </span>
                            )}

                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-950/30 dark:text-blue-400">
                                <Clock className="h-2.5 w-2.5" />
                                {formatDuration(detail.duration_minutes)}
                            </span>

                            {detail.survey?.status === 'completed' && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                                    <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                                    Pesquisa
                                </span>
                            )}

                            <span className="inline-flex items-center gap-1 rounded-full border border-ink/[0.10] bg-ink/[0.04] px-1.5 py-0.5 text-[10px] font-medium text-ink/60">
                                <Calendar className="h-2.5 w-2.5 text-accent/70" />
                                {formatDateTime(detail.created_at)}
                                {detail.last_message_at && detail.last_message_at !== detail.created_at && (
                                    <> → {formatDateTime(detail.last_message_at)}</>
                                )}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Thread */}
            <div ref={threadRef} className="chat-bg scrollbar-thin flex-1 overflow-y-auto px-5 py-5">
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
    tags,
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
        if (filters.tag_id) base.tag_id = filters.tag_id;
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

    const activeFilterCount = [
        filters.sector_id,
        filters.user_id,
        filters.tag_id,
        filters.channel,
        filters.search,
    ].filter(Boolean).length;

    const clearFilters = () => {
        const now = new Date();
        const to = now.toISOString().slice(0, 10);
        const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
        setLocalSearch('');
        router.get(route('historico.index'), { date_from: from, date_to: to }, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    return (
        <AuthenticatedLayout header={<h2>Histórico</h2>}>
            <Head title="Histórico" />

            <div className="flex h-full flex-col overflow-hidden">

                {/* ── Stats + Filters ── */}
                <div className="shrink-0 space-y-3 border-b border-accent/10 px-4 py-3.5 lg:px-5">

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-3">
                        <StatCard
                            label="Atendimentos"
                            value={stats.total.toLocaleString('pt-BR')}
                            sub="no período"
                            icon={<MessageCircle className="h-4 w-4 text-green-600 dark:text-green-400" />}
                            iconBg="bg-green-50 dark:bg-green-900/20"
                        />
                        <StatCard
                            label="Tempo médio"
                            value={formatDuration(stats.avg_duration_minutes)}
                            sub="por conversa"
                            icon={<Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
                            iconBg="bg-blue-50 dark:bg-blue-900/20"
                        />
                        <StatCard
                            label="Bot resolveu"
                            value={`${stats.bot_only_pct}%`}
                            sub="sem atendente humano"
                            icon={<Bot className="h-4 w-4 text-violet-600 dark:text-violet-400" />}
                            iconBg="bg-violet-50 dark:bg-violet-900/20"
                        />
                        <StatCard
                            label="Pesquisas"
                            value={stats.survey_completed.toLocaleString('pt-BR')}
                            sub="respondidas"
                            icon={<Star className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
                            iconBg="bg-amber-50 dark:bg-amber-900/20"
                        />
                    </div>

                    {/* Filters */}
                    <div className="space-y-2.5 rounded-xl border border-accent/10 bg-canvas/50 p-3 dark:bg-ink/[0.02]">
                        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                            <div className="relative min-w-0 flex-1">
                                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/35" />
                                <Input
                                    className="h-8 rounded-lg border-transparent bg-ink/[0.04] pl-8 pr-8 text-xs shadow-none placeholder:text-ink/40 focus-visible:border-accent/30 focus-visible:bg-canvas focus-visible:ring-1 focus-visible:ring-accent/25"
                                    placeholder="Buscar contato ou protocolo..."
                                    aria-label="Buscar atendimentos"
                                    value={localSearch}
                                    onChange={(e) => handleSearch(e.target.value)}
                                />
                                {localSearch !== '' && (
                                    <button
                                        type="button"
                                        onClick={() => handleSearch('')}
                                        aria-label="Limpar busca"
                                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-ink/35 transition-colors hover:bg-ink/[0.06] hover:text-ink/70"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                )}
                            </div>

                            <div className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-ink/[0.04] px-2">
                                <Calendar className="h-3.5 w-3.5 shrink-0 text-ink/35" />
                                <label className="sr-only" htmlFor="date-from">Data inicial</label>
                                <Input
                                    id="date-from"
                                    type="date"
                                    title="Data inicial"
                                    className="date-range-input h-7 w-[6.75rem] cursor-pointer border-0 bg-transparent p-0 text-center text-[10px] font-medium text-ink/75 shadow-none focus-visible:ring-0"
                                    value={filters.date_from}
                                    onChange={(e) => go({ date_from: e.target.value, conversation: undefined })}
                                />
                                <span className="text-[10px] leading-none text-ink/30 select-none">até</span>
                                <label className="sr-only" htmlFor="date-to">Data final</label>
                                <Input
                                    id="date-to"
                                    type="date"
                                    title="Data final"
                                    className="date-range-input h-7 w-[6.75rem] cursor-pointer border-0 bg-transparent p-0 text-center text-[10px] font-medium text-ink/75 shadow-none focus-visible:ring-0"
                                    value={filters.date_to}
                                    onChange={(e) => go({ date_to: e.target.value, conversation: undefined })}
                                />
                            </div>

                            {activeFilterCount > 0 && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 shrink-0 gap-1 rounded-lg px-2.5 text-[10px] text-ink/50 hover:bg-ink/[0.04] hover:text-ink/80"
                                    onClick={clearFilters}
                                >
                                    <X className="h-3 w-3" />
                                    Limpar ({activeFilterCount})
                                </Button>
                            )}
                        </div>

                        <div
                            className={cn(
                                'grid gap-1',
                                tags.length > 0
                                    ? 'grid-cols-2 sm:grid-cols-4'
                                    : 'grid-cols-2 sm:grid-cols-3',
                            )}
                        >
                            <Select
                                value={filters.sector_id ? String(filters.sector_id) : 'all'}
                                onValueChange={(v) => go({ sector_id: v === 'all' ? null : Number(v), conversation: undefined })}
                            >
                                <SelectTrigger className={historicoFilterTriggerClass(!!filters.sector_id)}>
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
                                <SelectTrigger className={historicoFilterTriggerClass(!!filters.user_id)}>
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
                                <SelectTrigger className={historicoFilterTriggerClass(!!filters.channel)}>
                                    <SelectValue placeholder="Canal" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos os canais</SelectItem>
                                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                                    <SelectItem value="telegram">Telegram</SelectItem>
                                </SelectContent>
                            </Select>

                            {tags.length > 0 && (
                                <Select
                                    value={filters.tag_id ? String(filters.tag_id) : 'all'}
                                    onValueChange={(v) => go({ tag_id: v === 'all' ? null : Number(v), conversation: undefined })}
                                >
                                    <SelectTrigger className={historicoFilterTriggerClass(!!filters.tag_id)}>
                                        <SelectValue placeholder="Etiqueta" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todas as etiquetas</SelectItem>
                                        {tags.map((t) => (
                                            <SelectItem key={t.id} value={String(t.id)}>
                                                {t.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Content ── */}
                <div className="flex min-h-0 flex-1 gap-0 overflow-hidden p-2 lg:gap-2 lg:p-3">

                    {/* Left: Conversation list */}
                    <Card className="flex w-[min(100%,340px)] shrink-0 flex-col overflow-hidden md:w-[340px]">

                        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-accent/10 px-4 py-2.5">
                            <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-ink/60">
                                <Filter className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">
                                    {conversations.total.toLocaleString('pt-BR')}{' '}
                                    {conversations.total === 1 ? 'atendimento' : 'atendimentos'}
                                </span>
                            </span>
                            <a href={exportUrl} download className="shrink-0">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 gap-1.5 rounded-lg border-accent/15 bg-canvas/50 px-2.5 text-[10px] font-medium text-ink/60 shadow-none hover:bg-accent/10 hover:text-accent"
                                >
                                    <Download className="h-3 w-3" />
                                    Exportar
                                </Button>
                            </a>
                        </div>

                        {conversations.data.length === 0 ? (
                            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
                                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ink/[0.04] ring-1 ring-ink/10">
                                    <History className="h-7 w-7 text-ink/25" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-ink/50">Nenhum atendimento encontrado</p>
                                    <p className="mt-1 text-xs text-ink/35">Ajuste o período ou os filtros acima</p>
                                </div>
                            </div>
                        ) : (
                            <ul className="scrollbar-thin flex-1 overflow-y-auto">
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
                                <span className="text-[11px] text-ink/40">
                                    Página {conversations.current_page} de {conversations.last_page}
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
                    </Card>

                    {/* Right: Detail — painel de trabalho, sem glow */}
                    <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-accent/10 bg-ink/[0.015]">
                        {selected ? (
                            <DetailPanel detail={selected} />
                        ) : (
                            <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
                                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-accent/15 bg-accent/5">
                                    <MessageCircle className="h-8 w-8 text-accent/40" />
                                </div>
                                <div>
                                    <p className="font-manrope text-sm font-semibold text-ink/55">Selecione um atendimento</p>
                                    <p className="mt-1 text-xs text-ink/35">Clique em uma conversa para ver o histórico completo</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
