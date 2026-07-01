import { ChatMessage } from '@/Components/ChatMessage';
import { ChatThread, MessageScrollerItem } from '@/Components/ChatThread';
import { Button } from '@/Components/ui/button';
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
} from '@/Components/ui/context-menu';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/Components/ui/dialog';
import { Input } from '@/Components/ui/input';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import {
    InternalChatMessage,
    InternalConversationDetail,
    InternalConversationSummary,
    useInternalChatRealtime,
} from '@/hooks/useInternalChatRealtime';
import { useInternalChatTyping } from '@/hooks/useInternalChatTyping';
import { cn } from '@/lib/utils';
import { PageProps } from '@/types';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import {
    ArrowDownUp,
    ArrowLeft,
    Check,
    CheckCheck,
    Eye,
    MessageSquarePlus,
    Search,
    Send,
    Users,
    X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type ChatUser = { id: number; name: string };

type SeenByViewer = { user_id: number; name: string; seen_at: string | null };
type SeenByResponse = { viewers: SeenByViewer[]; pending: SeenByViewer[] };

interface Props {
    conversations: InternalConversationSummary[];
    selected: InternalConversationDetail | null;
    users: ChatUser[];
}

function abbr(name: string): string {
    return name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => p[0])
        .join('')
        .toUpperCase();
}

function fmtTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function fmtListTime(iso: string | null | undefined): string {
    if (!iso) return '';
    const date = new Date(iso);
    const now = new Date();
    const sameDay =
        date.getDate() === now.getDate() &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear();
    if (sameDay) return fmtTime(iso);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function isReadByOther(
    message: InternalChatMessage,
    otherLastReadAt: string | null | undefined,
): boolean {
    if (!otherLastReadAt) return false;
    return new Date(otherLastReadAt) >= new Date(message.created_at);
}

type ConversationSort = 'newest' | 'oldest';

function matchesInternalListSearch(
    conversation: InternalConversationSummary,
    query: string,
): boolean {
    const q = query.trim().toLowerCase();
    if (!q) return true;

    const preview =
        conversation.type === 'general' && conversation.last_message_user_name
            ? `${conversation.last_message_user_name}: ${conversation.last_message ?? ''}`
            : (conversation.last_message ?? '');

    const haystack = [
        conversation.title,
        conversation.last_message,
        conversation.last_message_user_name,
        conversation.other_user?.name,
        preview,
        conversation.type === 'general' ? 'geral chat geral' : 'direta',
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

    return haystack.includes(q);
}

function sortConversationList(
    items: InternalConversationSummary[],
    order: ConversationSort,
): InternalConversationSummary[] {
    return [...items].sort((a, b) => {
        if (a.type === 'general') return -1;
        if (b.type === 'general') return 1;
        const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
        const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
        return order === 'newest' ? bTime - aTime : aTime - bTime;
    });
}

export default function Index({ conversations: initialConversations, selected, users }: Props) {
    const { auth } = usePage<PageProps>().props;
    const me = auth.user;
    const canViewReceipts = me.role === 'admin' || me.role === 'gestor';

    const [conversations, setConversations] = useState(initialConversations);
    const [active, setActive] = useState<InternalConversationDetail | null>(selected);
    const [newChatOpen, setNewChatOpen] = useState(false);
    const [userSearch, setUserSearch] = useState('');
    const [sending, setSending] = useState(false);
    const [body, setBody] = useState('');
    const [mobileShowThread, setMobileShowThread] = useState(!!selected);
    const [sort, setSort] = useState<ConversationSort>('newest');
    const [listSearch, setListSearch] = useState('');
    const [seenByTarget, setSeenByTarget] = useState<InternalChatMessage | null>(null);
    const [seenByData, setSeenByData] = useState<SeenByResponse | null>(null);
    const [seenByLoading, setSeenByLoading] = useState(false);
    const [contextMenuGeneration, setContextMenuGeneration] = useState(0);


    const inputRef = useRef<HTMLTextAreaElement>(null);

    const directForm = useForm({ user_id: 0 });

    useEffect(() => {
        setConversations(initialConversations);
    }, [initialConversations]);

    useEffect(() => {
        setActive(selected);
        setMobileShowThread(!!selected);
        if (selected) {
            setConversations((prev) =>
                prev.map((c) => (c.id === selected.id ? { ...c, unread_count: 0 } : c)),
            );
        }
    }, [selected]);

    useEffect(() => {
        if (active) {
            setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 60);
        }
    }, [active?.id]);

    const filteredUsers = useMemo(() => {
        const q = userSearch.trim().toLowerCase();
        if (!q) return users;
        return users.filter((u) => u.name.toLowerCase().includes(q));
    }, [users, userSearch]);

    const openConversation = useCallback((conversationId: number) => {
        router.visit(route('chat-interno.show', conversationId), {
            preserveScroll: true,
        });
    }, []);

    const handleMessage = useCallback(
        (conversationId: number, message: InternalChatMessage) => {
            setActive((prev) => {
                if (!prev || prev.id !== conversationId) return prev;
                if (prev.messages.some((m) => m.id === message.id)) return prev;
                return { ...prev, messages: [...prev.messages, message] };
            });

            setConversations((prev) =>
                prev.map((c) => {
                    if (c.id !== conversationId) return c;
                    return {
                        ...c,
                        last_message: message.body,
                        last_message_user_name: message.user_name,
                        last_message_at: message.created_at,
                    };
                }),
            );
        },
        [],
    );

    const handleConversationUpdated = useCallback(
        (patch: {
            id: number;
            last_message?: string | null;
            last_message_user_name?: string | null;
            last_message_at?: string | null;
        }) => {
            setConversations((prev) => {
                const exists = prev.some((c) => c.id === patch.id);
                if (!exists) {
                    router.reload({ only: ['conversations'] });
                    return prev;
                }
                const updated = prev.map((c) =>
                    c.id === patch.id
                        ? {
                              ...c,
                              last_message: patch.last_message ?? c.last_message,
                              last_message_user_name:
                                  patch.last_message_user_name ?? c.last_message_user_name,
                              last_message_at: patch.last_message_at ?? c.last_message_at,
                          }
                        : c,
                );
                return sortConversationList(updated, sort);
            });
        },
        [sort],
    );

    const handleConversationRead = useCallback(
        (conversationId: number, userId: number, lastReadAt: string) => {
            if (userId === me.id) return;
            setActive((prev) => {
                if (!prev || prev.id !== conversationId) return prev;
                return { ...prev, other_last_read_at: lastReadAt };
            });
            setConversations((prev) =>
                prev.map((c) =>
                    c.id === conversationId ? { ...c, other_last_read_at: lastReadAt } : c,
                ),
            );
        },
        [me.id],
    );

    const handleUnreadBump = useCallback((conversationId: number) => {
        setConversations((prev) =>
            prev.map((c) =>
                c.id === conversationId ? { ...c, unread_count: c.unread_count + 1 } : c,
            ),
        );
    }, []);

    useInternalChatRealtime({
        currentUserId: me.id,
        activeConversationId: active?.id ?? null,
        onMessage: handleMessage,
        onConversationUpdated: handleConversationUpdated,
        onConversationRead: handleConversationRead,
        onUnreadBump: handleUnreadBump,
    });

    const { typingLabel, notifyTyping, stopTyping } = useInternalChatTyping(
        me.id,
        active?.id ?? null,
    );

    const send = async () => {
        const text = body.trim();
        if (!text || sending || !active) return;
        stopTyping(active.id);
        setSending(true);
        setBody('');
        try {
            const { data } = await window.axios.post<InternalChatMessage>(
                route('chat-interno.messages.store', active.id),
                { body: text },
            );
            handleMessage(active.id, data);
        } catch {
            setBody(text);
        }
        setSending(false);
    };

    const startDirectChat = (userId: number) => {
        directForm.setData('user_id', userId);
        directForm.post(route('chat-interno.direct'), {
            preserveScroll: true,
            onSuccess: () => {
                setNewChatOpen(false);
                setUserSearch('');
            },
        });
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            void send();
        }
    };

    const visibleConversations = useMemo(() => {
        const filtered = conversations.filter((conversation) =>
            matchesInternalListSearch(conversation, listSearch),
        );
        return sortConversationList(filtered, sort);
    }, [conversations, listSearch, sort]);

    const changeSort = () => {
        setSort((prev) => (prev === 'newest' ? 'oldest' : 'newest'));
    };

    const openSeenBy = useCallback((conversationId: number, message: InternalChatMessage) => {
        setSeenByTarget(message);
        setSeenByData(null);
        setSeenByLoading(true);
        window.axios
            .get<SeenByResponse>(route('chat-interno.messages.seen-by', [conversationId, message.id]))
            .then(({ data }) => setSeenByData(data))
            .catch(() => setSeenByData({ viewers: [], pending: [] }))
            .finally(() => setSeenByLoading(false));
    }, []);

    return (
        <AuthenticatedLayout
            header={
                <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-ink/82">Chat Interno</h2>
                </div>
            }
        >
            <Head title="Chat Interno" />

            <div className="min-h-0 flex-1 grid grid-cols-1 overflow-hidden md:grid-cols-[340px_1fr]">
                {/* Lista de conversas */}
                <aside
                    className={cn(
                        'relative flex min-h-0 min-w-0 flex-col overflow-hidden border-r border-accent/10 bg-canvas/50',
                        mobileShowThread && active ? 'hidden md:flex' : 'flex',
                    )}
                >
                    <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
                        <div className="sticky top-0 z-10 space-y-2 border-b border-accent/10 bg-canvas/50 px-3 py-2">
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-sm font-semibold text-ink/70">Conversas</span>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="h-8 shrink-0 gap-1.5 text-xs"
                                    onClick={() => setNewChatOpen(true)}
                                >
                                    <MessageSquarePlus className="h-3.5 w-3.5" />
                                    Nova
                                </Button>
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
                        </div>

                        {conversations.length === 0 && (
                            <p className="px-4 py-8 text-center text-xs text-ink/30">
                                Nenhuma conversa ainda
                            </p>
                        )}
                        {conversations.length > 0 && visibleConversations.length === 0 && (
                            <div className="flex min-h-[200px] flex-col items-center justify-center px-6 py-10 text-center">
                                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-accent/15 bg-accent/10 text-accent">
                                    <Search className="h-4 w-4" />
                                </div>
                                <p className="text-sm font-medium text-ink/70">
                                    Nenhuma conversa encontrada
                                </p>
                                <p className="mt-1 max-w-[220px] text-xs leading-5 text-ink/45">
                                    Tente outro nome ou trecho da última mensagem.
                                </p>
                            </div>
                        )}
                        {visibleConversations.map((conv) => {
                            const isActive = active?.id === conv.id;
                            const preview = conv.last_message
                                ? conv.type === 'general' && conv.last_message_user_name
                                    ? `${conv.last_message_user_name}: ${conv.last_message}`
                                    : conv.last_message
                                : 'Sem mensagens';

                            return (
                                <button
                                    key={conv.id}
                                    type="button"
                                    onClick={() => openConversation(conv.id)}
                                    className={cn(
                                        'flex w-full items-start gap-3 border-b border-accent/5 px-4 py-3 text-left transition hover:bg-ink/[0.04]',
                                        isActive && 'bg-accent/10',
                                    )}
                                >
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/20 text-xs font-bold text-accent">
                                        {conv.type === 'general' ? (
                                            <Users className="h-4 w-4" />
                                        ) : (
                                            abbr(conv.title)
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="truncate text-sm font-medium text-ink/85">
                                                {conv.title}
                                            </span>
                                            <span className="shrink-0 text-[10px] text-ink/35">
                                                {fmtListTime(conv.last_message_at)}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="truncate text-xs text-ink/45">{preview}</p>
                                            {conv.unread_count > 0 && (
                                                <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-canvas dark:text-black">
                                                    {conv.unread_count > 99
                                                        ? '99+'
                                                        : conv.unread_count}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                        <button
                            type="button"
                            onClick={changeSort}
                            aria-label={
                                sort === 'newest'
                                    ? 'Mais recentes primeiro. Clique para inverter.'
                                    : 'Mais antigas primeiro. Clique para inverter.'
                            }
                            title={
                                sort === 'newest'
                                    ? 'Mais recentes primeiro — clique para inverter'
                                    : 'Mais antigas primeiro — clique para inverter'
                            }
                            className={cn(
                                'absolute bottom-4 right-4 flex h-9 w-9 items-center justify-center rounded-full border border-accent/30 bg-canvas text-accent shadow-md transition-colors hover:border-accent/50',
                                sort === 'oldest' && 'border-accent/60 bg-accent/10',
                            )}
                        >
                            <ArrowDownUp className="h-3.5 w-3.5 text-accent" />
                        </button>
                    </div>
                </aside>

                {/* Thread */}
                <section
                    className={cn(
                        'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden',
                        !mobileShowThread || !active ? 'hidden md:flex' : 'flex',
                    )}
                >
                    {active ? (
                        <>
                            <div className="flex h-16 shrink-0 items-center gap-3 border-b border-accent/10 px-4">
                                <button
                                    type="button"
                                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink/50 transition hover:bg-ink/[0.07] md:hidden"
                                    onClick={() => setMobileShowThread(false)}
                                >
                                    <ArrowLeft className="h-4 w-4" />
                                </button>
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/20 text-xs font-bold text-accent">
                                    {active.type === 'general' ? (
                                        <Users className="h-4 w-4" />
                                    ) : (
                                        abbr(active.title)
                                    )}
                                </div>
                                <div className="min-w-0 flex-1 leading-tight">
                                    <p className="truncate text-sm font-semibold text-ink/85">
                                        {active.title}
                                    </p>
                                    <p className="truncate text-[11px] text-ink/45">
                                        {active.type === 'direct'
                                            ? 'Conversa direta'
                                            : 'Canal compartilhado'}
                                    </p>
                                </div>
                            </div>

                            <ChatThread contentClassName="gap-3">
                                {active.messages.length === 0 && (
                                    <p className="pt-8 text-center text-xs text-ink/30">
                                        Nenhuma mensagem ainda. Diga olá!
                                    </p>
                                )}
                                {active.messages.map((msg, index, messages) => {
                                    const isMe = msg.user_id === me.id;
                                    const showReceipt =
                                        isMe &&
                                        active.type === 'direct' &&
                                        isReadByOther(msg, active.other_last_read_at);

                                    const bubble = (
                                        <ChatMessage
                                            align={isMe ? 'end' : 'start'}
                                            variant={isMe ? 'outgoing-accent' : 'incoming-muted'}
                                            avatar={
                                                !isMe ? (
                                                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/20 text-[10px] font-bold text-accent">
                                                        {abbr(msg.user_name)}
                                                    </div>
                                                ) : undefined
                                            }
                                            header={
                                                !isMe && active.type === 'general'
                                                    ? msg.user_name
                                                    : undefined
                                            }
                                            footer={
                                                <>
                                                    <span
                                                        className={cn(
                                                            isMe &&
                                                                'text-ink/70 dark:text-white/75',
                                                        )}
                                                    >
                                                        {fmtTime(msg.created_at)}
                                                    </span>
                                                    {isMe && active.type === 'direct' && (
                                                        showReceipt ? (
                                                            <CheckCheck className="h-3 w-3 text-blue-400 dark:text-blue-300" />
                                                        ) : (
                                                            <Check
                                                                className={cn(
                                                                    'h-3 w-3',
                                                                    'text-ink/70 dark:text-white/75',
                                                                )}
                                                            />
                                                        )
                                                    )}
                                                </>
                                            }
                                        >
                                            {msg.body}
                                        </ChatMessage>
                                    );

                                    const content = !canViewReceipts ? (
                                        bubble
                                    ) : (
                                        <ContextMenu key={`${msg.id}-${contextMenuGeneration}`}>
                                            <ContextMenuTrigger asChild>
                                                <div className="min-w-0">{bubble}</div>
                                            </ContextMenuTrigger>
                                            <ContextMenuContent>
                                                <ContextMenuItem
                                                    onSelect={() => {
                                                        window.setTimeout(
                                                            () => openSeenBy(active.id, msg),
                                                            0,
                                                        );
                                                    }}
                                                >
                                                    <Eye className="h-3.5 w-3.5" />
                                                    Ver quem visualizou
                                                </ContextMenuItem>
                                            </ContextMenuContent>
                                        </ContextMenu>
                                    );

                                    return (
                                        <MessageScrollerItem
                                            key={msg.id}
                                            messageId={String(msg.id)}
                                            scrollAnchor={index === messages.length - 1}
                                        >
                                            {content}
                                        </MessageScrollerItem>
                                    );
                                })}
                            </ChatThread>

                            <div className="flex shrink-0 flex-col border-t border-accent/10">
                                {typingLabel && (
                                    <div className="flex items-center gap-1.5 px-4 pb-1 pt-2 text-xs text-ink/60">
                                        <span className="inline-flex gap-0.5">
                                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent [animation-delay:0ms]" />
                                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent [animation-delay:150ms]" />
                                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent [animation-delay:300ms]" />
                                        </span>
                                        <span>{typingLabel}</span>
                                    </div>
                                )}
                                <div className="flex items-end gap-2 p-3">
                                <textarea
                                    ref={inputRef}
                                    value={body}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        setBody(value);
                                        if (!active) return;
                                        if (value.trim()) {
                                            notifyTyping(active.id);
                                        } else {
                                            stopTyping(active.id);
                                        }
                                    }}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Escreva uma mensagem..."
                                    rows={1}
                                    className="scrollbar-thin min-h-11 flex-1 resize-none rounded-xl border border-accent/20 bg-transparent px-3 py-2.5 text-sm leading-5 text-ink placeholder-ink/30 outline-none focus:border-accent/50"
                                    style={{ maxHeight: '120px' }}
                                />
                                <button
                                    type="button"
                                    onClick={() => void send()}
                                    disabled={!body.trim() || sending}
                                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-canvas transition hover:bg-accent/90 disabled:opacity-40 dark:text-black"
                                >
                                    <Send className="h-4 w-4" />
                                </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="hidden h-16 shrink-0 items-center border-b border-accent/10 px-4 md:flex">
                                <span className="text-sm font-semibold text-ink/40">
                                    Mensagens
                                </span>
                            </div>
                            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
                            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-accent">
                                <Users className="h-7 w-7" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-ink/70">
                                    Selecione uma conversa
                                </p>
                                <p className="mt-1 text-xs text-ink/40">
                                    Converse com a equipe ou inicie um chat direto
                                </p>
                            </div>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="gap-1.5"
                                onClick={() => setNewChatOpen(true)}
                            >
                                <MessageSquarePlus className="h-4 w-4" />
                                Nova conversa
                            </Button>
                        </div>
                        </>
                    )}
                </section>
            </div>

            <Dialog open={newChatOpen} onOpenChange={setNewChatOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Nova conversa</DialogTitle>
                    </DialogHeader>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/30" />
                        <Input
                            value={userSearch}
                            onChange={(e) => setUserSearch(e.target.value)}
                            placeholder="Buscar usuário..."
                            className="pl-9"
                        />
                    </div>
                    <div className="scrollbar-thin max-h-64 space-y-1 overflow-y-auto">
                        {filteredUsers.length === 0 && (
                            <p className="py-6 text-center text-xs text-ink/40">
                                Nenhum usuário encontrado
                            </p>
                        )}
                        {filteredUsers.map((user) => (
                            <button
                                key={user.id}
                                type="button"
                                disabled={directForm.processing}
                                onClick={() => startDirectChat(user.id)}
                                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-ink/[0.05] disabled:opacity-50"
                            >
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/20 text-xs font-bold text-accent">
                                    {abbr(user.name)}
                                </div>
                                <span className="text-sm font-medium text-ink/80">{user.name}</span>
                            </button>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog
                open={!!seenByTarget}
                onOpenChange={(open) => {
                    if (!open) {
                        setSeenByTarget(null);
                        setSeenByData(null);
                        setContextMenuGeneration((n) => n + 1);
                    }
                }}
            >
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Visualizações</DialogTitle>
                    </DialogHeader>
                    {seenByTarget && (
                        <p className="-mt-2 truncate text-xs text-ink/40">
                            &ldquo;{seenByTarget.body}&rdquo;
                        </p>
                    )}
                    {seenByLoading ? (
                        <p className="py-6 text-center text-xs text-ink/40">Carregando...</p>
                    ) : (
                        <div className="scrollbar-thin max-h-72 space-y-4 overflow-y-auto">
                            <div>
                                <p className="mb-2 text-xs font-semibold text-ink/50">
                                    Visualizou ({seenByData?.viewers.length ?? 0})
                                </p>
                                {seenByData?.viewers.length ? (
                                    <ul className="space-y-2">
                                        {seenByData.viewers.map((viewer) => (
                                            <li
                                                key={viewer.user_id}
                                                className="flex items-center justify-between gap-2"
                                            >
                                                <span className="flex items-center gap-2 text-sm text-ink/80">
                                                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/20 text-[10px] font-bold text-accent">
                                                        {abbr(viewer.name)}
                                                    </span>
                                                    {viewer.name}
                                                </span>
                                                <span className="shrink-0 text-[11px] text-ink/40">
                                                    {fmtListTime(viewer.seen_at)}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-xs text-ink/35">Ninguém visualizou ainda</p>
                                )}
                            </div>
                            {!!seenByData?.pending.length && (
                                <div>
                                    <p className="mb-2 text-xs font-semibold text-ink/50">
                                        Ainda não visualizou ({seenByData.pending.length})
                                    </p>
                                    <ul className="space-y-2">
                                        {seenByData.pending.map((viewer) => (
                                            <li
                                                key={viewer.user_id}
                                                className="flex items-center gap-2 text-sm text-ink/45"
                                            >
                                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink/[0.08] text-[10px] font-bold text-ink/40">
                                                    {abbr(viewer.name)}
                                                </span>
                                                {viewer.name}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </AuthenticatedLayout>
    );
}