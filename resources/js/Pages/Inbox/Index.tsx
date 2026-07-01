import { ChatMessage } from '@/Components/ChatMessage';
import { UserAvatar } from '@/Components/UserAvatar';
import { ChatThread, MessageScrollerItem } from '@/Components/ChatThread';
import type { ChatBubbleVariant } from '@/Components/ui/bubble';
import ContactHistoryPanel from '@/Components/ContactHistoryPanel';
import SnoozeDateTimePicker from '@/Components/SnoozeDateTimePicker';
import SlaIndicator from '@/Components/SlaIndicator';
import IxcPanel from '@/Components/IxcPanel';
import NotesPanel from '@/Components/NotesPanel';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/Components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/Components/ui/dropdown-menu';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/Components/ui/select';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { Textarea } from '@/Components/ui/textarea';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { isMediaMessageType, mediaCaption, mediaTypeFromPlaceholder } from '@/lib/messageMedia';
import { useInboxViewing } from '@/hooks/useInboxViewing';
import {
    inboxMessageFromRealtime,
    type InboxRealtimeMessage,
    useInboxRealtime,
} from '@/hooks/useInboxRealtime';
import { computeLiveSla, SLA_STATUS_META, type ConversationSla } from '@/lib/sla';
import {
    defaultCustomSnoozeDate,
    defaultCustomSnoozeTime,
    formatSnoozeUntil,
    snoozeUntilFromPreset,
    type SnoozePreset,
} from '@/lib/snooze';
import { cn, formatClientDisplayName, formatClientPhone, onlyDigits } from '@/lib/utils';
import { PageProps } from '@/types';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import axios from 'axios';
import {
    AlarmClock,
    AlertTriangle,
    ArrowDownUp,
    ArrowLeft,
    ArrowRightLeft,
    Bot,
    Building2,
    Check,
    ChevronDown,
    CheckCheck,
    CircleX,
    Clock,
    Eye,
    Copy,
    FileText,
    History,
    ImageIcon,
    Loader2,
    MessageSquare,
    Mic,
    Paperclip,
    Pause,
    PanelRight,
    Play,
    Search,
    Send,
    Shield,
    Smile,
    Square,
    Star,
    StickyNote,
    Tag as TagIcon,
    Trash2,
    UserCheck,
    UserRound,
    Video,
    X,
} from 'lucide-react';
import EmojiPicker, { Categories, EmojiClickData, Theme } from 'emoji-picker-react';
import { ChangeEvent, SyntheticEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

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

type Status = 'bot' | 'queued' | 'open' | 'closed' | 'surveying' | 'snoozed';

interface Sector {
    id: number;
    name: string;
}

interface Tag {
    id: number;
    name: string;
    color: string;
}

interface ConversationSummary {
    id: number;
    status: Status;
    channel_type: 'whatsapp' | 'telegram' | 'web' | null;
    channel_name: string | null;
    assigned_user_id: number | null;
    assigned_user: { id: number; name: string; profile_photo_url?: string | null } | null;
    sector: Sector | null;
    can_transfer: boolean;
    can_snooze: boolean;
    can_wake: boolean;
    snoozed_until: string | null;
    snooze_note: string | null;
    contact: {
        id: number;
        name: string;
        wa_id: string;
        avatar_url?: string | null;
    };
    last_message: string | null;
    last_message_type?: string | null;
    last_message_at: string | null;
    last_message_direction?: string | null;
    last_message_status?: string | null;
    unread_count: number;
    tags: Tag[];
    sla: ConversationSla | null;
}

interface Msg {
    id: number;
    direction: 'in' | 'out';
    type: string;
    body: string | null;
    media_url?: string | null;
    transcription?: string | null;
    status: string | null;
    is_internal?: boolean;
    sender: { id: number; name: string } | null;
    created_at: string | null;
}

type MessageRole = 'client' | 'attendant' | 'automation' | 'internal';

interface QuickReply {
    id: number;
    trigger: string;
    title: string;
    content: string;
}

interface ContactHistoryItem {
    id: number;
    protocol_number: string | null;
    status: Status;
    is_current: boolean;
    channel_type: 'whatsapp' | 'telegram' | 'web' | null;
    channel_name: string | null;
    assigned_user: { id: number; name: string; profile_photo_url?: string | null } | null;
    sector: Sector | null;
    bot_only: boolean;
    duration_minutes: number | null;
    csat_score: number | null;
    survey_completed: boolean;
    message_count: number;
    created_at: string | null;
    last_message_at: string | null;
    last_message_preview: string | null;
}

interface Selected {
    id: number;
    protocol_number: string | null;
    status: Status;
    channel_type: 'whatsapp' | 'telegram' | 'web' | null;
    channel_name: string | null;
    assigned_user_id: number | null;
    assigned_user: { id: number; name: string; profile_photo_url?: string | null } | null;
    sector: Sector | null;
    can_act: boolean;
    can_send_internal: boolean;
    can_assign: boolean;
    can_transfer: boolean;
    can_force_close: boolean;
    can_snooze: boolean;
    can_wake: boolean;
    snoozed_until: string | null;
    snooze_note: string | null;
    last_message_at: string | null;
    contact: {
        id: number;
        name: string;
        wa_id: string;
        ixc_customer_id: string | null;
        ixc_customer_name: string | null;
        notes: string | null;
    };
    messages: Msg[];
    tags: Tag[];
    contact_history: {
        total: number;
        items: ContactHistoryItem[];
    };
    sla: ConversationSla | null;
}

interface UserFilter {
    id: number;
    name: string;
}

interface Props {
    conversations: ConversationSummary[];
    selected: Selected | null;
    filter: string;
    sort: string;
    sector_id: number | null;
    user_id: number | null;
    tag_id: number | null;
    sectors: Sector[];
    users: UserFilter[];
    tags: Tag[];
    transfer_users: UserFilter[];
    counts: { bot: number; queued: number; mine: number; snoozed: number };
    auto_close_enabled: boolean;
    auto_close_minutes: number;
    quick_replies: QuickReply[];
    has_ixc: boolean;
}

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

const TAG_DOT_CLASSES: Record<string, string> = {
    blue:   'bg-blue-400',
    green:  'bg-green-500',
    amber:  'bg-amber-400',
    red:    'bg-red-500',
    purple: 'bg-purple-500',
    teal:   'bg-teal-400',
    coral:  'bg-orange-400',
    pink:   'bg-pink-400',
};

const STATUS_LABEL: Record<Status, string> = {
    bot: 'Automação',
    queued: 'Na fila',
    open: 'Em atendimento',
    closed: 'Encerrada',
    surveying: 'Pesquisa',
    snoozed: 'Adiada',
};

const STATUS_VARIANT: Record<
    Status,
    'default' | 'secondary' | 'outline' | 'destructive' | 'queued' | 'bot'
> = {
    bot: 'bot',
    queued: 'queued',
    open: 'default',
    closed: 'outline',
    surveying: 'secondary',
    snoozed: 'secondary',
};

function formatTime(iso: string | null): string {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
    });
}

function conversationDisplayName(conversation: ConversationSummary): string {
    return conversation.channel_type === 'web'
        ? conversation.contact.name && !conversation.contact.name.startsWith('web_')
            ? conversation.contact.name
            : 'Visitante'
        : formatClientDisplayName(conversation.contact.name, conversation.contact.wa_id);
}

function inboxFilterTriggerClass(active: boolean): string {
    return cn(
        'flex h-8 w-full min-w-0 items-center justify-center gap-1 rounded-lg px-1.5 text-[10px] font-medium transition-colors',
        active
            ? 'bg-accent/10 text-accent ring-1 ring-accent/20'
            : 'bg-ink/[0.03] text-ink/55 hover:bg-ink/[0.06] hover:text-ink/75',
    );
}

