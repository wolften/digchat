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
import { Textarea } from '@/Components/ui/textarea';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { isMediaMessageType, mediaCaption, mediaTypeFromPlaceholder } from '@/lib/messageMedia';
import { cn, formatClientDisplayName, formatClientPhone } from '@/lib/utils';
import { PageProps } from '@/types';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import {
    AlertTriangle,
    ArrowDownUp,
    ArrowRightLeft,
    Bot,
    Check,
    ChevronDown,
    CheckCheck,
    CircleX,
    Clock,
    FileText,
    ImageIcon,
    Loader2,
    MessageSquare,
    Mic,
    Paperclip,
    Pause,
    PanelRight,
    Play,
    Send,
    Square,
    Star,
    StickyNote,
    Trash2,
    UserCheck,
    UserRound,
    Video,
} from 'lucide-react';
import { ChangeEvent, SyntheticEvent, useEffect, useMemo, useRef, useState } from 'react';
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

type Status = 'bot' | 'queued' | 'open' | 'closed' | 'surveying';

interface Sector {
    id: number;
    name: string;
}

interface ConversationSummary {
    id: number;
    status: Status;
    channel_type: 'whatsapp' | 'telegram' | null;
    channel_name: string | null;
    assigned_user_id: number | null;
    assigned_user: { id: number; name: string } | null;
    sector: Sector | null;
    can_transfer: boolean;
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
    unread_count: number;
}

interface Msg {
    id: number;
    direction: 'in' | 'out';
    type: string;
    body: string | null;
    media_url?: string | null;
    status: string | null;
    sender: { id: number; name: string } | null;
    created_at: string | null;
}

type MessageRole = 'client' | 'attendant' | 'automation';

interface QuickReply {
    id: number;
    trigger: string;
    title: string;
    content: string;
}

interface Selected {
    id: number;
    status: Status;
    channel_type: 'whatsapp' | 'telegram' | null;
    channel_name: string | null;
    assigned_user_id: number | null;
    assigned_user: { id: number; name: string } | null;
    sector: Sector | null;
    can_act: boolean;
    can_assign: boolean;
    can_transfer: boolean;
    can_force_close: boolean;
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
    sectors: Sector[];
    users: UserFilter[];
    transfer_users: UserFilter[];
    counts: { bot: number; queued: number; mine: number };
    auto_close_enabled: boolean;
    auto_close_minutes: number;
    quick_replies: QuickReply[];
    has_ixc: boolean;
}

const STATUS_LABEL: Record<Status, string> = {
    bot: 'Automação',
    queued: 'Na fila',
    open: 'Em atendimento',
    closed: 'Encerrada',
    surveying: 'Pesquisa',
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
};

function formatTime(iso: string | null): string {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
    });
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

function messageRole(message: Msg): MessageRole {
    if (message.direction === 'in') return 'client';
    return message.sender ? 'attendant' : 'automation';
}

const MESSAGE_ROLE_META = {
    client: {
        Icon: UserRound,
        label: 'Cliente',
        row: 'justify-start',
        bubble: 'bg-white text-gray-800 dark:bg-[#142a1b] dark:text-gray-100',
        roundedBubble: 'rounded-tl-2xl rounded-tr-2xl rounded-br-2xl',
        icon: 'bg-ink/[0.06] text-ink/55 dark:bg-white/10 dark:text-white/65',
        labelText: 'text-ink/55 dark:text-white/60',
        metaText: 'text-ink/42',
        tick: 'text-gray-800/70 dark:text-gray-100/70',
        tickRead: 'text-gray-800 dark:text-gray-100',
    },
    attendant: {
        Icon: UserCheck,
        label: 'Atendente',
        row: 'justify-end',
        bubble: 'bg-accent text-black',
        roundedBubble: 'rounded-tl-2xl rounded-tr-2xl rounded-bl-2xl',
        icon: 'bg-black/10 text-black/70',
        labelText: 'text-black/70',
        metaText: 'text-black/55',
        tick: 'text-black/70',
        tickRead: 'text-black',
    },
    automation: {
        Icon: Bot,
        label: 'Automação',
        row: 'justify-end',
        bubble:
            'border border-amber-300/50 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-900 dark:text-amber-50',
        roundedBubble: 'rounded-tl-2xl rounded-tr-2xl rounded-bl-2xl',
        icon: 'bg-amber-200/70 text-amber-900 dark:bg-amber-800 dark:text-amber-100',
        labelText: 'text-amber-900/70 dark:text-amber-100/70',
        metaText: 'text-amber-800/55 dark:text-amber-200/60',
        tick: 'text-amber-950/70 dark:text-white/70',
        tickRead: 'text-amber-950 dark:text-white',
    },
} satisfies Record<
    MessageRole,
    {
        Icon: typeof UserRound;
        label: string;
        row: string;
        bubble: string;
        roundedBubble: string;
        icon: string;
        labelText: string;
        metaText: string;
        tick: string;
        tickRead: string;
    }
