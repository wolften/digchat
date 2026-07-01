import { UserAvatar } from '@/Components/UserAvatar';
import { Badge } from '@/Components/ui/badge';
import { formatDuration } from '@/lib/formatDuration';
import { router } from '@inertiajs/react';
import {
    Bot,
    Clock,
    ExternalLink,
    History,
    MessageSquare,
    Star,
    X,
} from 'lucide-react';

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
        <path d="M21 2H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h7v2H8v2h8v-2h-2v-2h7c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H3V4h18v12z" />
    </svg>
);

type Status = 'bot' | 'queued' | 'open' | 'closed' | 'surveying' | 'snoozed';

interface HistoryItem {
    id: number;
    protocol_number: string | null;
    status: Status;
    channel_type: 'whatsapp' | 'telegram' | 'web' | null;
    channel_name: string | null;
    assigned_user: { id: number; name: string; profile_photo_url?: string | null } | null;
    sector: { id: number; name: string } | null;
    bot_only: boolean;
    duration_minutes: number | null;
    csat_score: number | null;
    survey_completed: boolean;
    message_count: number;
    created_at: string | null;
    last_message_at: string | null;
    last_message_preview: string | null;
}

interface ContactHistory {
    total: number;
    items: HistoryItem[];
}

interface Props {
    contactId: number;
    anchorConversationId: number;
    history: ContactHistory;
    onClose: () => void;
}

const STATUS_LABEL: Record<Status, string> = {
    bot: 'Automação',
    queued: 'Na fila',
    open: 'Em atendimento',
    closed: 'Encerrada',
    surveying: 'Pesquisa',
    snoozed: 'Adiada',
};

function ChannelIcon({ type, className }: { type: HistoryItem['channel_type']; className?: string }) {
    if (type === 'telegram') return <TelegramIcon className={className} />;
    if (type === 'web') return <WebIcon className={className} />;
    return <WhatsAppIcon className={className} />;
}

function formatDateTime(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function previewText(item: HistoryItem): string {
    if (item.last_message_preview) {
        return item.last_message_preview;
    }
    return `${item.message_count} mensagem${item.message_count === 1 ? '' : 'ens'}`;
}

export default function ContactHistoryPanel({
    contactId,
    anchorConversationId,
    history,
    onClose,
}: Props) {
    const openInHistorico = (item: HistoryItem) => {
        router.visit(
            route('historico.index', {
                conversation: item.id,
                contact_id: contactId,
                anchor: anchorConversationId,
            }),
        );
    };

    return (
        <div className="flex h-full w-full shrink-0 flex-col border-l border-ink/[0.08] md:h-auto md:w-80">
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-ink/[0.08] px-4">
                <div className="flex min-w-0 items-center gap-2.5">
                    <History className="h-4 w-4 shrink-0 text-ink/50" />
                    <div className="min-w-0">
                        <span className="block text-sm font-semibold text-ink/90">Histórico</span>
                        <span className="block truncate text-[11px] text-ink/45">
                            {history.total === 0
                                ? 'Nenhum anterior'
                                : `${history.total} anterior${history.total === 1 ? '' : 'es'}`}
                        </span>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="shrink-0 rounded-lg p-1.5 text-ink/40 transition-colors hover:bg-ink/[0.06] hover:text-ink/70"
                >
                    <X className="h-3.5 w-3.5" />
                </button>
            </div>

            <div className="scrollbar-thin flex-1 overflow-y-auto p-2">
                {history.items.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-ink/45">
                        <MessageSquare className="h-8 w-8 text-ink/20" />
                        <p>Nenhum atendimento anterior.</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {history.items.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => openInHistorico(item)}
                                className="w-full overflow-hidden rounded-xl border border-ink/[0.08] bg-base/40 px-3 py-2.5 text-left transition-colors hover:border-ink/[0.14] hover:bg-ink/[0.03]"
                            >
                                <div className="flex items-start gap-2">
                                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-ink/[0.05] text-ink/55">
                                        <ChannelIcon type={item.channel_type} className="h-3.5 w-3.5" />
                                    </div>

                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5">
                                            <span className="truncate font-mono text-[11px] font-medium text-ink/70">
                                                #{item.protocol_number ?? item.id}
                                            </span>
                                            <ExternalLink className="ml-auto h-3.5 w-3.5 shrink-0 text-ink/35" />
                                        </div>

                                        <p className="mt-0.5 text-[11px] text-ink/45">
                                            {formatDateTime(item.created_at)}
                                        </p>

                                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                            <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                                                {STATUS_LABEL[item.status]}
                                            </Badge>
                                            {item.bot_only ? (
                                                <span className="inline-flex items-center gap-1 text-[10px] text-ink/45">
                                                    <Bot className="h-3 w-3" />
                                                    Bot
                                                </span>
                                            ) : item.assigned_user ? (
                                                <span className="inline-flex items-center gap-1 text-[10px] text-ink/55">
                                                    <UserAvatar
                                                        name={item.assigned_user.name}
                                                        photoUrl={item.assigned_user.profile_photo_url}
                                                        size="xs"
                                                        className="h-4 w-4 text-[8px]"
                                                    />
                                                    <span className="max-w-[88px] truncate">{item.assigned_user.name}</span>
                                                </span>
                                            ) : null}
                                            {item.sector && (
                                                <span className="truncate text-[10px] text-ink/45">
                                                    {item.sector.name}
                                                </span>
                                            )}
                                        </div>

                                        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-ink/40">
                                            {item.duration_minutes !== null && (
                                                <span className="inline-flex items-center gap-1">
                                                    <Clock className="h-3 w-3" />
                                                    {formatDuration(item.duration_minutes)}
                                                </span>
                                            )}
                                            {item.survey_completed && item.csat_score !== null && (
                                                <span className="inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-400">
                                                    <Star className="h-3 w-3 fill-current" />
                                                    {item.csat_score}
                                                </span>
                                            )}
                                            <span>{item.message_count} msg</span>
                                        </div>

                                        <p className="mt-1.5 line-clamp-2 text-[11px] text-ink/55">
                                            {previewText(item)}
                                        </p>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}

                {history.total > history.items.length && (
                    <p className="px-2 py-3 text-center text-[10px] text-ink/35">
                        Exibindo os {history.items.length} atendimentos mais recentes de {history.total}.
                    </p>
                )}
            </div>
        </div>
    );
}