function matchesListSearch(conversation: ConversationSummary, query: string): boolean {
    const q = query.trim().toLowerCase();
    if (!q) return true;

    const digits = onlyDigits(q);
    const haystack = [
        conversationDisplayName(conversation),
        conversation.contact.name,
        conversation.contact.wa_id,
        formatClientPhone(conversation.contact.wa_id),
        conversation.last_message,
        conversation.assigned_user?.name,
        conversation.sector?.name,
        conversation.channel_name,
        ...conversation.tags.map((tag) => tag.name),
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

    if (haystack.includes(q)) return true;

    if (digits.length >= 3) {
        const phoneHaystack = onlyDigits(
            [conversation.contact.wa_id, formatClientPhone(conversation.contact.wa_id)].join(''),
        );
        return phoneHaystack.includes(digits);
    }

    return false;
}

function mediaPreview(message: ConversationSummary): {
    icon: typeof ImageIcon;
    label: string;
} | null {
    const normalizedType = (message.last_message_type ?? '').toLowerCase();
    const inferredType = mediaTypeFromPlaceholder(message.last_message) ?? '';
    const type = normalizedType || inferredType;

    if (type === 'image') return { icon: ImageIcon, label: 'Imagem' };
    if (type === 'audio') return { icon: Mic, label: 'Áudio' };
    if (type === 'video') return { icon: Video, label: 'Vídeo' };
    if (type === 'document') return { icon: FileText, label: 'Documento' };

    return null;
}

function formatDuration(totalSeconds: number): string {
    const m = Math.floor(totalSeconds / 60);
    const s = Math.floor(totalSeconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatCountdown(totalSeconds: number): string {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

const RECORDING_WAVE_LEVELS_BASE = [
    0.2, 0.28, 0.36, 0.48, 0.6, 0.75, 0.9, 1, 0.9, 0.75, 0.62, 0.5, 0.38, 0.3, 0.22, 0.18,
];
const RECORDING_WAVE_BARS = RECORDING_WAVE_LEVELS_BASE.length;

function initials(name: string): string {
    const parts = name
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

function messageDedupKey(message: Msg): string {
    return `${message.body ?? ''}\0${message.is_internal ? '1' : '0'}\0${message.sender?.id ?? ''}`;
}

function messageRole(message: Msg): MessageRole {
    if (message.is_internal) return 'internal';
    if (message.direction === 'in') return 'client';
    return message.sender ? 'attendant' : 'automation';
}

const MESSAGE_ROLE_META = {
    client: {
        metaText: 'text-ink/42',
        tick: 'text-gray-800/70 dark:text-ink/70',
        tickRead: 'text-gray-800 dark:text-ink',
    },
    attendant: {
        metaText: 'text-canvas/70 dark:text-black/65',
        tick: 'text-canvas/70 dark:text-black/65',
        tickRead: 'text-canvas dark:text-black',
    },
    automation: {
        metaText: 'text-sky-800/55 dark:text-sky-200/60',
        tick: 'text-sky-950/70 dark:text-white/70',
        tickRead: 'text-sky-950 dark:text-white',
    },
    internal: {
        metaText: 'text-red-800/55 dark:text-red-200/60',
        tick: 'text-red-950/70 dark:text-white/70',
        tickRead: 'text-red-950 dark:text-white',
    },
} satisfies Record<
    MessageRole,
    {
        metaText: string;
        tick: string;
        tickRead: string;
    }
>;

const BUBBLE_VARIANT: Record<MessageRole, ChatBubbleVariant> = {
    client: 'incoming',
    attendant: 'outgoing-accent',
    automation: 'outgoing-automation',
    internal: 'outgoing-internal',
};

function ComposerModeToggle({
    mode,
    onChange,
}: {
    mode: 'client' | 'internal';
    onChange: (mode: 'client' | 'internal') => void;
}) {
    return (
        <div
            role="tablist"
            aria-label="Tipo de mensagem"
            className="grid grid-cols-2 gap-1 rounded-xl border border-ink/[0.08] bg-ink/[0.04] p-1 dark:border-white/[0.06]"
        >
            <button
                type="button"
                role="tab"
                aria-selected={mode === 'client'}
                onClick={() => onChange('client')}
                className={cn(
                    'relative flex h-9 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-all duration-200',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30',
                    mode === 'client'
                        ? 'bg-accent text-canvas shadow-sm dark:text-black'
                        : 'text-ink/45 hover:bg-ink/[0.06] hover:text-ink/70',
                )}
            >
                <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                <span>Cliente</span>
            </button>
            <button
                type="button"
                role="tab"
                aria-selected={mode === 'internal'}
                title="Visível apenas para a equipe — o cliente não recebe."
                onClick={() => onChange('internal')}
                className={cn(
                    'relative flex h-9 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-all duration-200',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30',
                    mode === 'internal'
                        ? 'bg-red-600 text-white shadow-sm dark:bg-red-600 dark:text-white'
                        : 'text-ink/45 hover:bg-ink/[0.06] hover:text-ink/70',
                )}
            >
                <Shield className="h-3.5 w-3.5 shrink-0" />
                <span>Interna</span>
            </button>
        </div>
    );
}

function InternalComposerHeader() {
    return (
        <div
            className="rounded-xl border border-ink/[0.08] bg-ink/[0.04] p-1 dark:border-white/[0.06]"
            title="Visível apenas para a equipe — o cliente não recebe."
        >
            <div className="flex h-9 items-center justify-center gap-1.5 rounded-lg bg-red-600 px-3 text-xs font-semibold text-white shadow-sm dark:bg-red-600 dark:text-white">
                <Shield className="h-3.5 w-3.5 shrink-0" />
                <span>Mensagem interna</span>
            </div>
        </div>
    );
}

function InboxMessageBubble({
    message: m,
    isOptimistic,
    autoTranscribeAudio,
    isTranscribing,
    onTranscribe,
}: {
    message: Msg;
    isOptimistic?: boolean;
    autoTranscribeAudio: boolean;
    isTranscribing: boolean;
    onTranscribe: (id: number) => void;
}) {
    const role = messageRole(m);
    const roleMeta = MESSAGE_ROLE_META[role];
    const caption = mediaCaption(m.body, m.type);
    const align = role === 'client' ? 'start' : 'end';

    return (
        <ChatMessage
            align={align}
            variant={BUBBLE_VARIANT[role]}
            header={role === 'internal' ? m.sender?.name : undefined}
            headerInside={role === 'internal'}
            footerInside
            className={isOptimistic ? 'opacity-50' : undefined}
            footer={
                <div
                    className={cn(
                        'flex items-center gap-1 text-[10px]',
                        role === 'automation' || role === 'internal'
                            ? 'justify-between'
                            : 'justify-end',
                        roleMeta.metaText,
                    )}
                >
                    {role === 'automation' && (
                        <span className="flex items-center gap-1 opacity-70">
                            <Bot className="h-3 w-3 shrink-0" />
                            <span className="text-[9px] font-medium leading-none">
                                automação
                            </span>
                        </span>
                    )}
                    {role === 'internal' && (
                        <span className="flex items-center gap-1 opacity-70">
                            <Shield className="h-3 w-3 shrink-0" />
                            <span className="text-[9px] font-medium leading-none">
                                mensagem interna
                            </span>
                        </span>
                    )}
                    <div className="flex items-center gap-1">
                        {formatTime(m.created_at)}
                        {m.direction === 'out' &&
                            (m.status === 'sending' ? (
                                <Loader2 className={cn('h-3 w-3 animate-spin', roleMeta.tick)} />
                            ) : m.status === 'read' ? (
                                <CheckCheck className={cn('h-3 w-3', roleMeta.tickRead)} />
                            ) : m.status === 'delivered' ? (
                                <CheckCheck className={cn('h-3 w-3', roleMeta.tick)} />
                            ) : m.status === 'sent' || m.status === 'accepted' ? (
                                <Check className={cn('h-3 w-3', roleMeta.tick)} />
                            ) : null)}
                    </div>
                </div>
            }
        >
            {m.type === 'image' && m.media_url ? (
                <div className="space-y-2">
                    <a href={m.media_url} target="_blank" rel="noreferrer">
                        <img
                            src={m.media_url}
                            alt="Imagem recebida"
                            className="max-h-56 w-auto max-w-[280px] rounded-lg border border-ink/[0.10] bg-black/20 object-contain"
                            loading="lazy"
                        />
                    </a>
                    {caption && (
                        <p className="whitespace-pre-wrap break-words">{caption}</p>
                    )}
                </div>
            ) : m.type === 'video' && m.media_url ? (
                <div className="space-y-2">
                    <video
                        controls
                        preload="metadata"
                        src={m.media_url}
                        className="max-h-64 w-[300px] max-w-full rounded-md border bg-black/80"
                    />
                    {caption && (
                        <p className="whitespace-pre-wrap break-words">{caption}</p>
                    )}
                </div>
            ) : m.type === 'audio' && m.media_url ? (
                <div className="space-y-1.5">
                    <audio
                        controls
                        preload="metadata"
                        src={m.media_url}
                        className="h-10 w-[260px] max-w-full"
                    />
                    {m.transcription ? (
                        <p className="max-w-[260px] whitespace-pre-wrap break-words text-xs leading-relaxed opacity-80">
                            {m.transcription}
                        </p>
                    ) : isTranscribing ||
                      (autoTranscribeAudio &&
                          new Date(m.created_at ?? 0).getTime() > Date.now() - 120_000) ? (
                        <p className="text-[10px] opacity-40 italic">Transcrevendo…</p>
                    ) : !autoTranscribeAudio ? (
                        <button
                            type="button"
                            onClick={() => onTranscribe(m.id)}
                            className="inline-flex items-center gap-1 rounded-md border border-black/[0.12] bg-black/[0.05] px-2 py-1 text-[10px] font-medium opacity-70 transition hover:bg-black/[0.1] hover:opacity-100 dark:border-white/[0.12] dark:bg-white/[0.05] dark:hover:bg-white/[0.1]"
                        >
                            <Mic className="h-3 w-3" />
                            Transcrever
                        </button>
                    ) : null}
                    {caption && (
                        <p className="whitespace-pre-wrap break-words">{caption}</p>
                    )}
                </div>
            ) : m.type === 'document' && m.media_url ? (
                <div className="space-y-2">
                    <a
                        href={m.media_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-lg border border-black/[0.18] bg-black/[0.07] px-3 py-2 text-xs font-medium hover:bg-black/[0.12] dark:border-white/[0.18] dark:bg-white/[0.07] dark:hover:bg-white/[0.12]"
                    >
                        <FileText className="h-4 w-4" />
                        Abrir documento
                    </a>
                    {caption && (
                        <p className="whitespace-pre-wrap break-words">{caption}</p>
                    )}
                </div>
            ) : isMediaMessageType(m.type) ? (
                <div className="inline-flex items-center gap-2 rounded-lg border border-black/[0.12] bg-black/[0.05] px-3 py-2 text-xs opacity-60 dark:border-white/[0.12] dark:bg-white/[0.05]">
                    {m.type === 'image' ? (
                        <ImageIcon className="h-4 w-4" />
                    ) : m.type === 'video' ? (
                        <Video className="h-4 w-4" />
                    ) : m.type === 'audio' ? (
                        <Mic className="h-4 w-4" />
                    ) : (
                        <FileText className="h-4 w-4" />
                    )}
                    <span>
                        {m.type === 'image'
                            ? 'Imagem'
                            : m.type === 'video'
                              ? 'Vídeo'
                              : m.type === 'audio'
                                ? 'Áudio'
                                : caption ?? 'Documento'}
                    </span>
                </div>
            ) : (
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
            )}
        </ChatMessage>
    );
}

export default function InboxIndex({
    conversations,
    selected,
    filter,
    sort,
    sector_id,
    user_id,
    tag_id,
    sectors,
    users,
    tags,
    transfer_users,
    counts,
    auto_close_enabled,
    auto_close_minutes,
    quick_replies,
    has_ixc,
}: Props) {
    const { auth: { user: currentUser }, autoTranscribeAudio } = usePage<PageProps>().props;
    const { viewers: otherViewers, viewingLabel } = useInboxViewing(
        currentUser.id,
        selected?.id ?? null,
    );

    const attachmentInputRef = useRef<HTMLInputElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const analyserSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const analyserDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
    const analyserFrameRef = useRef<number | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const [attachmentName, setAttachmentName] = useState<string | null>(null);
    const [attachmentPreviewUrl, setAttachmentPreviewUrl] = useState<string | null>(null);
    const [attachmentDialogOpen, setAttachmentDialogOpen] = useState(false);
    const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
    const [closing, setClosing] = useState(false);
    const [forceCloseConfirmOpen, setForceCloseConfirmOpen] = useState(false);
    const [forceClosing, setForceClosing] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [transcribingIds, setTranscribingIds] = useState<Set<number>>(new Set());
    const [recordingWaveLevels, setRecordingWaveLevels] = useState<number[]>(
        RECORDING_WAVE_LEVELS_BASE,
    );
    const audioPreviewRef = useRef<HTMLAudioElement>(null);
    const composerTextareaRef = useRef<HTMLTextAreaElement>(null);
    const [recordingSeconds, setRecordingSeconds] = useState(0);
    const [isAudioPlaying, setIsAudioPlaying] = useState(false);
    const [audioDuration, setAudioDuration] = useState(0);
    const [audioCurrentTime, setAudioCurrentTime] = useState(0);
    const [snoozeOpen, setSnoozeOpen] = useState(false);
    const [snoozePreset, setSnoozePreset] = useState<SnoozePreset>('tomorrow_10');
    const [snoozeCustomDate, setSnoozeCustomDate] = useState<Date | undefined>(defaultCustomSnoozeDate);
    const [snoozeCustomTime, setSnoozeCustomTime] = useState(defaultCustomSnoozeTime);
    const [snoozeNote, setSnoozeNote] = useState('');
    const [snoozing, setSnoozing] = useState(false);
    const [waking, setWaking] = useState(false);
    const [transferOpen, setTransferOpen] = useState(false);
    const [transferMode, setTransferMode] = useState<'sector' | 'user'>('sector');
    const [transferSectorId, setTransferSectorId] = useState<string>('');
    const [transferUserId, setTransferUserId] = useState<string>('');
    const [transferring, setTransferring] = useState(false);
    const [ixcPanelOpen, setIxcPanelOpen] = useState(false);
    const [notesPanelOpen, setNotesPanelOpen] = useState(false);
    const [historyPanelOpen, setHistoryPanelOpen] = useState(false);
    const [ixcContact, setIxcContact] = useState<{
        ixc_customer_id: string | null;
        ixc_customer_name: string | null;
    } | null>(null);
    const [optimisticMessages, setOptimisticMessages] = useState<(Msg & { optimistic: true })[]>([]);
    const [realtimeMessages, setRealtimeMessages] = useState<Msg[]>([]);
    const [sendingMessage, setSendingMessage] = useState(false);
    const [liveTick, setLiveTick] = useState(0);
    const [slashMatches, setSlashMatches] = useState<QuickReply[]>([]);
    const [slashIndex, setSlashIndex] = useState(0);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [listSearch, setListSearch] = useState('');
    const emojiPickerRef = useRef<HTMLDivElement>(null);

    const filteredConversations = useMemo(
        () => conversations.filter((conversation) => matchesListSearch(conversation, listSearch)),
        [conversations, listSearch],
    );

    useEffect(() => {
        if (!showEmojiPicker) return;
        const handleOutsideClick = (e: MouseEvent) => {
            if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
                setShowEmojiPicker(false);
            }
        };
        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, [showEmojiPicker]);

    const appendMessage = useCallback((message: Msg) => {
        setRealtimeMessages((prev) => {
            if (prev.some((m) => m.id === message.id)) return prev;
            return [...prev, message];
        });
    }, []);

    const handleRealtimeMessage = useCallback(
        (payload: InboxRealtimeMessage) => {
            appendMessage(inboxMessageFromRealtime(payload));
        },
        [appendMessage],
    );

    useInboxRealtime({
        activeConversationId: selected?.id ?? null,
        onMessage: handleRealtimeMessage,
    });

    const displayMessages = useMemo(() => {
        const byId = new Map<number, Msg>();
        for (const m of selected?.messages ?? []) byId.set(m.id, m);
        for (const m of realtimeMessages) byId.set(m.id, m);
        for (const m of optimisticMessages) byId.set(m.id, m);
        return [...byId.values()].sort(
            (a, b) =>
                new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime(),
        );
    }, [selected?.messages, realtimeMessages, optimisticMessages]);

    useEffect(() => {
        if (!selected?.messages || transcribingIds.size === 0) return;

        const transcribedIds = new Set(
            selected.messages.filter((m) => m.transcription).map((m) => m.id),
        );

        setTranscribingIds((prev) => {
            const next = new Set([...prev].filter((id) => !transcribedIds.has(id)));
            return next.size === prev.size ? prev : next;
        });
    }, [selected?.messages, transcribingIds.size]);

    const transcribeMessage = async (messageId: number) => {
        setTranscribingIds((prev) => new Set(prev).add(messageId));

        try {
            await axios.post(route('inbox.messages.transcribe', messageId));
        } catch (error) {
            setTranscribingIds((prev) => {
                const next = new Set(prev);
                next.delete(messageId);
                return next;
            });
            const message = axios.isAxiosError(error)
                ? (error.response?.data?.message ?? 'Não foi possível transcrever o áudio.')
                : 'Não foi possível transcrever o áudio.';
            toast.error(message);
        }
    };

    // Limpa buffers locais ao trocar de conversa.
    useEffect(() => {
        setOptimisticMessages([]);
        setRealtimeMessages([]);
        if (selected) {
            setIxcContact({
                ixc_customer_id: selected.contact.ixc_customer_id ?? null,
                ixc_customer_name: selected.contact.ixc_customer_name ?? null,
            });
        } else {
            setIxcContact(null);
            setIxcPanelOpen(false);
            setHistoryPanelOpen(false);
        }
    }, [selected?.id]);

    // Remove mensagens realtime já refletidas no servidor.
    useEffect(() => {
        if (!selected?.messages || realtimeMessages.length === 0) return;

        const serverIds = new Set(selected.messages.map((m) => m.id));
        setRealtimeMessages((prev) => prev.filter((m) => !serverIds.has(m.id)));
    }, [selected?.messages, realtimeMessages.length]);

    // Remove otimistas que o servidor já confirmou (evita duplicatas ao enviar várias mensagens seguidas).
    useEffect(() => {
        if (optimisticMessages.length === 0) return;

        const confirmed = [...(selected?.messages ?? []), ...realtimeMessages];
        const realCounts = new Map<string, number>();

        for (const m of confirmed) {
            if (m.direction !== 'out') continue;
            const key = messageDedupKey(m);
            realCounts.set(key, (realCounts.get(key) ?? 0) + 1);
        }

        setOptimisticMessages((prev) => {
            const counts = new Map(realCounts);
            return prev.filter((m) => {
                const key = messageDedupKey(m);
                const available = counts.get(key) ?? 0;
                if (available > 0) {
                    counts.set(key, available - 1);
                    return false;
                }
                return true;
            });
        });
    }, [selected?.messages, realtimeMessages, optimisticMessages.length]);

    // Calcula quando o timer expira direto dos props (sem armazenar em estado).
    const inactivityExpiresAt = useMemo(() => {
        if (!auto_close_enabled || !selected || selected.status !== 'open' || !selected.last_message_at) return null;
        const lastMsg = displayMessages.at(-1);
        if (!lastMsg || lastMsg.direction !== 'out' || lastMsg.status === 'failed') return null;
        return new Date(selected.last_message_at).getTime() + auto_close_minutes * 60 * 1000;
    }, [auto_close_enabled, auto_close_minutes, selected?.id, selected?.status, selected?.last_message_at, displayMessages]);

    // Tick a cada segundo enquanto há timer ativo (conversa selecionada ou lista com conversas abertas).
    const hasOpenInList = auto_close_enabled && conversations.some(c => c.status === 'open');
    const hasQueuedSlaInList = conversations.some((c) => c.sla !== null);
    const hasSelectedSla = selected?.sla !== null;

    const needsLiveTick =
        inactivityExpiresAt !== null
        || hasOpenInList
        || hasQueuedSlaInList
        || hasSelectedSla;

    useEffect(() => {
        if (!needsLiveTick) return;
        const interval = setInterval(() => setLiveTick((t) => t + 1), 1000);
        return () => clearInterval(interval);
    }, [needsLiveTick]);

    // Valor derivado: calculado no render, sem lag de estado.
    // inactivityTick força re-render a cada segundo; inactivityExpiresAt vem direto dos props.
    const inactivityCountdown = inactivityExpiresAt !== null
        ? Math.max(0, Math.floor((inactivityExpiresAt - Date.now()) / 1000))
        : null;

    // Encerra automaticamente quando o contador de inatividade chega a zero.
    const autoClosedRef = useRef<number | null>(null);
    useEffect(() => {
        if (
            inactivityCountdown === 0 &&
            selected &&
            selected.status === 'open' &&
            selected.can_act &&
            autoClosedRef.current !== selected.id
        ) {
            autoClosedRef.current = selected.id;
            router.post(
                route('inbox.close', selected.id),
                { auto_close: true },
                { preserveScroll: true, preserveState: true },
            );
        }
    }, [liveTick, inactivityExpiresAt, selected?.id, selected?.status, selected?.can_act]);

    const selectConversation = (id: number) => {
        router.get(
            route('inbox.show', id),
            {},
            { preserveState: true, preserveScroll: true },
        );
    };

    const deselectConversation = () => {
        router.get(
            route('inbox.index'),
            {
                filter,
                sort,
                ...(sector_id ? { sector_id } : {}),
                ...(user_id ? { user_id } : {}),
                ...(tag_id ? { tag_id } : {}),
            },
            { preserveState: true, preserveScroll: true },
        );
    };

    const changeFilter = (f: string) => {
        router.get(
            route('inbox.index'),
            {
                filter: f,
                sort,
                ...(sector_id ? { sector_id } : {}),
                ...(user_id ? { user_id } : {}),
                ...(selected ? { conversation: selected.id } : {}),
            },
            { preserveState: true, preserveScroll: true },
        );
    };

    const changeSector = (sid: string) => {
        router.get(
            route('inbox.index'),
            {
                filter,
                sort,
                sector_id: sid === 'all' ? undefined : sid,
                ...(user_id ? { user_id } : {}),
                ...(selected ? { conversation: selected.id } : {}),
            },
            { preserveState: true, preserveScroll: true },
        );
    };

    const changeUser = (uid: string) => {
        router.get(
            route('inbox.index'),
            {
                filter,
                sort,
                ...(sector_id ? { sector_id } : {}),
                user_id: uid === 'all' ? undefined : uid,
                ...(selected ? { conversation: selected.id } : {}),
            },
            { preserveState: true, preserveScroll: true },
        );
    };

    const changeSort = () => {
        const next = sort === 'newest' ? 'oldest' : 'newest';
        router.get(
            route('inbox.index'),
            {
                filter,
                sort: next,
                ...(sector_id ? { sector_id } : {}),
                ...(user_id ? { user_id } : {}),
                ...(tag_id ? { tag_id } : {}),
                ...(selected ? { conversation: selected.id } : {}),
            },
            { preserveState: true, preserveScroll: true },
        );
    };

    const changeTag = (tid: string) => {
        router.get(
            route('inbox.index'),
            {
                filter,
                sort,
                ...(sector_id ? { sector_id } : {}),
                ...(user_id ? { user_id } : {}),
                ...(tid !== 'all' ? { tag_id: tid } : {}),
                ...(selected ? { conversation: selected.id } : {}),
            },
            { preserveState: true, preserveScroll: true },
        );
    };

    const toggleTag = (tagId: number) => {
        if (!selected) return;
        const currentIds = (selected.tags ?? []).map((t) => t.id);
        const newIds = currentIds.includes(tagId)
            ? currentIds.filter((id) => id !== tagId)
            : [...currentIds, tagId];
        router.put(
            route('inbox.conversations.tags', selected.id),
            { tag_ids: newIds },
            { preserveState: true, preserveScroll: true, only: ['conversations', 'selected'] },
        );
    };

    const composer = useForm<{ body: string; attachment: File | null; audio: File | null }>({
        body: '',
        attachment: null,
        audio: null,
    });
    const internalComposer = useForm<{ body: string }>({ body: '' });
    const [composerMode, setComposerMode] = useState<'client' | 'internal'>('client');

    useEffect(() => {
        setComposerMode('client');
        internalComposer.reset();
    }, [selected?.id]);

    const stopRecorderTracks = () => {
        mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
    };

    const stopRecordingWaves = () => {
        if (analyserFrameRef.current !== null) {
            cancelAnimationFrame(analyserFrameRef.current);
            analyserFrameRef.current = null;
        }

        analyserSourceRef.current?.disconnect();
        analyserSourceRef.current = null;

        analyserRef.current?.disconnect();
        analyserRef.current = null;
        analyserDataRef.current = null;

        audioContextRef.current?.close();
        audioContextRef.current = null;

        setRecordingWaveLevels(RECORDING_WAVE_LEVELS_BASE);
    };

    const startRecordingWaves = (stream: MediaStream) => {
        if (typeof window === 'undefined') return;

        const AudioContextConstructor = (
            window.AudioContext ||
            (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        );

        if (!AudioContextConstructor) return;

        stopRecordingWaves();

        const context = new AudioContextConstructor();
        const analyser = context.createAnalyser();
        const source = context.createMediaStreamSource(stream);

        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.78;

        source.connect(analyser);

        audioContextRef.current = context;
        analyserRef.current = analyser;
        analyserSourceRef.current = source;
        analyserDataRef.current = new Uint8Array(analyser.frequencyBinCount);

        const draw = () => {
            const currentAnalyser = analyserRef.current;
            const frequencyData = analyserDataRef.current;

            if (!currentAnalyser || !frequencyData) {
                analyserFrameRef.current = null;
                return;
            }

            currentAnalyser.getByteFrequencyData(frequencyData);

            const levels = Array.from({ length: RECORDING_WAVE_BARS }, (_, index) => {
                const start = Math.floor((index * frequencyData.length) / RECORDING_WAVE_BARS);
                const end = Math.floor(((index + 1) * frequencyData.length) / RECORDING_WAVE_BARS);
                const chunk = frequencyData.slice(start, Math.max(start + 1, end));
                const avg =
                    chunk.reduce((sum, value) => sum + value, 0) / Math.max(1, chunk.length);
                const normalized = Math.pow(avg / 255, 0.85);
                const floor = 0.14;
                return Math.min(1, floor + normalized * 0.86);
            });

            setRecordingWaveLevels(levels);
            analyserFrameRef.current = requestAnimationFrame(draw);
        };

        if (context.state === 'suspended') {
            void context.resume();
        }

        analyserFrameRef.current = requestAnimationFrame(draw);
    };

    const clearAttachment = () => {
        if (attachmentPreviewUrl) {
            URL.revokeObjectURL(attachmentPreviewUrl);
            setAttachmentPreviewUrl(null);
        }
        setUploadProgress(null);
        setAttachmentDialogOpen(false);
        composer.setData('attachment', null);
        setAttachmentName(null);
        if (attachmentInputRef.current) {
            attachmentInputRef.current.value = '';
        }
    };

    const clearAudio = () => {
        if (audioPreviewRef.current) {
            audioPreviewRef.current.pause();
        }
        setIsAudioPlaying(false);
        setAudioCurrentTime(0);
        setAudioDuration(0);
        composer.setData('audio', null);
        setAudioPreviewUrl((current) => {
            if (current) {
                URL.revokeObjectURL(current);
            }

            return null;
        });
    };

    const toggleAudioPlayback = () => {
        const el = audioPreviewRef.current;
        if (!el) return;
        if (isAudioPlaying) {
            el.pause();
            setIsAudioPlaying(false);
        } else {
            el.play();
            setIsAudioPlaying(true);
        }
    };

    const resetComposerMedia = () => {
        clearAttachment();
        clearAudio();
    };

    const onAttachmentChange = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0] ?? null;
        if (!file) return;
        if (attachmentPreviewUrl) URL.revokeObjectURL(attachmentPreviewUrl);
        composer.setData('attachment', file);
        setAttachmentName(file.name);
        setAttachmentPreviewUrl(file.type.startsWith('image/') ? URL.createObjectURL(file) : null);
        setAttachmentDialogOpen(true);
        clearAudio();
    };

    const startRecording = async () => {
        if (isRecording || !window.MediaRecorder || !navigator.mediaDevices?.getUserMedia) {
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const preferredMimeTypes = [
                'audio/ogg;codecs=opus',
                'audio/ogg',
                'audio/webm;codecs=opus',
                'audio/webm',
                'audio/mp4',
            ];
            const mimeType = preferredMimeTypes.find((value) => MediaRecorder.isTypeSupported(value));
            const recorder = mimeType
                ? new MediaRecorder(stream, { mimeType })
                : new MediaRecorder(stream);

            audioChunksRef.current = [];
            mediaRecorderRef.current = recorder;
            mediaStreamRef.current = stream;
            startRecordingWaves(stream);
            clearAudio();
            composer.setData('attachment', null);
            setAttachmentName(null);
            if (attachmentInputRef.current) {
                attachmentInputRef.current.value = '';
            }

            recorder.ondataavailable = (eventData) => {
                if (eventData.data.size > 0) {
                    audioChunksRef.current.push(eventData.data);
                }
            };

            recorder.onstop = () => {
                const chunks = audioChunksRef.current;
                audioChunksRef.current = [];

                if (chunks.length > 0) {
                    const blob = new Blob(chunks, {
                        type: recorder.mimeType || 'audio/ogg',
                    });
                    let extension = 'ogg';
                    if (blob.type.includes('webm')) extension = 'webm';
                    if (blob.type.includes('mp4')) extension = 'm4a';
                    if (blob.type.includes('mpeg')) extension = 'mp3';
                    if (blob.type.includes('wav')) extension = 'wav';
                    const file = new File([blob], `audio-${Date.now()}.${extension}`, {
                        type: blob.type || 'audio/ogg',
                    });
                    composer.setData('audio', file);
                    setAudioPreviewUrl((current) => {
                        if (current) {
                            URL.revokeObjectURL(current);
                        }

                        return URL.createObjectURL(blob);
                    });
                }

                stopRecorderTracks();
                stopRecordingWaves();
                setIsRecording(false);
            };

            setRecordingSeconds(0);
            recorder.start();
            setIsRecording(true);
        } catch {
            stopRecordingWaves();
            stopRecorderTracks();
            setIsRecording(false);
        }
    };

    const stopRecording = () => {
        const recorder = mediaRecorderRef.current;
        if (recorder && recorder.state === 'recording') {
            recorder.stop();
        }
    };

    useEffect(() => {
        return () => {
            stopRecording();
            stopRecordingWaves();
            stopRecorderTracks();
            setAudioPreviewUrl((current) => {
                if (current) {
                    URL.revokeObjectURL(current);
                }

                return null;
            });
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!isRecording) {
            stopRecordingWaves();
        }
    }, [isRecording]);

    useEffect(() => {
        if (!isRecording) return;
        const interval = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
        return () => clearInterval(interval);
    }, [isRecording]);

    useEffect(() => {
        const el = composerTextareaRef.current;
        if (!el) return;
        if (!composer.data.body) {
            el.style.height = '';
        } else {
            el.style.height = 'auto';
            el.style.height = el.scrollHeight + 'px';
        }
    }, [composer.data.body]);

    const extractAxiosError = (error: unknown, fallback: string): string => {
        if (!axios.isAxiosError(error)) return fallback;
        const data = error.response?.data as Record<string, unknown> | undefined;
        if (typeof data?.message === 'string') return data.message;
        const errors = data?.errors as Record<string, string[]> | undefined;
        if (errors) {
            const first = Object.values(errors).flat().find((v) => typeof v === 'string' && v.length > 0);
            if (first) return first;
        }
        return fallback;
    };

    const submitMessage = async () => {
        if (
            !selected ||
            (!composer.data.body.trim() &&
                !composer.data.attachment &&
                !composer.data.audio)
        ) {
            return;
        }

        if (!selected.can_act) {
            composer.setError('body', 'Conversa atribuída a outro atendente.');
            return;
        }

        const optimisticId = -Date.now();
        const originalBody = composer.data.body;
        const isTextOnly = Boolean(originalBody.trim() && !composer.data.attachment && !composer.data.audio);

        if (!isTextOnly) setUploadProgress(0);
        if (isTextOnly) {
            setOptimisticMessages((prev) => [
                ...prev,
                {
                    id: optimisticId,
                    direction: 'out',
                    type: 'text',
                    body: originalBody,
                    media_url: null,
                    status: 'sending',
                    sender: { id: currentUser.id, name: currentUser.name },
                    created_at: new Date().toISOString(),
                    optimistic: true,
                },
            ]);
            composer.setData('body', '');
        }

        const formData = new FormData();
        if (composer.data.body.trim()) formData.append('body', composer.data.body);
        if (composer.data.attachment) formData.append('attachment', composer.data.attachment);
        if (composer.data.audio) formData.append('audio', composer.data.audio);

        setSendingMessage(true);
        try {
            const { data } = await axios.post<Msg>(route('inbox.messages.store', selected.id), formData, {
                headers: { Accept: 'application/json' },
                onUploadProgress: (progress) => {
                    if (progress.total) {
                        setUploadProgress(Math.round((progress.loaded / progress.total) * 100));
                    }
                },
            });
            appendMessage(data);
            composer.reset('body', 'attachment', 'audio');
            resetComposerMedia();
            router.reload({ only: ['conversations', 'counts'] });
        } catch (error) {
            setOptimisticMessages((prev) => prev.filter((m) => m.id !== optimisticId));
            if (isTextOnly) composer.setData('body', originalBody);
            const permissionMessage = 'Conversa atribuída a outro atendente.';
            const message = extractAxiosError(error, 'Falha ao enviar mensagem.');
            if (message === permissionMessage) {
                toast.error(permissionMessage);
            } else {
                toast.error(message);
            }
        } finally {
            setUploadProgress(null);
            setSendingMessage(false);
        }
    };

    const send = (e: SyntheticEvent) => {
        e.preventDefault();
        if (composerMode === 'internal') {
            void submitInternalMessage();
            return;
        }
        void submitMessage();
    };

    const submitInternalMessage = async () => {
        if (!selected || !internalComposer.data.body.trim()) {
            return;
        }

        const optimisticId = -Date.now();
        const originalBody = internalComposer.data.body;

        setOptimisticMessages((prev) => [
            ...prev,
            {
                id: optimisticId,
                direction: 'out',
                type: 'text',
                body: originalBody,
                media_url: null,
                status: 'accepted',
                is_internal: true,
                sender: { id: currentUser.id, name: currentUser.name },
                created_at: new Date().toISOString(),
                optimistic: true,
            },
        ]);
        internalComposer.setData('body', '');

        setSendingMessage(true);
        try {
            const { data } = await axios.post<Msg>(
                route('inbox.internal-messages.store', selected.id),
                { body: originalBody },
                { headers: { Accept: 'application/json' } },
            );
            appendMessage(data);
            internalComposer.reset('body');
            router.reload({ only: ['conversations', 'counts'] });
        } catch (error) {
            setOptimisticMessages((prev) => prev.filter((m) => m.id !== optimisticId));
            internalComposer.setData('body', originalBody);
            toast.error(extractAxiosError(error, 'Falha ao enviar mensagem interna.'));
        } finally {
            setSendingMessage(false);
        }
    };

    const action = (name: string) => {
        if (!selected) return;

        if (name === 'inbox.assign' && !selected.can_assign) {
            toast.error('Conversa atribuída a outro atendente.');
            return;
        }

        if (name === 'inbox.close' && !selected.can_act) {
            toast.error('Conversa atribuída a outro atendente.');
            return;
        }

        if (name === 'inbox.close') setClosing(true);

        router.post(
            route(name, selected.id),
            {},
            {
                preserveScroll: true,
                preserveState: true,
                onFinish: () => {
                    if (name === 'inbox.close') {
                        setClosing(false);
                        setCloseConfirmOpen(false);
                    }
                },
            },
        );
    };

    const openTransferDialog = () => {
        setTransferMode(sectors.length > 0 ? 'sector' : 'user');
        setTransferSectorId(selected?.sector?.id?.toString() ?? '');
        setTransferUserId('');
        setTransferOpen(true);
    };

    const openSnoozeDialog = () => {
        const defaultDate = defaultCustomSnoozeDate();
        setSnoozePreset('tomorrow_10');
        setSnoozeCustomDate(defaultDate);
        setSnoozeCustomTime(defaultCustomSnoozeTime(defaultDate));
        setSnoozeNote('');
        setSnoozeOpen(true);
    };

    const submitSnooze = () => {
        if (!selected) return;
        const snoozedUntil = snoozeUntilFromPreset(
            snoozePreset,
            snoozePreset === 'custom'
                ? { date: snoozeCustomDate!, time: snoozeCustomTime }
                : undefined,
        );
        if (!snoozedUntil) {
            toast.error('Escolha uma data e hora válidas (mínimo 5 minutos no futuro).');
            return;
        }

        setSnoozing(true);
        router.post(
            route('inbox.snooze', selected.id),
            {
                snoozed_until: snoozedUntil,
                note: snoozeNote.trim() || null,
            },
            {
                preserveScroll: true,
                preserveState: true,
                onSuccess: () => setSnoozeOpen(false),
                onFinish: () => setSnoozing(false),
            },
        );
    };

    const wakeConversation = () => {
        if (!selected) return;
        setWaking(true);
        router.post(route('inbox.wake', selected.id), {}, {
            preserveScroll: true,
            preserveState: true,
            onFinish: () => setWaking(false),
        });
    };

    const submitTransfer = () => {
        if (!selected) return;
        const payload =
            transferMode === 'user'
                ? { user_id: transferUserId }
                : { sector_id: transferSectorId };
        if (!payload.user_id && !payload.sector_id) return;
        setTransferring(true);
        router.post(route('inbox.transfer', selected.id), payload, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => {
                setTransferOpen(false);
                setTransferSectorId('');
                setTransferUserId('');
            },
            onFinish: () => setTransferring(false),
        });
    };

    const insertEmoji = (emojiData: EmojiClickData) => {
        const el = composerTextareaRef.current;
        const emoji = emojiData.emoji;
        if (!el) {
            composer.setData('body', composer.data.body + emoji);
            return;
        }
        const start = el.selectionStart ?? composer.data.body.length;
        const end = el.selectionEnd ?? composer.data.body.length;
        const newBody = composer.data.body.slice(0, start) + emoji + composer.data.body.slice(end);
        composer.setData('body', newBody);
        requestAnimationFrame(() => {
            el.focus();
            el.setSelectionRange(start + emoji.length, start + emoji.length);
        });
    };

    const hasTypedBody = composer.data.body.trim().length > 0;
    const hasPendingMedia = Boolean(composer.data.attachment || composer.data.audio);
    const canSubmit = hasTypedBody || hasPendingMedia;
    const canAssignSelected = Boolean(selected?.can_assign);
    const canActSelected = Boolean(selected?.can_act);
    const canSendInternalSelected = Boolean(selected?.can_send_internal);
    const canTransferSelected = Boolean(selected?.can_transfer);
    const canForceCloseSelected = Boolean(selected?.can_force_close);
    const canSnoozeSelected = Boolean(selected?.can_snooze);
    const canWakeSelected = Boolean(selected?.can_wake);
    const isAssignedToCurrentUser = selected?.assigned_user_id === currentUser.id;
    const composerErrors = composer.errors as Record<string, string | undefined>;
    const internalComposerErrors = internalComposer.errors as Record<string, string | undefined>;
    const showComposerToggle = canActSelected && canSendInternalSelected;
    const isInternalComposerMode =
        canSendInternalSelected && (!canActSelected || composerMode === 'internal');
    const isClientComposerMode = canActSelected && !isInternalComposerMode;

    const isManager = currentUser.role === 'admin' || currentUser.role === 'gestor';
    const filters = [
        ...(isManager
            ? [{ key: 'all', label: 'Todas', title: 'Todas as conversas', Icon: MessageSquare }]
            : []),
        { key: 'mine', label: 'Minhas', title: 'Minhas conversas', count: counts.mine, Icon: UserCheck },
        { key: 'snoozed', label: 'Adiadas', title: 'Conversas adiadas', count: counts.snoozed, Icon: AlarmClock },
        { key: 'bot', label: 'Auto', title: 'Conversas em automação', count: counts.bot, Icon: Bot },
        { key: 'queued', label: 'Fila', title: 'Conversas na fila', count: counts.queued, Icon: Clock },
    ];
    const hasDropdownFilters =
        sectors.length > 0 || users.length > 0 || tags.length > 0;
    const dropdownFilterCount = [
        sectors.length > 0,
        users.length > 0,
        tags.length > 0,
    ].filter(Boolean).length;

    return (
        <AuthenticatedLayout
            header={
                <h2>
                    Atendimento
                </h2>
            }
        >
            <Head title="Atendimento" />

            <div className="flex-1 min-h-0 grid grid-cols-1 overflow-hidden md:grid-cols-[340px_1fr]">
                        {/* Lista de conversas */}
                        <div className={cn(
                            "relative flex min-h-0 flex-col border-r border-accent/10",
                            selected && "hidden md:flex",
                        )}>
                            <div className="scrollbar-thin flex-1 overflow-y-auto">
                                <div className="sticky top-0 z-10 border-b border-accent/10 bg-canvas px-2 py-2">
                                    <div className="space-y-2 rounded-xl border border-accent/10 bg-canvas/50 p-2 dark:bg-ink/[0.02]">
                                        <div
                                            className={cn(
                                                'grid gap-0.5 rounded-lg bg-ink/[0.04] p-0.5',
                                                isManager ? 'grid-cols-5' : 'grid-cols-4',
                                            )}
                                            role="tablist"
                                            aria-label="Visualização das conversas"
                                        >
                                            {filters.map((f) => {
                                                const active = filter === f.key;

                                                return (
                                                    <button
                                                        key={f.key}
                                                        type="button"
                                                        role="tab"
                                                        aria-selected={active}
                                                        title={f.title}
                                                        onClick={() => changeFilter(f.key)}
                                                        className={cn(
                                                            'relative flex h-8 min-w-0 items-center justify-center gap-1 rounded-md text-[10px] font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30',
                                                            active
                                                                ? 'bg-canvas text-accent shadow-sm dark:bg-ink/[0.10]'
                                                                : 'text-ink/45 hover:text-ink/70',
                                                        )}
                                                    >
                                                        <f.Icon className="h-3.5 w-3.5 shrink-0" />
                                                        <span className="truncate">{f.label}</span>
                                                        {Boolean(f.count) && (
                                                            <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-accent px-0.5 text-[8px] font-bold leading-none text-canvas dark:text-black">
                                                                {f.count}
                                                            </span>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        <div className="relative">
                                            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/35" />
                                            <Input
                                                value={listSearch}
                                                onChange={(e) => setListSearch(e.target.value)}
                                                placeholder="Buscar conversas..."
                                                aria-label="Buscar conversas"
                                                className="h-8 rounded-lg border-transparent bg-ink/[0.04] pl-8 pr-8 text-xs shadow-none placeholder:text-ink/40 focus-visible:border-accent/30 focus-visible:bg-canvas focus-visible:ring-1 focus-visible:ring-accent/25"
                                            />
                                            {listSearch !== '' && (
                                                <button
                                                    type="button"
                                                    onClick={() => setListSearch('')}
                                                    aria-label="Limpar busca"
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-ink/35 transition-colors hover:bg-ink/[0.06] hover:text-ink/70"
                                                >
                                                    <X className="h-3.5 w-3.5" />
                                                </button>
                                            )}
                                        </div>

                                        {hasDropdownFilters && (
                                        <div
                                            className={cn(
                                                'grid gap-1',
                                                dropdownFilterCount === 3 && 'grid-cols-3',
                                                dropdownFilterCount === 2 && 'grid-cols-2',
                                                dropdownFilterCount === 1 && 'grid-cols-1',
                                            )}
                                        >
                                    {sectors.length > 0 && (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <button className={inboxFilterTriggerClass(!!sector_id)}>
                                                    <Building2 className="h-3 w-3 shrink-0 opacity-70" />
                                                    <span className="min-w-0 truncate">
                                                        {sector_id ? (sectors.find(s => s.id === sector_id)?.name ?? 'Setor') : 'Setor'}
                                                    </span>
                                                    <ChevronDown className="h-3 w-3 shrink-0 opacity-40" />
                                                </button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="start" className="min-w-[160px]">
                                                <DropdownMenuItem onClick={() => changeSector('all')}>
                                                    <span className={cn('w-full', !sector_id && 'font-semibold text-accent')}>Todos os setores</span>
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                {sectors.map(s => (
                                                    <DropdownMenuItem key={s.id} onClick={() => changeSector(s.id.toString())}>
                                                        <span className={cn('w-full', sector_id === s.id && 'font-semibold text-accent')}>{s.name}</span>
                                                    </DropdownMenuItem>
                                                ))}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    )}
                                    {users.length > 0 && (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <button className={inboxFilterTriggerClass(!!user_id)}>
                                                    <UserRound className="h-3 w-3 shrink-0 opacity-70" />
                                                    <span className="min-w-0 truncate">
                                                        {user_id ? (users.find(u => u.id === user_id)?.name ?? 'Atendente') : 'Atendente'}
                                                    </span>
                                                    <ChevronDown className="h-3 w-3 shrink-0 opacity-40" />
                                                </button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="start" className="min-w-[160px]">
                                                <DropdownMenuItem onClick={() => changeUser('all')}>
                                                    <span className={cn('w-full', !user_id && 'font-semibold text-accent')}>Todos os atendentes</span>
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                {users.map(u => (
                                                    <DropdownMenuItem key={u.id} onClick={() => changeUser(u.id.toString())}>
                                                        <span className={cn('w-full', user_id === u.id && 'font-semibold text-accent')}>{u.name}</span>
                                                    </DropdownMenuItem>
                                                ))}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    )}
                                    {tags.length > 0 && (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <button className={inboxFilterTriggerClass(!!tag_id)}>
                                                    <TagIcon className="h-3 w-3 shrink-0 opacity-70" />
                                                    <span className="min-w-0 truncate">
                                                        {tag_id ? (tags.find(t => t.id === tag_id)?.name ?? 'Etiqueta') : 'Etiqueta'}
                                                    </span>
                                                    <ChevronDown className="h-3 w-3 shrink-0 opacity-40" />
                                                </button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="start" className="min-w-[160px]">
                                                <DropdownMenuItem onClick={() => changeTag('all')}>
                                                    <span className={cn('w-full', !tag_id && 'font-semibold text-accent')}>Todas as etiquetas</span>
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                {tags.map(t => (
                                                    <DropdownMenuItem key={t.id} onClick={() => changeTag(t.id.toString())}>
                                                        <span className={cn('w-full', tag_id === t.id && 'font-semibold text-accent')}>{t.name}</span>
                                                    </DropdownMenuItem>
                                                ))}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    )}
                                        </div>
                                        )}
                                    </div>
                                </div>
                                {conversations.length === 0 && (
                                    <div className="flex min-h-[280px] flex-col items-center justify-center px-6 py-10 text-center">
                                        <div className="relative mb-5 h-20 w-20">
                                            <div className="absolute inset-0 rounded-2xl border border-accent/20 bg-accent/10 shadow-sm" />
                                            <div className="absolute inset-2 flex items-center justify-center rounded-2xl border border-white/60 bg-canvas text-accent shadow-[0_12px_28px_rgba(15,23,42,0.08)]">
                                                <MessageSquare className="h-8 w-8" />
                                            </div>
                                            <div className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full border border-accent/20 bg-canvas text-accent shadow-sm">
                                                <Bot className="h-4 w-4" />
                                            </div>
                                            <div className="absolute -bottom-1 -left-2 flex h-7 w-7 items-center justify-center rounded-full border border-accent/10 bg-canvas text-ink/50 shadow-sm">
                                                <UserRound className="h-3.5 w-3.5" />
                                            </div>
                                        </div>

                                        <div className="max-w-[230px]">
                                            <p className="text-sm font-semibold text-ink/78">
                                                Nenhuma conversa por aqui
                                            </p>
                                            <p className="mt-1.5 text-xs leading-5 text-ink/45">
                                                Novas mensagens deste filtro aparecem nesta lista assim que chegarem.
                                            </p>
                                        </div>

                                        <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-accent/10 bg-ink/[0.03] px-3 py-1.5 text-[11px] font-medium text-ink/45">
                                            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                                            Aguardando mensagens
                                        </div>
                                    </div>
                                )}
                                {conversations.length > 0 && filteredConversations.length === 0 && (
                                    <div className="flex min-h-[200px] flex-col items-center justify-center px-6 py-10 text-center">
                                        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-accent/15 bg-accent/10 text-accent">
                                            <Search className="h-4 w-4" />
                                        </div>
                                        <p className="text-sm font-medium text-ink/70">
                                            Nenhuma conversa encontrada
                                        </p>
                                        <p className="mt-1 max-w-[220px] text-xs leading-5 text-ink/45">
                                            Tente outro nome, telefone ou trecho da última mensagem.
                                        </p>
                                    </div>
                                )}
                                {filteredConversations.map((c) => {
                                    void liveTick;
                                    const preview = mediaPreview(c);
                                    const PreviewIcon = preview?.icon;
                                    const contactName = conversationDisplayName(c);
                                    const convExpiresAt =
                                        auto_close_enabled && c.status === 'open' && c.last_message_at && c.last_message_direction === 'out'
                                            ? new Date(c.last_message_at).getTime() + auto_close_minutes * 60 * 1000
                                            : null;
                                    const convCountdown =
                                        convExpiresAt !== null
                                            ? Math.max(0, Math.floor((convExpiresAt - Date.now()) / 1000))
                                            : null;
                                    const liveSla = c.sla ? computeLiveSla(c.sla) : null;
                                    const slaRowClass = liveSla ? SLA_STATUS_META[liveSla.status].rowClass : '';

                                    const isSelected = selected?.id === c.id;
                                    const unread = isSelected ? 0 : c.unread_count;

                                    return (
                                        <button
                                            key={c.id}
                                            onClick={() => selectConversation(c.id)}
                                            className={cn(
                                                'group relative w-full border-b border-l-[3px] border-accent/5 px-4 py-3 text-left text-ink transition hover:bg-ink/[0.04]',
                                                slaRowClass || 'border-l-transparent',
                                                isSelected ? 'bg-accent/10' : 'hover:bg-ink/[0.04]',
                                            )}
                                        >
                                            {isSelected && (
                                                <span className="absolute inset-y-0 left-0 z-10 w-[3px] rounded-r-full bg-accent" />
                                            )}
                                            <div className="flex items-start gap-3">
                                                <div className="relative mt-0.5 shrink-0">
                                                <div className={cn("h-10 w-10 overflow-hidden rounded-full transition-colors", isSelected ? "bg-accent shadow-sm shadow-accent/30" : "border border-accent/25 bg-accent/10")}>
                                                {c.contact.avatar_url ? (
                                                    <img
                                                        src={c.contact.avatar_url}
                                                        alt={contactName}
                                                        className="h-full w-full object-cover"
                                                        loading="lazy"
                                                    />
                                                ) : (
                                                    <div className={cn("flex h-full w-full items-center justify-center text-xs font-semibold", isSelected ? "text-canvas" : "text-accent")}>
                                                        {initials(contactName)}
                                                    </div>
                                                )}
                                                </div>
                                                <span
                                                    className={cn(
                                                        "absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full ring-2 ring-canvas",
                                                        c.channel_type === 'telegram'
                                                            ? "bg-blue-500 text-white"
                                                            : c.channel_type === 'web'
                                                            ? "bg-violet-500 text-white"
                                                            : "bg-green-500 text-white",
                                                    )}
                                                    title={c.channel_name ?? (c.channel_type === 'telegram' ? 'Telegram' : c.channel_type === 'web' ? 'Chat Web' : 'WhatsApp')}
                                                >
                                                    {c.channel_type === 'telegram' ? (
                                                        <TelegramIcon className="h-2.5 w-2.5" />
                                                    ) : c.channel_type === 'web' ? (
                                                        <WebIcon className="h-2.5 w-2.5" />
                                                    ) : (
                                                        <WhatsAppIcon className="h-2.5 w-2.5" />
                                                    )}
                                                </span>
                                            </div>

                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center justify-between gap-3">
                                                    <span className={cn("truncate font-medium", unread > 0 && "font-semibold")}>
                                                        {contactName}
                                                    </span>
                                                    <div className="flex shrink-0 items-center gap-1.5">
                                                        {c.sla ? (
                                                            <SlaIndicator sla={c.sla} variant="compact" />
                                                        ) : convCountdown !== null ? (
                                                            <span
                                                                className={cn(
                                                                    'inline-flex items-center gap-1 text-xs font-medium',
                                                                    convCountdown <= 120
                                                                        ? 'text-red-500 dark:text-red-400'
                                                                        : 'text-amber-600 dark:text-amber-400',
                                                                )}
                                                                title="Tempo restante para encerramento automático por inatividade"
                                                            >
                                                                <Clock className="h-3 w-3" />
                                                                {formatCountdown(convCountdown)}
                                                            </span>
                                                        ) : (
                                                            <span className={cn("text-xs", unread > 0 ? "font-semibold text-green-600 dark:text-green-400" : "text-ink/40")}>
                                                                {formatTime(c.last_message_at)}
                                                            </span>
                                                        )}
                                                        {unread > 0 && (
                                                            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-green-500 px-1.5 text-[10px] font-bold text-white dark:bg-green-600 dark:text-black">
                                                                {unread > 99 ? '99+' : unread}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1 overflow-hidden text-sm text-ink/48">
                                                    {c.last_message_direction === 'out' && (() => {
                                                        const s = c.last_message_status;
                                                        if (s === 'read') return <CheckCheck className="h-3.5 w-3.5 shrink-0 text-blue-500" />;
                                                        if (s === 'delivered') return <CheckCheck className="h-3.5 w-3.5 shrink-0 text-ink/40" />;
                                                        if (s === 'sent' || s === 'accepted') return <Check className="h-3.5 w-3.5 shrink-0 text-ink/40" />;
                                                        if (s === 'failed') return <CircleX className="h-3.5 w-3.5 shrink-0 text-red-500" />;
                                                        return <Clock className="h-3.5 w-3.5 shrink-0 text-ink/40" />;
                                                    })()}
                                                    {preview && PreviewIcon ? (
                                                        <span className="inline-flex min-w-0 items-center gap-1.5 font-medium text-ink/62">
                                                            <PreviewIcon className="h-3.5 w-3.5 shrink-0" />
                                                            <span className="truncate">{preview.label}</span>
                                                        </span>
                                                    ) : (
                                                        <span className="truncate">{c.last_message ?? '—'}</span>
                                                    )}
                                                </div>
                                            </div>
                                            </div>

                                            <div className="mt-2 flex w-full flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-medium leading-none">
                                                    {c.status === 'snoozed' && c.snoozed_until ? (
                                                        <span className="inline-flex h-5 shrink-0 items-center gap-1 rounded-full border border-accent/20 bg-accent/10 px-2 font-semibold text-accent">
                                                            <AlarmClock className="h-3 w-3" />
                                                            {formatSnoozeUntil(c.snoozed_until)}
                                                        </span>
                                                    ) : c.status === 'surveying' ? (
                                                        <span className="inline-flex h-5 shrink-0 items-center gap-1 rounded-full border border-ink/15 bg-violet-50 px-2 font-semibold text-violet-700 dark:border-violet-700 dark:bg-violet-950/30 dark:text-violet-400">
                                                            <Star className="h-3 w-3" />
                                                            Pesquisa
                                                        </span>
                                                    ) : c.status === 'bot' ? (
                                                        <span className="inline-flex h-5 shrink-0 items-center gap-1 rounded-full border border-ink/15 bg-sky-400/12 px-2 font-semibold text-sky-700 dark:border-sky-400/35 dark:bg-sky-400/12 dark:text-sky-300">
                                                            <Bot className="h-3 w-3" />
                                                            Automação
                                                        </span>
                                                    ) : (
                                                        <Badge
                                                            variant={STATUS_VARIANT[c.status]}
                                                            className="h-5 shrink-0 px-2 py-0 text-[10px] leading-none"
                                                        >
                                                            {STATUS_LABEL[c.status]}
                                                        </Badge>
                                                    )}
                                                    {liveSla && liveSla.status !== 'ok' && (
                                                        <SlaIndicator sla={c.sla!} />
                                                    )}
                                                    {c.sector && (
                                                        <span
                                                            className="inline-flex h-5 max-w-[12rem] min-w-0 items-center gap-1 rounded-full bg-accent/[0.07] px-1.5 text-accent"
                                                            title={c.sector.name}
                                                        >
                                                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent/80" />
                                                            <span className="min-w-0 truncate">
                                                                {c.sector.name}
                                                            </span>
                                                        </span>
                                                    )}
                                                    {c.tags?.slice(0, 2).map((tag) => (
                                                        <span
                                                            key={tag.id}
                                                            className={`inline-flex h-5 max-w-[8rem] min-w-0 items-center rounded-full border px-1.5 text-[10px] font-medium ${TAG_BADGE_CLASSES[tag.color] ?? TAG_BADGE_CLASSES.blue}`}
                                                            title={tag.name}
                                                        >
                                                            <span className="min-w-0 truncate">{tag.name}</span>
                                                        </span>
                                                    ))}
                                                    {(c.tags?.length ?? 0) > 2 && (
                                                        <span className="text-[10px] text-ink/35">+{c.tags!.length - 2}</span>
                                                    )}
                                                    {c.assigned_user && (
                                                        <span
                                                            className="inline-flex h-5 max-w-[9rem] min-w-0 items-center gap-1 text-ink/50"
                                                            title={c.assigned_user.name}
                                                        >
                                                            <UserAvatar
                                                                name={c.assigned_user.name}
                                                                photoUrl={c.assigned_user.profile_photo_url}
                                                                size="xs"
                                                                className="h-4 w-4 text-[8px]"
                                                            />
                                                            <span className="min-w-0 truncate">
                                                                {c.assigned_user.name.split(' ')[0]}
                                                            </span>
                                                        </span>
                                                    )}
                                                </div>
                                        </button>
                                    );
                                })}
                            </div>
                            <button
                                onClick={changeSort}
                                aria-label={sort === 'newest' ? 'Mais recentes primeiro. Clique para inverter.' : 'Mais antigas primeiro. Clique para inverter.'}
                                title={sort === 'newest' ? 'Mais recentes primeiro — clique para inverter' : 'Mais antigas primeiro — clique para inverter'}
                                className={cn(
                                    'absolute bottom-4 right-4 flex h-9 w-9 items-center justify-center rounded-full border border-accent/30 bg-canvas text-accent shadow-md transition-colors hover:border-accent/50',
                                    sort === 'oldest' && 'border-accent/60 bg-accent/10',
                                )}
                            >
                                <ArrowDownUp className="h-3.5 w-3.5 text-accent" />
                            </button>
                        </div>

                        {/* Thread + IXC Panel */}
                        <div className={cn(
                            "relative flex min-h-0 overflow-hidden",
                            !selected && "hidden md:flex",
                        )}>
                            {!selected && (
                                <div className="flex flex-1 flex-col items-center justify-center text-ink/45">
                                    <MessageSquare className="mb-2 h-10 w-10" />
                                    Selecione uma conversa para começar.
                                </div>
                            )}

                            {selected && (
                                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                                    <div className="flex min-h-16 shrink-0 flex-wrap items-center gap-3 border-b border-accent/10 px-3 py-2 md:flex-nowrap">
                                        <button
                                            type="button"
                                            onClick={deselectConversation}
                                            aria-label="Voltar para a lista"
                                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink/50 transition hover:bg-ink/[0.07] hover:text-ink md:hidden"
                                        >
                                            <ArrowLeft className="h-4 w-4" />
                                        </button>
                                        <div className="min-w-0 flex-1">
                                            <div className="truncate text-sm font-semibold text-ink/90">
                                                {selected.channel_type === 'web'
                                                    ? (selected.contact.name && !selected.contact.name.startsWith('web_') ? selected.contact.name : 'Visitante')
                                                    : formatClientDisplayName(selected.contact.name, selected.contact.wa_id)}
                                            </div>
                                            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                                                <span className="text-[11px] text-ink/45">
                                                    {selected.channel_type === 'telegram'
                                                        ? `ID: ${selected.contact.wa_id}`
                                                        : selected.channel_type === 'web'
                                                        ? 'Chat Web'
                                                        : formatClientPhone(selected.contact.wa_id)}
                                                </span>
                                                {selected.protocol_number && (
                                                    <button
                                                        type="button"
                                                        title="Copiar número de protocolo"
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(selected.protocol_number!);
                                                            toast.success('Protocolo copiado!');
                                                        }}
                                                        className="group inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium text-ink/40 transition-colors hover:bg-ink/[0.06] hover:text-ink/65"
                                                    >
                                                        #{selected.protocol_number}
                                                        <Copy className="h-2.5 w-2.5 opacity-0 transition-opacity group-hover:opacity-100" />
                                                    </button>
                                                )}
                                                {selected.channel_type === 'telegram' ? (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:bg-blue-950/30 dark:text-blue-400">
                                                        <TelegramIcon className="h-2.5 w-2.5" />{selected.channel_name ?? 'Telegram'}
                                                    </span>
                                                ) : selected.channel_type === 'web' ? (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-600 dark:bg-violet-950/30 dark:text-violet-400">
                                                        <WebIcon className="h-2.5 w-2.5" />{selected.channel_name ?? 'Chat Web'}
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-1.5 py-0.5 text-[10px] font-medium text-green-600 dark:bg-green-950/30 dark:text-green-400">
                                                        <WhatsAppIcon className="h-2.5 w-2.5" />{selected.channel_name ?? 'WhatsApp'}
                                                    </span>
                                                )}
                                                {selected.status === 'snoozed' ? (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                                                        <AlarmClock className="h-2.5 w-2.5" />Adiada
                                                    </span>
                                                ) : selected.status === 'surveying' ? (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-950/30 dark:text-violet-400">
                                                        <Star className="h-2.5 w-2.5" />Pesquisa
                                                    </span>
                                                ) : selected.status === 'bot' ? (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-700 dark:bg-sky-950/30 dark:text-sky-300">
                                                        <Bot className="h-2.5 w-2.5" />Automação
                                                    </span>
                                                ) : (
                                                    <span className={cn(
                                                        'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                                                        selected.status === 'open'
                                                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                                                            : selected.status === 'queued'
                                                              ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300'
                                                              : 'bg-ink/[0.06] text-ink/50',
                                                    )}>
                                                        {selected.status === 'open' && (
                                                            <span className="relative flex h-1.5 w-1.5 shrink-0">
                                                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                                                                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                                            </span>
                                                        )}
                                                        {STATUS_LABEL[selected.status]}
                                                    </span>
                                                )}
                                                {selected.sector && (
                                                    <span className="inline-flex items-center rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                                                        {selected.sector.name}
                                                    </span>
                                                )}
                                                {selected.sla && (
                                                    <>
                                                        {void liveTick}
                                                        <SlaIndicator sla={selected.sla} variant="inline" />
                                                    </>
                                                )}
                                                {inactivityCountdown !== null && (
                                                    <span
                                                        className={cn(
                                                            'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums',
                                                            inactivityCountdown <= 120
                                                                ? 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400'
                                                                : 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400',
                                                        )}
                                                        title="Tempo restante para encerramento automático por inatividade"
                                                    >
                                                        <Clock className="h-2.5 w-2.5 shrink-0" />
                                                        {formatCountdown(inactivityCountdown)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex w-full items-center gap-2 md:w-auto">
                                            {/* ── Ações ── */}
                                            {((canAssignSelected && selected.status !== 'open') ||
                                              (canSnoozeSelected) ||
                                              (canWakeSelected) ||
                                              (canTransferSelected && (sectors.length > 0 || transfer_users.length > 0)) ||
                                              (canActSelected && selected.status !== 'closed' && selected.status !== 'surveying') ||
                                              (canForceCloseSelected && selected.status !== 'closed')) && (
                                                <>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button size="sm" variant="outline">
                                                                Ações <ChevronDown className="ml-1 h-3.5 w-3.5" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            {canAssignSelected && selected.status !== 'open' && (
                                                                <DropdownMenuItem onClick={() => action('inbox.assign')}>
                                                                    <UserCheck className="mr-2 h-4 w-4" /> Assumir
                                                                </DropdownMenuItem>
                                                            )}
                                                            {canSnoozeSelected && (
                                                                <DropdownMenuItem onClick={openSnoozeDialog}>
                                                                    <AlarmClock className="mr-2 h-4 w-4" /> Adiar retorno
                                                                </DropdownMenuItem>
                                                            )}
                                                            {canWakeSelected && (
                                                                <DropdownMenuItem onClick={wakeConversation} disabled={waking}>
                                                                    <UserCheck className="mr-2 h-4 w-4" /> Retomar agora
                                                                </DropdownMenuItem>
                                                            )}
                                                            {canTransferSelected && (sectors.length > 0 || transfer_users.length > 0) && (
                                                                <DropdownMenuItem onClick={openTransferDialog}>
                                                                    <ArrowRightLeft className="mr-2 h-4 w-4" /> Transferir
                                                                </DropdownMenuItem>
                                                            )}
                                                            {canActSelected && selected.status !== 'closed' && selected.status !== 'surveying' && (
                                                                <>
                                                                    {(canAssignSelected || canTransferSelected) && <DropdownMenuSeparator />}
                                                                    <DropdownMenuItem
                                                                        onClick={() => setCloseConfirmOpen(true)}
                                                                        disabled={closing}
                                                                        className="text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
                                                                    >
                                                                        <CircleX className="mr-2 h-4 w-4" /> Encerrar
                                                                    </DropdownMenuItem>
                                                                </>
                                                            )}
                                                            {canForceCloseSelected && selected.status !== 'closed' && (
                                                                <>
                                                                    {(canAssignSelected || canTransferSelected || (canActSelected && selected.status !== 'surveying')) && <DropdownMenuSeparator />}
                                                                    <DropdownMenuItem
                                                                        onClick={() => setForceCloseConfirmOpen(true)}
                                                                        disabled={forceClosing}
                                                                        className="text-orange-600 focus:text-orange-600 dark:text-orange-400 dark:focus:text-orange-400"
                                                                    >
                                                                        <AlertTriangle className="mr-2 h-4 w-4" /> Forçar encerramento
                                                                    </DropdownMenuItem>
                                                                </>
                                                            )}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </>
                                            )}

                                            {/* ── IXC panel toggle ── */}
                                            {has_ixc && (
                                                <button
                                                    type="button"
                                                    title="Painel IXC"
                                                    onClick={() => { setIxcPanelOpen((v) => !v); setNotesPanelOpen(false); setHistoryPanelOpen(false); }}
                                                    className={cn(
                                                        'rounded p-1.5 transition-colors',
                                                        ixcPanelOpen
                                                            ? 'bg-accent/10 text-accent'
                                                            : 'text-ink/40 hover:bg-ink/[0.06] hover:text-ink/70',
                                                    )}
                                                >
                                                    <PanelRight className="h-4 w-4" />
                                                </button>
                                            )}

                                            {/* ── Histórico do contato ── */}
                                            <button
                                                type="button"
                                                title="Histórico do cliente"
                                                onClick={() => { setHistoryPanelOpen((v) => !v); setIxcPanelOpen(false); setNotesPanelOpen(false); }}
                                                className={cn(
                                                    'rounded p-1.5 transition-colors',
                                                    historyPanelOpen
                                                        ? 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400'
                                                        : 'text-ink/40 hover:bg-ink/[0.06] hover:text-ink/70',
                                                )}
                                            >
                                                <History className="h-4 w-4" />
                                            </button>

                                            {/* ── Notes + Tags ── */}
                                            <button
                                                    type="button"
                                                    title="Anotações do cliente"
                                                    onClick={() => { setNotesPanelOpen((v) => !v); setIxcPanelOpen(false); setHistoryPanelOpen(false); }}
                                                    className={cn(
                                                        'rounded p-1.5 transition-colors',
                                                        notesPanelOpen
                                                            ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
                                                            : 'text-ink/40 hover:bg-ink/[0.06] hover:text-ink/70',
                                                    )}
                                                >
                                                    <StickyNote className="h-4 w-4" />
                                                </button>
                                            {tags.length > 0 && (
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <button
                                                            type="button"
                                                            title="Etiquetas"
                                                            className={cn(
                                                                'inline-flex items-center gap-1 rounded p-1.5 transition-colors',
                                                                (selected.tags?.length ?? 0) > 0
                                                                    ? 'bg-accent/10 text-accent'
                                                                    : 'text-ink/40 hover:bg-ink/[0.06] hover:text-ink/70',
                                                            )}
                                                        >
                                                            {(selected.tags?.length ?? 0) > 0 && (
                                                                <span className="flex items-center gap-0.5">
                                                                    {selected.tags?.slice(0, 3).map((tag) => (
                                                                        <span
                                                                            key={tag.id}
                                                                            className={cn(
                                                                                'block h-2 w-2 shrink-0 rounded-full',
                                                                                TAG_DOT_CLASSES[tag.color] ?? 'bg-ink/20',
                                                                            )}
                                                                            title={tag.name}
                                                                        />
                                                                    ))}
                                                                    {(selected.tags?.length ?? 0) > 3 && (
                                                                        <span className="text-[9px] font-medium leading-none text-ink/50">
                                                                            +{(selected.tags?.length ?? 0) - 3}
                                                                        </span>
                                                                    )}
                                                                </span>
                                                            )}
                                                            <TagIcon className="h-4 w-4 shrink-0" />
                                                        </button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-44">
                                                        {tags.map((tag) => {
                                                            const isApplied = selected.tags?.some((t) => t.id === tag.id) ?? false;
                                                            return (
                                                                <DropdownMenuItem
                                                                    key={tag.id}
                                                                    onClick={() => toggleTag(tag.id)}
                                                                    className="cursor-pointer gap-2"
                                                                >
                                                                    <span className={`h-2 w-2 shrink-0 rounded-full ${TAG_DOT_CLASSES[tag.color] ?? 'bg-ink/20'} ${isApplied ? 'opacity-100' : 'opacity-40'}`} />
                                                                    <span className="flex-1 truncate">{tag.name}</span>
                                                                    {isApplied && <Check className="h-3.5 w-3.5 shrink-0 text-accent" />}
                                                                </DropdownMenuItem>
                                                            );
                                                        })}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            )}
                                        </div>
                                    </div>

                                    {selected.status === 'snoozed' && selected.snoozed_until && (
                                        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-accent/15 bg-accent/[0.08] px-3 py-2 text-xs text-accent">
                                            <AlarmClock className="h-3.5 w-3.5 shrink-0 text-accent/80" />
                                            <div className="min-w-0 flex-1">
                                                <span>
                                                    Voltar a falar com este cliente {formatSnoozeUntil(selected.snoozed_until)}.
                                                </span>
                                                {selected.snooze_note && (
                                                    <span className="mt-0.5 block text-[11px] text-accent/75">
                                                        {selected.snooze_note}
                                                    </span>
                                                )}
                                            </div>
                                            {canWakeSelected && (
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-7 border-accent/25 bg-canvas/70 text-accent hover:bg-accent/10"
                                                    onClick={wakeConversation}
                                                    disabled={waking}
                                                >
                                                    {waking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Retomar agora'}
                                                </Button>
                                            )}
                                        </div>
                                    )}

                                    {viewingLabel && (
                                        <div className="flex shrink-0 items-center gap-2 border-b border-accent/15 bg-accent/[0.08] px-3 py-2 text-xs text-accent">
                                            <Eye className="h-3.5 w-3.5 shrink-0 text-accent/80" />
                                            <div className="flex min-w-0 flex-1 items-center gap-1.5">
                                                <div className="flex -space-x-1.5">
                                                    {otherViewers.slice(0, 3).map((viewer) => (
                                                        <UserAvatar
                                                            key={viewer.user_id}
                                                            name={viewer.user_name}
                                                            photoUrl={viewer.profile_photo_url}
                                                            size="xs"
                                                            className="h-5 w-5 border border-accent/20 text-[9px]"
                                                        />
                                                    ))}
                                                </div>
                                                <span className="min-w-0 truncate">{viewingLabel}</span>
                                            </div>
                                        </div>
                                    )}

                                    <ChatThread contentClassName="gap-2">
                                        {displayMessages.map(
                                            (m, index, messages) => (
                                                <MessageScrollerItem
                                                    key={m.id}
                                                    messageId={String(m.id)}
                                                    scrollAnchor={index === messages.length - 1}
                                                >
                                                    <InboxMessageBubble
                                                        message={m}
                                                        isOptimistic={'optimistic' in m}
                                                        autoTranscribeAudio={autoTranscribeAudio}
                                                        isTranscribing={transcribingIds.has(m.id)}
                                                        onTranscribe={transcribeMessage}
                                                    />
                                                </MessageScrollerItem>
                                            ),
                                        )}
                                    </ChatThread>

                                    {selected.status === 'closed' ? (
                                        <div className="border-t border-accent/10 p-3 text-center text-sm text-ink/45">
                                            Atendimento encerrado.{' '}
                                            {canAssignSelected && (
                                                <button
                                                    className="underline"
                                                    onClick={() => action('inbox.assign')}
                                                >
                                                    Reabrir
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        <>
                                            {selected.status === 'snoozed' && (
                                                <div className="border-t border-accent/10 p-3 text-center text-sm text-ink/45">
                                                    Conversa adiada até {formatSnoozeUntil(selected.snoozed_until)}.{' '}
                                                    {canWakeSelected && (
                                                        <button
                                                            className="underline"
                                                            onClick={wakeConversation}
                                                            disabled={waking}
                                                        >
                                                            Retomar agora
                                                        </button>
                                                    )}
                                                </div>
                                            )}

                                            {(isClientComposerMode || isInternalComposerMode) ? (
                                        <form
                                            onSubmit={send}
                                            className="space-y-2.5 border-t border-accent/10 bg-base/20 p-3"
                                        >
                                            {showComposerToggle && (
                                                <ComposerModeToggle
                                                    mode={composerMode}
                                                    onChange={setComposerMode}
                                                />
                                            )}

                                            {!showComposerToggle && isInternalComposerMode && (
                                                <InternalComposerHeader />
                                            )}

                                            {isInternalComposerMode ? (
                                                <>
                                                    {internalComposerErrors.body && (
                                                        <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-2 py-1.5 text-xs text-red-200">
                                                            {internalComposerErrors.body}
                                                        </div>
                                                    )}
                                                    <div className="flex items-center gap-2">
                                                        <Textarea
                                                            value={internalComposer.data.body}
                                                            onChange={(e) =>
                                                                internalComposer.setData('body', e.target.value)
                                                            }
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                                    e.preventDefault();
                                                                    submitInternalMessage();
                                                                }
                                                            }}
                                                            placeholder={
                                                                canActSelected
                                                                    ? 'Mensagem interna — só a equipe vê…'
                                                                    : 'Orientação interna para o atendente…'
                                                            }
                                                            title="Visível apenas para a equipe — o cliente não recebe."
                                                            className="min-h-9 max-h-48 resize-none overflow-y-auto border-red-500/15 bg-red-500/[0.03] py-1.5 scrollbar-thin focus-visible:ring-red-500/25 dark:border-red-500/20 dark:bg-red-500/[0.06]"
                                                            rows={1}
                                                        />
                                                        <Button
                                                            type="submit"
                                                            size="icon"
                                                            disabled={
                                                                sendingMessage ||
                                                                !internalComposer.data.body.trim()
                                                            }
                                                            className="shrink-0 bg-red-600 text-white shadow-sm hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600"
                                                        >
                                                            {sendingMessage ? (
                                                                <Loader2 className="animate-spin" />
                                                            ) : (
                                                                <Shield />
                                                            )}
                                                        </Button>
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                            {/* Attachment preview dialog */}
                                            <Dialog open={attachmentDialogOpen} onOpenChange={(open) => { if (!open) clearAttachment(); }}>
                                                <DialogContent className="max-w-sm">
                                                    <DialogHeader>
                                                        <DialogTitle>Enviar arquivo</DialogTitle>
                                                        <DialogDescription className="sr-only">Pré-visualização do arquivo a ser enviado</DialogDescription>
                                                    </DialogHeader>

                                                    <div className="flex flex-col items-center justify-center rounded-xl bg-ink/[0.04] py-6">
                                                        {attachmentPreviewUrl ? (
                                                            <img
                                                                src={attachmentPreviewUrl}
                                                                alt={attachmentName ?? ''}
                                                                className="max-h-64 w-full rounded-lg object-contain"
                                                            />
                                                        ) : (
                                                            <div className="flex flex-col items-center gap-3">
                                                                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10">
                                                                    {composer.data.attachment?.type.startsWith('video/') ? (
                                                                        <Video className="h-8 w-8 text-accent" />
                                                                    ) : composer.data.attachment?.type.startsWith('audio/') ? (
                                                                        <Mic className="h-8 w-8 text-accent" />
                                                                    ) : (
                                                                        <FileText className="h-8 w-8 text-accent" />
                                                                    )}
                                                                </div>
                                                                <span className="max-w-[200px] truncate text-center text-sm font-medium text-ink/80">
                                                                    {attachmentName}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <input
                                                        type="text"
                                                        value={composer.data.body}
                                                        onChange={(e) => composer.setData('body', e.target.value)}
                                                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitMessage(); } }}
                                                        placeholder="Adicionar legenda..."
                                                        className="w-full rounded-lg border border-ink/[0.10] bg-transparent px-3 py-2 text-sm text-ink outline-none placeholder:text-ink/40 focus:ring-2 focus:ring-accent/30"
                                                    />

                                                    {uploadProgress !== null ? (
                                                        <div className="space-y-2 pt-1">
                                                            <div className="flex items-center justify-between text-xs text-ink/50">
                                                                <span>Enviando arquivo…</span>
                                                                <span className="tabular-nums">{uploadProgress}%</span>
                                                            </div>
                                                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink/[0.08]">
                                                                <div
                                                                    className="h-full rounded-full bg-accent transition-all duration-200"
                                                                    style={{ width: `${uploadProgress}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <DialogFooter>
                                                            <Button type="button" variant="ghost" size="sm" onClick={clearAttachment}>
                                                                Cancelar
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                onClick={submitMessage}
                                                                disabled={sendingMessage}
                                                            >
                                                                <Send className="h-4 w-4" />
                                                                Enviar
                                                            </Button>
                                                        </DialogFooter>
                                                    )}
                                                </DialogContent>
                                            </Dialog>
                                            {(composerErrors.send ||
                                                composerErrors.audio ||
                                                composerErrors.body) && (
                                                <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-2 py-1.5 text-xs text-red-200">
                                                    {composerErrors.send ||
                                                        composerErrors.audio ||
                                                        composerErrors.body}
                                                </div>
                                            )}

                                            <div className="flex items-center gap-2">
                                                <input
                                                    ref={attachmentInputRef}
                                                    type="file"
                                                    className="hidden"
                                                    accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                                                    onChange={onAttachmentChange}
                                                />

                                                {!isRecording && !audioPreviewUrl && (
                                                    <>
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="icon"
                                                            onClick={() =>
                                                                attachmentInputRef.current?.click()
                                                            }
                                                            disabled={sendingMessage}
                                                        >
                                                            <Paperclip />
                                                        </Button>

                                                        <div ref={emojiPickerRef} className="relative">
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="icon"
                                                                onClick={() => setShowEmojiPicker((v) => !v)}
                                                                disabled={sendingMessage}
                                                            >
                                                                <Smile />
                                                            </Button>
                                                            {showEmojiPicker && (
                                                                <div
                                                                    className="absolute bottom-11 left-0 z-50"
                                                                    onMouseDown={(e) => e.stopPropagation()}
                                                                >
                                                                    <EmojiPicker
                                                                        theme={document.documentElement.classList.contains('dark') ? Theme.DARK : Theme.LIGHT}
                                                                        onEmojiClick={(data) => {
                                                                            insertEmoji(data);
                                                                            setShowEmojiPicker(false);
                                                                        }}
                                                                        lazyLoadEmojis
                                                                        searchPlaceholder="Buscar emoji..."
                                                                        skinTonesDisabled
                                                                        previewConfig={{ showPreview: false }}
                                                                        height={380}
                                                                        width={typeof window !== 'undefined' ? Math.min(320, window.innerWidth - 32) : 320}
                                                                        categories={[
                                                                            { category: Categories.SUGGESTED, name: 'Recentes' },
                                                                            { category: Categories.SMILEYS_PEOPLE, name: 'Rostos e Pessoas' },
                                                                            { category: Categories.ANIMALS_NATURE, name: 'Animais e Natureza' },
                                                                            { category: Categories.FOOD_DRINK, name: 'Comida e Bebida' },
                                                                            { category: Categories.TRAVEL_PLACES, name: 'Viagens e Lugares' },
                                                                            { category: Categories.ACTIVITIES, name: 'Atividades' },
                                                                            { category: Categories.OBJECTS, name: 'Objetos' },
                                                                            { category: Categories.SYMBOLS, name: 'Símbolos' },
                                                                            { category: Categories.FLAGS, name: 'Bandeiras' },
                                                                        ]}
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>
                                                    </>
                                                )}

                                                {isRecording ? (
                                                    <div className="flex flex-1 items-center gap-3 rounded-md border border-red-400/30 bg-red-500/10 px-3 py-1.5">
                                                        <span className="h-2 w-2 flex-shrink-0 animate-pulse rounded-full bg-red-400" />
                                                        <span className="font-mono text-sm tabular-nums text-red-300">
                                                            {formatDuration(recordingSeconds)}
                                                        </span>
                                                        <div
                                                            className="flex flex-1 items-center justify-center gap-1"
                                                            style={{ height: 30 }}
                                                        >
                                                            {recordingWaveLevels.map((h, i) => (
                                                                    <div
                                                                        key={i}
                                                                        className="w-[4px] rounded-full bg-red-400/80 transition-[height] duration-75"
                                                                        style={{
                                                                            height: `${Math.round(8 + h * 22)}px`,
                                                                        }}
                                                                    />
                                                                ))}
                                                        </div>
                                                    </div>
                                                ) : audioPreviewUrl ? (
                                                    <>
                                                        <audio
                                                            ref={audioPreviewRef}
                                                            src={audioPreviewUrl}
                                                            onLoadedMetadata={() =>
                                                                setAudioDuration(
                                                                    audioPreviewRef.current?.duration ?? 0,
                                                                )
                                                            }
                                                            onTimeUpdate={() =>
                                                                setAudioCurrentTime(
                                                                    audioPreviewRef.current?.currentTime ?? 0,
                                                                )
                                                            }
                                                            onEnded={() => setIsAudioPlaying(false)}
                                                        />
                                                        <div className="flex flex-1 items-center gap-2 rounded-md border border-ink/[0.12] bg-ink/[0.06] px-2 py-1.5">
                                                            <button
                                                                type="button"
                                                                onClick={toggleAudioPlayback}
                                                                className="flex-shrink-0 text-ink/70 hover:text-ink"
                                                            >
                                                                {isAudioPlaying ? (
                                                                    <Pause className="h-4 w-4" />
                                                                ) : (
                                                                    <Play className="h-4 w-4" />
                                                                )}
                                                            </button>
                                                            <input
                                                                type="range"
                                                                min={0}
                                                                max={audioDuration || 1}
                                                                step={0.05}
                                                                value={audioCurrentTime}
                                                                onChange={(e) => {
                                                                    const t = parseFloat(e.target.value);
                                                                    if (audioPreviewRef.current) {
                                                                        audioPreviewRef.current.currentTime = t;
                                                                    }
                                                                    setAudioCurrentTime(t);
                                                                }}
                                                                className="flex-1 cursor-pointer accent-primary"
                                                            />
                                                            <span className="flex-shrink-0 font-mono text-xs tabular-nums text-ink/60">
                                                                {formatDuration(Math.round(audioDuration || 0))}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={clearAudio}
                                                                className="flex-shrink-0 text-ink/45 hover:text-red-400"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </button>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div className="relative flex-1">
                                                        {slashMatches.length > 0 && (
                                                            <div className="absolute bottom-full left-0 right-0 z-50 mb-1 max-h-52 overflow-y-auto rounded-lg border border-ink/[0.12] bg-white shadow-lg dark:bg-neutral-800">
                                                                {slashMatches.map((qr, idx) => (
                                                                    <button
                                                                        key={qr.id}
                                                                        type="button"
                                                                        className={cn(
                                                                            'flex w-full flex-col px-3 py-2 text-left transition-colors hover:bg-ink/[0.06]',
                                                                            idx === slashIndex && 'bg-ink/[0.08]',
                                                                        )}
                                                                        onMouseDown={(e) => {
                                                                            e.preventDefault();
                                                                            composer.setData('body', qr.content);
                                                                            setSlashMatches([]);
                                                                        }}
                                                                    >
                                                                        <span className="text-xs font-semibold text-accent">/{qr.trigger}</span>
                                                                        <span className="truncate text-xs text-ink/60">{qr.title}</span>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                        <Textarea
                                                            ref={composerTextareaRef}
                                                            value={composer.data.body}
                                                            onChange={(e) => {
                                                                e.target.style.height = 'auto';
                                                                e.target.style.height = e.target.scrollHeight + 'px';
                                                                const val = e.target.value;
                                                                composer.setData('body', val);
                                                                if (val.startsWith('/') && !val.includes('\n') && !val.includes(' ')) {
                                                                    const q = val.slice(1).toLowerCase();
                                                                    setSlashMatches(
                                                                        quick_replies.filter(
                                                                            (qr) =>
                                                                                qr.trigger.toLowerCase().startsWith(q) ||
                                                                                qr.title.toLowerCase().includes(q),
                                                                        ),
                                                                    );
                                                                    setSlashIndex(0);
                                                                } else {
                                                                    setSlashMatches([]);
                                                                }
                                                            }}
                                                            onKeyDown={(e) => {
                                                                if (slashMatches.length > 0) {
                                                                    if (e.key === 'ArrowDown') {
                                                                        e.preventDefault();
                                                                        setSlashIndex((i) => (i + 1) % slashMatches.length);
                                                                        return;
                                                                    }
                                                                    if (e.key === 'ArrowUp') {
                                                                        e.preventDefault();
                                                                        setSlashIndex((i) => (i - 1 + slashMatches.length) % slashMatches.length);
                                                                        return;
                                                                    }
                                                                    if (e.key === 'Enter' && !e.shiftKey) {
                                                                        e.preventDefault();
                                                                        composer.setData('body', slashMatches[slashIndex].content);
                                                                        setSlashMatches([]);
                                                                        return;
                                                                    }
                                                                    if (e.key === 'Escape') {
                                                                        setSlashMatches([]);
                                                                        return;
                                                                    }
                                                                }
                                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                                    e.preventDefault();
                                                                    send(e);
                                                                }
                                                            }}
                                                            placeholder="Digite uma mensagem..."
                                                            className="min-h-9 max-h-48 resize-none overflow-y-auto py-1.5 scrollbar-thin"
                                                            rows={1}
                                                        />
                                                    </div>
                                                )}

                                                {isRecording ? (
                                                    <Button
                                                        type="button"
                                                        variant="destructive"
                                                        size="icon"
                                                        onClick={stopRecording}
                                                        disabled={sendingMessage}
                                                    >
                                                        <Square />
                                                    </Button>
                                                ) : canSubmit ? (
                                                    <Button
                                                        type="submit"
                                                        size="icon"
                                                        disabled={sendingMessage}
                                                        className="transition-all duration-200 disabled:scale-95"
                                                    >
                                                        {sendingMessage ? (
                                                            <Loader2 className="animate-spin" />
                                                        ) : (
                                                            <Send />
                                                        )}
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="icon"
                                                        onClick={startRecording}
                                                        disabled={sendingMessage}
                                                    >
                                                        <Mic />
                                                    </Button>
                                                )}
                                            </div>
                                                </>
                                            )}
                                        </form>
                                            ) : selected.status !== 'snoozed' ? (
                                                <div className="border-t border-accent/10 p-3 text-center text-sm text-ink/45">
                                                    {canAssignSelected || isAssignedToCurrentUser
                                                        ? 'Assuma a conversa para enviar mensagens.'
                                                        : 'Conversa atribuída a outro atendente.'}
                                                </div>
                                            ) : null}
                                        </>
                                    )}
                                </div>
                            )}

                            {/* IXC side panel */}
                            {ixcPanelOpen && selected && ixcContact && (
                                <div className="fixed inset-0 z-40 md:static md:inset-auto md:z-auto md:shrink-0">
                                    <button
                                        type="button"
                                        aria-label="Fechar painel"
                                        className="absolute inset-0 bg-black/70 backdrop-blur-sm md:hidden"
                                        onClick={() => setIxcPanelOpen(false)}
                                    />
                                    <div className="relative h-full md:h-auto">
                                        <IxcPanel
                                            contact={{
                                                id: selected.contact.id,
                                                ixc_customer_id: ixcContact.ixc_customer_id,
                                                ixc_customer_name: ixcContact.ixc_customer_name,
                                            }}
                                            conversationId={selected.id}
                                            onClose={() => setIxcPanelOpen(false)}
                                            onLinked={(id, name) =>
                                                setIxcContact({ ixc_customer_id: id, ixc_customer_name: name })
                                            }
                                            onUnlinked={() =>
                                                setIxcContact({ ixc_customer_id: null, ixc_customer_name: null })
                                            }
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Notes side panel */}
                            {notesPanelOpen && selected && (
                                <div className="fixed inset-0 z-40 md:static md:inset-auto md:z-auto md:shrink-0">
                                    <button
                                        type="button"
                                        aria-label="Fechar painel"
                                        className="absolute inset-0 bg-black/70 backdrop-blur-sm md:hidden"
                                        onClick={() => setNotesPanelOpen(false)}
                                    />
                                    <div className="relative h-full md:h-auto">
                                        <NotesPanel
                                            key={selected.contact.id}
                                            contactId={selected.contact.id}
                                            initialNotes={selected.contact.notes}
                                            onClose={() => setNotesPanelOpen(false)}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Contact history side panel */}
                            {historyPanelOpen && selected?.contact_history && (
                                <div className="fixed inset-0 z-40 md:static md:inset-auto md:z-auto md:shrink-0">
                                    <button
                                        type="button"
                                        aria-label="Fechar painel"
                                        className="absolute inset-0 bg-black/70 backdrop-blur-sm md:hidden"
                                        onClick={() => setHistoryPanelOpen(false)}
                                    />
                                    <div className="relative h-full md:h-auto">
                                        <ContactHistoryPanel
                                            key={`${selected.contact.id}-${selected.id}`}
                                            contactId={selected.contact.id}
                                            anchorConversationId={selected.id}
                                            history={selected.contact_history}
                                            onClose={() => setHistoryPanelOpen(false)}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
            </div>

            {/* Dialog: adiar retorno */}
            <Dialog open={snoozeOpen} onOpenChange={setSnoozeOpen}>
                <DialogContent className="scrollbar-thin gap-4 p-5 sm:max-w-xl">
                    <DialogHeader className="pr-8">
                        <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-accent/20 bg-accent/10 text-accent">
                                <AlarmClock className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 space-y-1">
                                <DialogTitle>Adiar retorno</DialogTitle>
                                <DialogDescription>
                                    A conversa sai da sua lista ativa e volta automaticamente no horário escolhido.
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="grid grid-cols-2 gap-2">
                        {([
                            ['1h', 'Em 1 hora'],
                            ['3h', 'Em 3 horas'],
                            ['tomorrow_10', 'Amanhã às 10h'],
                            ['custom', 'Personalizado'],
                        ] as const).map(([value, label]) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() => setSnoozePreset(value)}
                                className={cn(
                                    'rounded-xl border px-3 py-2 text-left text-sm transition-colors',
                                    snoozePreset === value
                                        ? 'border-accent/35 bg-accent/10 text-accent'
                                        : 'border-ink/[0.08] bg-ink/[0.03] text-ink/70 hover:text-ink',
                                )}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {snoozePreset === 'custom' && (
                        <SnoozeDateTimePicker
                            date={snoozeCustomDate}
                            time={snoozeCustomTime}
                            onDateChange={setSnoozeCustomDate}
                            onTimeChange={setSnoozeCustomTime}
                        />
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="snooze_note">Lembrete (opcional)</Label>
                        <Textarea
                            id="snooze_note"
                            value={snoozeNote}
                            onChange={(e) => setSnoozeNote(e.target.value)}
                            placeholder="Ex.: Confirmar se o técnico já visitou o cliente"
                            rows={2}
                            maxLength={500}
                        />
                    </div>

                    <DialogFooter className="gap-2 sm:space-x-0">
                        <Button type="button" variant="outline" onClick={() => setSnoozeOpen(false)}>
                            Cancelar
                        </Button>
                        <Button type="button" onClick={submitSnooze} disabled={snoozing}>
                            {snoozing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Adiar conversa'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog: transferir */}
            <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
                <DialogContent className="gap-5 p-5 sm:max-w-md">
                    <DialogHeader className="pr-8">
                        <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-accent/20 bg-accent/10 text-accent">
                                <ArrowRightLeft className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 space-y-1">
                                <DialogTitle>Transferir conversa</DialogTitle>
                                <DialogDescription>
                                    {transferMode === 'sector'
                                        ? 'Escolha o setor que deve assumir esta conversa.'
                                        : 'Escolha o atendente que deve assumir esta conversa.'}
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    {/* Mode toggle — só exibe se ambas as opções existem */}
                    {sectors.length > 0 && transfer_users.length > 0 && (
                        <div className="grid grid-cols-2 gap-1 rounded-xl border border-ink/[0.08] bg-ink/[0.03] p-1">
                            <button
                                type="button"
                                onClick={() => setTransferMode('sector')}
                                className={cn(
                                    'rounded-lg py-1.5 text-sm font-medium transition-colors',
                                    transferMode === 'sector'
                                        ? 'bg-white text-ink shadow-sm dark:bg-ink/10'
                                        : 'text-ink/50 hover:text-ink/75',
                                )}
                            >
                                Setor
                            </button>
                            <button
                                type="button"
                                onClick={() => setTransferMode('user')}
                                className={cn(
                                    'rounded-lg py-1.5 text-sm font-medium transition-colors',
                                    transferMode === 'user'
                                        ? 'bg-white text-ink shadow-sm dark:bg-ink/10'
                                        : 'text-ink/50 hover:text-ink/75',
                                )}
                            >
                                Atendente
                            </button>
                        </div>
                    )}

                    <div className="space-y-2">
                        {transferMode === 'sector' ? (
                            <>
                                <p className="text-xs font-medium uppercase tracking-widest text-ink/45">
                                    Setor de destino
                                </p>
                                <Select value={transferSectorId} onValueChange={setTransferSectorId}>
                                    <SelectTrigger className="h-10 px-3 text-sm">
                                        <SelectValue placeholder="Selecione um setor" />
                                    </SelectTrigger>
                                    <SelectContent className="z-[60]">
                                        {sectors.map((s) => (
                                            <SelectItem key={s.id} value={s.id.toString()}>
                                                {s.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </>
                        ) : (
                            <>
                                <p className="text-xs font-medium uppercase tracking-widest text-ink/45">
                                    Atendente de destino
                                </p>
                                <Select value={transferUserId} onValueChange={setTransferUserId}>
                                    <SelectTrigger className="h-10 px-3 text-sm">
                                        <SelectValue placeholder="Selecione um atendente" />
                                    </SelectTrigger>
                                    <SelectContent className="z-[60]">
                                        {transfer_users
                                            .filter((u) => u.id !== selected?.assigned_user_id)
                                            .map((u) => (
                                                <SelectItem key={u.id} value={u.id.toString()}>
                                                    {u.name}
                                                </SelectItem>
                                            ))}
                                    </SelectContent>
                                </Select>
                            </>
                        )}
                    </div>

                    <DialogFooter className="gap-2 sm:space-x-0">
                        <Button
                            variant="outline"
                            onClick={() => setTransferOpen(false)}
                            disabled={transferring}
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={submitTransfer}
                            disabled={
                                transferring ||
                                (transferMode === 'sector' ? !transferSectorId : !transferUserId)
                            }
                        >
                            Transferir
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog: encerrar conversa */}
            <Dialog open={closeConfirmOpen} onOpenChange={(open) => { if (!closing) setCloseConfirmOpen(open); }}>
                <DialogContent className="gap-5 p-5 sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Encerrar conversa</DialogTitle>
                        <DialogDescription>
                            Tem certeza que deseja encerrar esta conversa?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:space-x-0">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCloseConfirmOpen(false)}
                            disabled={closing}
                        >
                            Cancelar
                        </Button>
                        <Button
                            size="sm"
                            className="bg-red-600 text-white hover:bg-red-700"
                            onClick={() => action('inbox.close')}
                            disabled={closing}
                        >
                            {closing ? 'Encerrando...' : 'Encerrar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog: forçar encerramento (admin/gestor) */}
            <Dialog open={forceCloseConfirmOpen} onOpenChange={(open) => { if (!forceClosing) setForceCloseConfirmOpen(open); }}>
                <DialogContent className="gap-5 p-5 sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-orange-500" />
                            Forçar encerramento
                        </DialogTitle>
                        <DialogDescription>
                            Isso encerrará a conversa imediatamente, mesmo que esteja aguardando resposta da pesquisa de satisfação. Use apenas quando a pesquisa não foi entregue ao cliente.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:space-x-0">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setForceCloseConfirmOpen(false)}
                            disabled={forceClosing}
                        >
                            Cancelar
                        </Button>
                        <Button
                            size="sm"
                            className="bg-orange-600 text-white hover:bg-orange-700"
                            onClick={() => {
                                if (!selected) return;
                                setForceClosing(true);
                                router.post(
                                    route('inbox.force-close', selected.id),
                                    {},
                                    {
                                        preserveScroll: true,
                                        preserveState: true,
                                        onFinish: () => {
                                            setForceClosing(false);
                                            setForceCloseConfirmOpen(false);
                                        },
                                    },
                                );
                            }}
                            disabled={forceClosing}
                        >
                            {forceClosing ? 'Encerrando...' : 'Forçar encerramento'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AuthenticatedLayout>
    );
}