>;

export default function InboxIndex({
    conversations,
    selected,
    filter,
    sort,
    sector_id,
    user_id,
    sectors,
    users,
    transfer_users,
    counts,
    auto_close_enabled,
    auto_close_minutes,
    quick_replies,
    has_ixc,
}: Props) {
    const currentUser = usePage<PageProps>().props.auth.user;
    const threadRef = useRef<HTMLDivElement>(null);
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
    const [recordingWaveLevels, setRecordingWaveLevels] = useState<number[]>(
        RECORDING_WAVE_LEVELS_BASE,
    );
    const audioPreviewRef = useRef<HTMLAudioElement>(null);
    const composerTextareaRef = useRef<HTMLTextAreaElement>(null);
    const [recordingSeconds, setRecordingSeconds] = useState(0);
    const [isAudioPlaying, setIsAudioPlaying] = useState(false);
    const [audioDuration, setAudioDuration] = useState(0);
    const [audioCurrentTime, setAudioCurrentTime] = useState(0);
    const [transferOpen, setTransferOpen] = useState(false);
    const [transferMode, setTransferMode] = useState<'sector' | 'user'>('sector');
    const [transferSectorId, setTransferSectorId] = useState<string>('');
    const [transferUserId, setTransferUserId] = useState<string>('');
    const [transferring, setTransferring] = useState(false);
    const [ixcPanelOpen, setIxcPanelOpen] = useState(false);
    const [notesPanelOpen, setNotesPanelOpen] = useState(false);
    const [ixcContact, setIxcContact] = useState<{
        ixc_customer_id: string | null;
        ixc_customer_name: string | null;
    } | null>(null);
    const [optimisticMessages, setOptimisticMessages] = useState<(Msg & { optimistic: true })[]>([]);
    const [inactivityTick, setInactivityTick] = useState(0);
    const [slashMatches, setSlashMatches] = useState<QuickReply[]>([]);
    const [slashIndex, setSlashIndex] = useState(0);

    // Realtime: recarrega lista + thread a cada evento de broadcast.
    useEffect(() => {
        const echo = window.Echo;
        if (!echo) return;

        const channel = echo.private('conversations');
        const reload = () =>
            router.reload({ only: ['conversations', 'selected', 'counts'] });

        channel.listen('.message.created', reload);
        channel.listen('.conversation.updated', reload);

        return () => {
            channel.stopListening('.message.created', reload);
            channel.stopListening('.conversation.updated', reload);
        };
    }, []);

    // Limpa mensagens otimistas ao trocar de conversa.
    useEffect(() => {
        setOptimisticMessages([]);
        if (selected) {
            setIxcContact({
                ixc_customer_id: selected.contact.ixc_customer_id ?? null,
                ixc_customer_name: selected.contact.ixc_customer_name ?? null,
            });
        } else {
            setIxcContact(null);
            setIxcPanelOpen(false);
        }
    }, [selected?.id]);

    // Remove otimistas que o servidor já confirmou (evita duplicatas ao enviar várias mensagens seguidas).
    useEffect(() => {
        if (!selected?.messages || optimisticMessages.length === 0) return;

        const oldestOptimisticTime = Math.min(...optimisticMessages.map((m) => new Date(m.created_at ?? 0).getTime()));

        const realCounts = new Map<string | null, number>();
        for (const m of selected.messages) {
            if (m.direction !== 'out') continue;
            if (new Date(m.created_at ?? 0).getTime() < oldestOptimisticTime - 5000) continue;
            realCounts.set(m.body, (realCounts.get(m.body) ?? 0) + 1);
        }

        setOptimisticMessages((prev) => {
            const counts = new Map(realCounts);
            return prev.filter((m) => {
                const available = counts.get(m.body) ?? 0;
                if (available > 0) {
                    counts.set(m.body, available - 1);
                    return false;
                }
                return true;
            });
        });
    }, [selected?.id, selected?.messages?.length]);

    // Auto-scroll para o fim da thread quando muda a seleção/mensagens.
    useEffect(() => {
        if (threadRef.current) {
            threadRef.current.scrollTop = threadRef.current.scrollHeight;
        }
    }, [selected?.id, selected?.messages.length, optimisticMessages.length]);

    // Calcula quando o timer expira direto dos props (sem armazenar em estado).
    const inactivityExpiresAt = useMemo(() => {
        if (!auto_close_enabled || !selected || selected.status !== 'open' || !selected.last_message_at) return null;
        const allMessages = [...selected.messages, ...optimisticMessages];
        const lastMsg = allMessages.at(-1);
        if (!lastMsg || lastMsg.direction !== 'out' || lastMsg.status === 'failed') return null;
        return new Date(selected.last_message_at).getTime() + auto_close_minutes * 60 * 1000;
    }, [auto_close_enabled, auto_close_minutes, selected?.id, selected?.status, selected?.last_message_at, selected?.messages.length, optimisticMessages.length]);

    // Tick a cada segundo enquanto há timer ativo (conversa selecionada ou lista com conversas abertas).
    const hasOpenInList = auto_close_enabled && conversations.some(c => c.status === 'open');

    useEffect(() => {
        if (inactivityExpiresAt === null && !hasOpenInList) return;
        const interval = setInterval(() => setInactivityTick(t => t + 1), 1000);
        return () => clearInterval(interval);
    }, [inactivityExpiresAt, hasOpenInList]);

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
    }, [inactivityTick, inactivityExpiresAt, selected?.id, selected?.status, selected?.can_act]);

    const selectConversation = (id: number) => {
        router.get(
            route('inbox.show', id),
            {},
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
                ...(selected ? { conversation: selected.id } : {}),
            },
            { preserveState: true, preserveScroll: true },
        );
    };

    const composer = useForm<{ body: string; attachment: File | null; audio: File | null }>({
        body: '',
        attachment: null,
        audio: null,
    });

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

    const submitMessage = () => {
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

        // Mensagem otimista — aparece imediatamente para textos simples.
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
        }

        composer.post(route('inbox.messages.store', selected.id), {
            preserveScroll: true,
            preserveState: true,
            only: ['conversations', 'selected', 'counts'],
            forceFormData: true,
            showProgress: false,
            onProgress: (progress) => {
                if (progress?.percentage !== undefined) {
                    setUploadProgress(Math.round(progress.percentage));
                }
            },
            onError: (errors) => {
                setUploadProgress(null);
                setOptimisticMessages((prev) => prev.filter((m) => m.id !== optimisticId));
                if (isTextOnly) composer.setData('body', originalBody);
                const permissionMessage = 'Conversa atribuída a outro atendente.';
                const normalizedErrors = Object.values(errors).filter(
                    (value): value is string => typeof value === 'string' && value.length > 0,
                );
                const firstError = normalizedErrors[0];

                if (!firstError) {
                    return;
                }

                if (firstError === permissionMessage) {
                    toast.error(permissionMessage);
                    return;
                }

                toast.error(firstError);
            },
            onSuccess: () => {
                setUploadProgress(null);
                setOptimisticMessages((prev) => prev.filter((m) => m.id !== optimisticId));
                composer.reset('body', 'attachment', 'audio');
                resetComposerMedia();
            },
        });

        // Limpa o campo imediatamente após o post() capturar os dados, para não
        // aparecer ao mesmo tempo na barra e na thread.
        if (isTextOnly) composer.setData('body', '');
    };

    const send = (e: SyntheticEvent) => {
        e.preventDefault();
        submitMessage();
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

    const hasTypedBody = composer.data.body.trim().length > 0;
    const hasPendingMedia = Boolean(composer.data.attachment || composer.data.audio);
    const canSubmit = hasTypedBody || hasPendingMedia;
    const canAssignSelected = Boolean(selected?.can_assign);
    const canActSelected = Boolean(selected?.can_act);
    const canTransferSelected = Boolean(selected?.can_transfer);
    const canForceCloseSelected = Boolean(selected?.can_force_close);
    const isAssignedToCurrentUser = selected?.assigned_user_id === currentUser.id;
    const composerErrors = composer.errors as Record<string, string | undefined>;

    const filters = [
        { key: 'all', label: 'Todas', title: 'Todas as conversas', Icon: MessageSquare },
        { key: 'bot', label: 'Auto', title: 'Conversas em automação', count: counts.bot, Icon: Bot },
        { key: 'queued', label: 'Fila', title: 'Conversas na fila', count: counts.queued, Icon: Clock },
        { key: 'mine', label: 'Minhas', title: 'Minhas conversas', count: counts.mine, Icon: UserCheck },
        { key: 'open', label: 'Atend.', title: 'Conversas em atendimento', Icon: UserRound },
    ];

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
                        <div className="flex min-h-0 flex-col border-r border-ink/[0.08]">
                            <div className="flex h-16 items-center border-b border-ink/[0.08] px-2">
                                <div className="grid w-full grid-cols-5 gap-1 rounded-2xl border border-ink/[0.08] bg-white p-1 shadow-sm dark:bg-ink/[0.03]">
                                    {filters.map((f) => {
                                        const active = filter === f.key;

                                        return (
                                            <button
                                                key={f.key}
                                                type="button"
                                                title={f.title}
                                                aria-pressed={active}
                                                onClick={() => changeFilter(f.key)}
                                                className={cn(
                                                    'relative flex h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-semibold leading-none text-ink/50 transition-all hover:bg-ink/[0.04] hover:text-ink/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30',
                                                    active &&
                                                        'bg-accent text-white shadow-[0_6px_16px_rgb(var(--accent-rgb)/0.22)] hover:bg-accent hover:text-white dark:text-black dark:hover:text-black',
                                                )}
                                            >
                                                <f.Icon className="h-4 w-4" />
                                                <span className="max-w-full truncate px-0.5">{f.label}</span>
                                                {Boolean(f.count) && (
                                                    <span
                                                        className={cn(
                                                            'absolute right-1 top-1 min-w-4 rounded-full bg-accent/10 px-1 text-[9px] font-bold leading-4 text-accent',
                                                            active && 'bg-white/20 text-white dark:bg-black/10 dark:text-black',
                                                        )}
                                                    >
                                                        {f.count}
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            <div
                                className={cn(
                                    'grid items-center gap-2 border-b border-ink/[0.08] bg-ink/[0.015] px-2 py-2',
                                    sectors.length > 0 && users.length > 0
                                        ? 'grid-cols-[minmax(0,1fr)_minmax(0,1fr)_3rem]'
                                        : 'grid-cols-[minmax(0,1fr)_3rem]',
                                )}
                            >
                                    {sectors.length > 0 && (
                                        <Select
                                            value={sector_id?.toString() ?? 'all'}
                                            onValueChange={changeSector}
                                        >
                                            <SelectTrigger className="h-11 min-w-0 overflow-hidden rounded-xl border-ink/[0.1] bg-white px-2.5 py-1.5 text-left shadow-sm focus:border-accent/50 focus:ring-accent/20 dark:bg-ink/[0.04]">
                                                <div className="min-w-0 flex-1 overflow-hidden">
                                                    <span className="block text-[9px] font-bold uppercase leading-none tracking-[0.08em] text-ink/35">
                                                        Setor
                                                    </span>
                                                    <SelectValue
                                                        className="mt-1 block truncate text-xs font-semibold text-ink/85"
                                                        placeholder="Todos"
                                                    />
                                                </div>
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Todos</SelectItem>
                                                {sectors.map((s) => (
                                                    <SelectItem key={s.id} value={s.id.toString()}>
                                                        {s.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                    {users.length > 0 && (
                                        <Select
                                            value={user_id?.toString() ?? 'all'}
                                            onValueChange={changeUser}
                                        >
                                            <SelectTrigger className="h-11 min-w-0 overflow-hidden rounded-xl border-ink/[0.1] bg-white px-2.5 py-1.5 text-left shadow-sm focus:border-accent/50 focus:ring-accent/20 dark:bg-ink/[0.04]">
                                                <div className="min-w-0 flex-1 overflow-hidden">
                                                    <span className="block text-[9px] font-bold uppercase leading-none tracking-[0.08em] text-ink/35">
                                                        Atendente
                                                    </span>
                                                    <SelectValue
                                                        className="mt-1 block truncate text-xs font-semibold text-ink/85"
                                                        placeholder="Todos"
                                                    />
                                                </div>
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Todos</SelectItem>
                                                {users.map((u) => (
                                                    <SelectItem key={u.id} value={u.id.toString()}>
                                                        {u.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                <button
                                    onClick={changeSort}
                                    aria-label={sort === 'newest' ? 'Mais recentes primeiro. Clique para inverter.' : 'Mais antigas primeiro. Clique para inverter.'}
                                    title={sort === 'newest' ? 'Mais recentes primeiro — clique para inverter' : 'Mais antigas primeiro — clique para inverter'}
                                    className={cn(
                                        'flex h-11 w-12 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border text-[9px] font-bold uppercase leading-none transition-colors',
                                        sort === 'oldest'
                                            ? 'border-accent/25 bg-accent/15 text-accent'
                                            : 'border-ink/[0.08] bg-canvas text-ink/50 shadow-sm hover:bg-ink/[0.06] hover:text-ink/80',
                                    )}
                                >
                                    <ArrowDownUp className="h-3.5 w-3.5" />
                                    {sort === 'newest' ? 'Novo' : 'Antigo'}
                                </button>
                            </div>
                            <div className="scrollbar-thin flex-1 overflow-y-auto">
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
                                            <div className="absolute -bottom-1 -left-2 flex h-7 w-7 items-center justify-center rounded-full border border-ink/[0.08] bg-canvas text-ink/50 shadow-sm">
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

                                        <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-ink/[0.08] bg-ink/[0.03] px-3 py-1.5 text-[11px] font-medium text-ink/45">
                                            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                                            Aguardando mensagens
                                        </div>
                                    </div>
                                )}
                                {conversations.map((c) => {
                                    const preview = mediaPreview(c);
                                    const PreviewIcon = preview?.icon;
                                    const contactName = formatClientDisplayName(
                                        c.contact.name,
                                        c.contact.wa_id,
                                    );
                                    const convExpiresAt =
                                        auto_close_enabled && c.status === 'open' && c.last_message_at && c.last_message_direction === 'out'
                                            ? new Date(c.last_message_at).getTime() + auto_close_minutes * 60 * 1000
                                            : null;
                                    const convCountdown =
                                        convExpiresAt !== null
                                            ? Math.max(0, Math.floor((convExpiresAt - Date.now()) / 1000))
                                            : null;

                                    const isSelected = selected?.id === c.id;
                                    const unread = isSelected ? 0 : c.unread_count;

                                    return (
                                        <button
                                            key={c.id}
                                            onClick={() => selectConversation(c.id)}
                                            className={cn(
                                                'group w-full border-b border-ink/[0.07] px-4 py-3 text-left text-ink transition hover:bg-ink/[0.05]',
                                                isSelected && 'bg-accent/10',
                                            )}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className="mt-0.5 h-10 w-10 shrink-0 overflow-hidden rounded-full border border-accent/20 bg-accent/15">
                                                {c.contact.avatar_url ? (
                                                    <img
                                                        src={c.contact.avatar_url}
                                                        alt={contactName}
                                                        className="h-full w-full object-cover"
                                                        loading="lazy"
                                                    />
                                                ) : (
                                                    <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-accent">
                                                        {initials(contactName)}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center justify-between gap-3">
                                                    <span className={cn("truncate font-medium", unread > 0 && "font-semibold")}>
                                                        {contactName}
                                                    </span>
                                                    <div className="flex shrink-0 items-center gap-1.5">
                                                        {convCountdown !== null ? (
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
                                                <div className={cn("text-sm text-ink/48", preview && PreviewIcon ? "flex items-center overflow-hidden" : "line-clamp-1")}>
                                                    {preview && PreviewIcon ? (
                                                        <span className="inline-flex items-center gap-1.5 font-medium text-ink/62">
                                                            <PreviewIcon className="h-3.5 w-3.5" />
                                                            {preview.label}
                                                        </span>
                                                    ) : (
                                                        c.last_message ?? '—'
                                                    )}
                                                </div>
                                            </div>
                                            </div>

                                            <div className="mt-2 flex w-full flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-medium leading-none">
                                                    {c.channel_type === 'telegram' ? (
                                                        <span className="inline-flex h-5 shrink-0 items-center gap-1 rounded-full border border-blue-300/60 bg-blue-50 px-2 text-blue-600 dark:border-blue-500/30 dark:bg-blue-950/30 dark:text-blue-400">
                                                            <TelegramIcon className="h-3 w-3" />
                                                            {c.channel_name ?? 'Telegram'}
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex h-5 shrink-0 items-center gap-1 rounded-full border border-green-300/60 bg-green-50 px-2 text-green-600 dark:border-green-500/30 dark:bg-green-950/30 dark:text-green-400">
                                                            <WhatsAppIcon className="h-3 w-3" />
                                                            {c.channel_name ?? 'WhatsApp'}
                                                        </span>
                                                    )}
                                                    {c.status === 'surveying' ? (
                                                        <span className="inline-flex h-5 shrink-0 items-center gap-1 rounded-full border border-violet-300 bg-violet-50 px-2 font-semibold text-violet-700 dark:border-violet-700 dark:bg-violet-950/30 dark:text-violet-400">
                                                            <Star className="h-3 w-3" />
                                                            Pesquisa
                                                        </span>
                                                    ) : c.status === 'bot' ? (
                                                        <span className="inline-flex h-5 shrink-0 items-center gap-1 rounded-full border border-sky-400/45 bg-sky-400/12 px-2 font-semibold text-sky-700 dark:border-sky-400/35 dark:bg-sky-400/12 dark:text-sky-300">
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
                                                    {c.assigned_user && (
                                                        <span
                                                            className="inline-flex h-5 max-w-[15rem] min-w-0 items-center gap-1 text-ink/56"
                                                            title={c.assigned_user.name}
                                                        >
                                                            <UserRound className="h-3 w-3 shrink-0 opacity-60" />
                                                            <span className="min-w-0 truncate">
                                                                {c.assigned_user.name}
                                                            </span>
                                                        </span>
                                                    )}
                                                </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Thread + IXC Panel */}
                        <div className="relative flex min-h-0 overflow-hidden">
                            {!selected && (
                                <div className="flex flex-1 flex-col items-center justify-center text-ink/45">
                                    <MessageSquare className="mb-2 h-10 w-10" />
                                    Selecione uma conversa para começar.
                                </div>
                            )}

                            {selected && (
                                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                                    <div className="flex min-h-16 items-center justify-between border-b border-ink/[0.08] px-3">
                                        <div>
                                            <div className="font-semibold text-ink/90">
                                                {formatClientDisplayName(
                                                    selected.contact.name,
                                                    selected.contact.wa_id,
                                                )}
                                            </div>
                                            <div className="text-xs text-ink/45">
                                                {selected.channel_type === 'telegram'
                                                    ? `ID: ${selected.contact.wa_id}`
                                                    : formatClientPhone(selected.contact.wa_id)}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {/* ── Indicadores (não clicáveis) ── */}
                                            <div className="flex items-center gap-1.5">
                                                {selected.sector && (
                                                    <span className="inline-flex items-center rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
                                                        {selected.sector.name}
                                                    </span>
                                                )}
                                                {selected.channel_type === 'telegram' ? (
                                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600 dark:bg-blue-950/30 dark:text-blue-400">
                                                        <TelegramIcon className="h-3 w-3" />
                                                        {selected.channel_name ?? 'Telegram'}
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-600 dark:bg-green-950/30 dark:text-green-400">
                                                        <WhatsAppIcon className="h-3 w-3" />
                                                        {selected.channel_name ?? 'WhatsApp'}
                                                    </span>
                                                )}
                                                {selected.status === 'surveying' ? (
                                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700 dark:bg-violet-950/30 dark:text-violet-400">
                                                        <Star className="h-3 w-3" />
                                                        Pesquisa
                                                    </span>
                                                ) : selected.status === 'bot' ? (
                                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700 dark:bg-sky-950/30 dark:text-sky-300">
                                                        <Bot className="h-3 w-3" />
                                                        Automação
                                                    </span>
                                                ) : (
                                                    <span className={cn(
                                                        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
                                                        selected.status === 'open'
                                                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                                                            : selected.status === 'queued'
                                                              ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300'
                                                              : 'bg-ink/[0.06] text-ink/50',
                                                    )}>
                                                        {selected.status === 'open' && (
                                                            <span className="relative flex h-2 w-2 shrink-0">
                                                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                                                                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                                                            </span>
                                                        )}
                                                        {STATUS_LABEL[selected.status]}
                                                    </span>
                                                )}
                                                {inactivityCountdown !== null && (
                                                    <span
                                                        className={cn(
                                                            'inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium tabular-nums',
                                                            inactivityCountdown <= 120
                                                                ? 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400'
                                                                : 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400',
                                                        )}
                                                        title="Tempo restante para encerramento automático por inatividade"
                                                    >
                                                        <Clock className="h-3 w-3 shrink-0" />
                                                        {formatCountdown(inactivityCountdown)}
                                                    </span>
                                                )}
                                            </div>

                                            {/* ── Divisor visual + dropdown Ações ── */}
                                            {((canAssignSelected && selected.status !== 'open') ||
                                              (canTransferSelected && (sectors.length > 0 || transfer_users.length > 0)) ||
                                              (canActSelected && selected.status !== 'closed' && selected.status !== 'surveying') ||
                                              (canForceCloseSelected && selected.status !== 'closed')) && (
                                                <>
                                                    <div className="h-5 w-px bg-ink/[0.12]" />
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
                                                <>
                                                    <div className="h-5 w-px bg-ink/[0.12]" />
                                                    <button
                                                        type="button"
                                                        title="Painel IXC"
                                                        onClick={() => { setIxcPanelOpen((v) => !v); setNotesPanelOpen(false); }}
                                                        className={cn(
                                                            'rounded p-1.5 transition-colors',
                                                            ixcPanelOpen
                                                                ? 'bg-accent/10 text-accent'
                                                                : 'text-ink/40 hover:bg-ink/[0.06] hover:text-ink/70',
                                                        )}
                                                    >
                                                        <PanelRight className="h-4 w-4" />
                                                    </button>
                                                </>
                                            )}

                                            {/* ── Notes panel toggle ── */}
                                            {!has_ixc && <div className="h-5 w-px bg-ink/[0.12]" />}
                                            <button
                                                    type="button"
                                                    title="Anotações do cliente"
                                                    onClick={() => { setNotesPanelOpen((v) => !v); setIxcPanelOpen(false); }}
                                                    className={cn(
                                                        'rounded p-1.5 transition-colors',
                                                        notesPanelOpen
                                                            ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
                                                            : 'text-ink/40 hover:bg-ink/[0.06] hover:text-ink/70',
                                                    )}
                                                >
                                                    <StickyNote className="h-4 w-4" />
                                                </button>
                                        </div>
                                    </div>

                                    <div
                                        ref={threadRef}
                                        className="scrollbar-thin flex-1 space-y-2 overflow-y-auto chat-bg p-4"
                                    >
                                        {[...selected.messages, ...optimisticMessages].map((m) => {
                                            const role = messageRole(m);
                                            const roleMeta = MESSAGE_ROLE_META[role];
                                            const isOptimistic = 'optimistic' in m && m.optimistic;
                                            const caption = mediaCaption(m.body, m.type);

                                            return (
                                                <div
                                                    key={m.id}
                                                    className={cn('flex transition-opacity duration-300', roleMeta.row, isOptimistic ? 'opacity-50' : '')}
                                                >
                                                    <div className="relative w-fit max-w-[75%]">
                                                    {role === 'client' ? (
                                                        <svg className="absolute -left-[7px] bottom-0" width="8" height="13" viewBox="0 0 8 13" aria-hidden="true">
                                                            <path d="M 8 0 C 6 6 0 9 0 13 L 8 13 Z" className="fill-white dark:fill-[#142a1b]" />
                                                        </svg>
                                                    ) : role === 'attendant' ? (
                                                        <svg className="absolute -right-[7px] bottom-0" width="8" height="13" viewBox="0 0 8 13" aria-hidden="true">
                                                            <path d="M 0 0 C 2 6 8 9 8 13 L 0 13 Z" className="fill-accent" />
                                                        </svg>
                                                    ) : (
                                                        <svg className="absolute -right-[7px] bottom-0" width="8" height="13" viewBox="0 0 8 13" aria-hidden="true">
                                                            <path d="M 0 0 C 2 6 8 9 8 13 L 0 13 Z" className="fill-amber-50 dark:fill-amber-900" />
                                                        </svg>
                                                    )}
                                                    <div
                                                        className={cn(
                                                            'px-3 py-2 text-sm shadow-sm',
                                                            roleMeta.roundedBubble,
                                                            roleMeta.bubble,
                                                        )}
                                                    >
{m.type === 'image' &&
                                                        m.media_url ? (
                                                            <div className="space-y-2">
                                                                <a
                                                                    href={m.media_url}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                >
                                                                    <img
                                                                        src={m.media_url}
                                                                        alt="Imagem recebida"
                                                                        className="max-h-56 w-auto max-w-[280px] rounded-lg border border-ink/[0.10] bg-black/20 object-contain"
                                                                        loading="lazy"
                                                                    />
                                                                </a>
                                                                {caption && (
                                                                    <p className="whitespace-pre-wrap break-words">
                                                                        {caption}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        ) : m.type === 'video' &&
                                                          m.media_url ? (
                                                            <div className="space-y-2">
                                                                <video
                                                                    controls
                                                                    preload="metadata"
                                                                    src={m.media_url}
                                                                    className="max-h-64 w-[300px] max-w-full rounded-md border bg-black/80"
                                                                />
                                                                {caption && (
                                                                    <p className="whitespace-pre-wrap break-words">
                                                                        {caption}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        ) : m.type === 'audio' &&
                                                          m.media_url ? (
                                                            <div className="space-y-2">
                                                                <audio
                                                                    controls
                                                                    preload="metadata"
                                                                    src={m.media_url}
                                                                    className="h-10 w-[260px] max-w-full"
                                                                />
                                                                {caption && (
                                                                    <p className="whitespace-pre-wrap break-words">
                                                                        {caption}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        ) : m.type === 'document' &&
                                                          m.media_url ? (
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
                                                                    <p className="whitespace-pre-wrap break-words">
                                                                        {caption}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        ) : isMediaMessageType(m.type) ? (
                                                            <div className="inline-flex items-center gap-2 rounded-lg border border-black/[0.12] bg-black/[0.05] px-3 py-2 text-xs opacity-60 dark:border-white/[0.12] dark:bg-white/[0.05]">
                                                                {m.type === 'image' ? <ImageIcon className="h-4 w-4" /> :
                                                                 m.type === 'video' ? <Video className="h-4 w-4" /> :
                                                                 m.type === 'audio' ? <Mic className="h-4 w-4" /> :
                                                                 <FileText className="h-4 w-4" />}
                                                                <span>
                                                                    {m.type === 'image' ? 'Imagem' :
                                                                     m.type === 'video' ? 'Vídeo' :
                                                                     m.type === 'audio' ? 'Áudio' :
                                                                     caption ?? 'Documento'}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <p className="whitespace-pre-wrap break-words">
                                                                {m.body}
                                                            </p>
                                                        )}
                                                        <div
                                                            className={cn(
                                                                'mt-1 flex items-center justify-end gap-1 text-[10px]',
                                                                roleMeta.metaText,
                                                            )}
                                                        >
                                                            {formatTime(m.created_at)}
                                                            {m.direction === 'out' &&
                                                                (m.status === 'sending' ? (
                                                                    <Loader2 className={cn('h-3 w-3 animate-spin', roleMeta.tick)} />
                                                                ) : m.status === 'read' ? (
                                                                    <CheckCheck className={cn('h-3 w-3', roleMeta.tickRead)} />
                                                                ) : m.status === 'delivered' ? (
                                                                    <CheckCheck className={cn('h-3 w-3', roleMeta.tick)} />
                                                                ) : m.status === 'sent' ||
                                                                  m.status === 'accepted' ? (
                                                                    <Check className={cn('h-3 w-3', roleMeta.tick)} />
                                                                ) : null)}
                                                        </div>
                                                    </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {selected.status !== 'closed' && canActSelected ? (
                                        <form
                                            onSubmit={send}
                                            className="space-y-2 border-t border-ink/[0.08] bg-base/20 p-3"
                                        >
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
                                                                disabled={composer.processing}
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
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="icon"
                                                        onClick={() =>
                                                            attachmentInputRef.current?.click()
                                                        }
                                                        disabled={composer.processing}
                                                    >
                                                        <Paperclip />
                                                    </Button>
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
                                                        disabled={composer.processing}
                                                    >
                                                        <Square />
                                                    </Button>
                                                ) : canSubmit ? (
                                                    <Button
                                                        type="submit"
                                                        size="icon"
                                                        disabled={composer.processing}
                                                        className="transition-all duration-200 disabled:scale-95"
                                                    >
                                                        {composer.processing ? (
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
                                                        disabled={composer.processing}
                                                    >
                                                        <Mic />
                                                    </Button>
                                                )}
                                            </div>
                                        </form>
                                    ) : selected.status === 'closed' ? (
                                        <div className="border-t border-ink/[0.08] p-3 text-center text-sm text-ink/45">
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
                                        <div className="border-t border-ink/[0.08] p-3 text-center text-sm text-ink/45">
                                            {canAssignSelected || isAssignedToCurrentUser
                                                ? 'Assuma a conversa para enviar mensagens.'
                                                : 'Conversa atribuída a outro atendente.'}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* IXC side panel */}
                            {ixcPanelOpen && selected && ixcContact && (
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
                            )}

                            {/* Notes side panel */}
                            {notesPanelOpen && selected && (
                                <NotesPanel
                                    key={selected.contact.id}
                                    contactId={selected.contact.id}
                                    initialNotes={selected.contact.notes}
                                    onClose={() => setNotesPanelOpen(false)}
                                />
                            )}
                        </div>
            </div>

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
