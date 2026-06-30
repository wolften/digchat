import { cn } from '@/lib/utils';
import { PageProps } from '@/types';
import { usePage } from '@inertiajs/react';
import { MessageCircle, Send, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface ChatMessage {
    id: number;
    body: string;
    user_id: number;
    user_name: string;
    created_at: string;
}

function playPing() {
    try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.22, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
        osc.start();
        osc.stop(ctx.currentTime + 0.28);
    } catch {}
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

export function InternalChat() {
    const { auth } = usePage<PageProps>().props;
    const me = auth.user;

    const lsSeenKey = `internal-chat-last-seen-${me.id}`;
    const lsUnreadKey = `internal-chat-unread-${me.id}`;

    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [body, setBody] = useState('');
    // Initialise from localStorage so the badge sobrevive re-mounts (navegação Inertia)
    const [unread, setUnread] = useState<number>(() => {
        try {
            const saved = localStorage.getItem(`internal-chat-unread-${me.id}`);
            return saved ? Math.max(0, parseInt(saved, 10)) : 0;
        } catch {
            return 0;
        }
    });
    const [sending, setSending] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const openRef = useRef(false);

    useEffect(() => {
        openRef.current = open;
    }, [open]);

    // Load recent messages; calcula unread do localStorage se ainda for 0
    useEffect(() => {
        window.axios.get<ChatMessage[]>('/chat-interno/messages').then((r) => {
            setMessages(r.data);
            try {
                const persisted = parseInt(localStorage.getItem(lsUnreadKey) ?? '0', 10);
                if (persisted === 0) {
                    const raw = localStorage.getItem(lsSeenKey);
                    const lastSeen = raw ? new Date(raw) : null;
                    if (lastSeen) {
                        const count = r.data.filter(
                            (m) => m.user_id !== me.id && new Date(m.created_at) > lastSeen,
                        ).length;
                        if (count > 0) {
                            setUnread(count);
                            localStorage.setItem(lsUnreadKey, String(count));
                        }
                    }
                }
            } catch {}
        });
    }, []);

    // Subscribe to Reverb channel (once)
    useEffect(() => {
        const channel = window.Echo.private('internal-chat');

        const handler = (data: ChatMessage) => {
            setMessages((prev) => {
                if (prev.some((m) => m.id === data.id)) return prev;
                return [...prev, data];
            });
            if (data.user_id !== me.id && !openRef.current) {
                setUnread((n) => {
                    const next = n + 1;
                    try { localStorage.setItem(lsUnreadKey, String(next)); } catch {}
                    return next;
                });
                playPing();
            }
        };

        channel.listen('.message.created', handler);
        return () => {
            channel.stopListening('.message.created', handler);
        };
    }, [me.id]);

    // Fecha ao clicar fora do container
    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    // Auto-scroll when messages change or panel opens
    useEffect(() => {
        if (open && listRef.current) {
            listRef.current.scrollTop = listRef.current.scrollHeight;
        }
    }, [messages, open]);

    // Clear unread + salva last-seen + focus ao abrir
    useEffect(() => {
        if (open) {
            setUnread(0);
            try {
                localStorage.removeItem(lsUnreadKey);
                localStorage.setItem(lsSeenKey, new Date().toISOString());
            } catch {}
            setTimeout(() => inputRef.current?.focus(), 60);
        }
    }, [open]);

    const send = async () => {
        const text = body.trim();
        if (!text || sending) return;
        setSending(true);
        setBody('');
        try {
            const { data } = await window.axios.post<ChatMessage>('/chat-interno/messages', { body: text });
            setMessages((prev) => {
                if (prev.some((m) => m.id === data.id)) return prev;
                return [...prev, data];
            });
        } catch {}
        setSending(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            void send();
        }
    };

    return (
        <div ref={containerRef} className="relative">
            {/* Trigger — mesmo estilo dos botões do header */}
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                title="Chat da Equipe"
                className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-ink/[0.08] text-ink/50 transition hover:bg-ink/[0.07] hover:text-ink"
            >
                <MessageCircle className="h-4 w-4" />
                {unread > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold leading-none text-white">
                        {unread > 99 ? '99+' : unread}
                    </span>
                )}
            </button>

            {/* Painel — abre para baixo, alinhado à direita do trigger */}
            <div
                className={cn(
                    'absolute right-0 top-full z-50 mt-2 flex w-80 flex-col overflow-hidden rounded-2xl border border-accent/20 bg-white shadow-2xl dark:bg-[#142a1b]',
                    'transition-all duration-200 ease-out',
                    open
                        ? 'pointer-events-auto translate-y-0 opacity-100'
                        : 'pointer-events-none -translate-y-1 opacity-0',
                )}
                style={{ height: '440px' }}
            >
                    {/* Header */}
                    <div className="flex shrink-0 items-center justify-between border-b border-accent/10 px-4 py-3">
                        <div className="flex items-center gap-2">
                            <MessageCircle className="h-4 w-4 text-accent" />
                            <span className="text-xs font-semibold text-ink/82">Chat da Equipe</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            className="flex h-6 w-6 items-center justify-center rounded-lg text-ink/40 transition hover:bg-ink/[0.07] hover:text-ink"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    </div>

                    {/* Messages */}
                    <div ref={listRef} className="scrollbar-thin flex-1 overflow-y-auto space-y-3 p-3">
                        {messages.length === 0 && (
                            <p className="pt-8 text-center text-xs text-ink/30">Nenhuma mensagem ainda</p>
                        )}
                        {messages.map((msg) => {
                            const isMe = msg.user_id === me.id;
                            return (
                                <div
                                    key={msg.id}
                                    className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : ''}`}
                                >
                                    {!isMe && (
                                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/20 text-[10px] font-bold text-accent">
                                            {abbr(msg.user_name)}
                                        </div>
                                    )}
                                    <div
                                        className={`flex max-w-[75%] flex-col gap-0.5 ${isMe ? 'items-end' : 'items-start'}`}
                                    >
                                        {!isMe && (
                                            <span className="px-1 text-[10px] font-medium text-ink/40">
                                                {msg.user_name}
                                            </span>
                                        )}
                                        <div
                                            className={`rounded-2xl px-3 py-2 text-xs leading-relaxed ${isMe ? 'rounded-tr-sm bg-accent text-canvas dark:text-black' : 'rounded-tl-sm bg-ink/[0.06] text-ink'}`}
                                        >
                                            {msg.body}
                                        </div>
                                        <span className="px-1 text-[10px] text-ink/30">{fmtTime(msg.created_at)}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Input */}
                    <div className="flex shrink-0 items-end gap-2 border-t border-accent/10 p-2">
                        <textarea
                            ref={inputRef}
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Mensagem… (Enter envia)"
                            rows={1}
                            className="scrollbar-thin flex-1 resize-none rounded-xl border border-accent/20 bg-transparent px-3 py-2 text-xs text-ink placeholder-ink/30 outline-none focus:border-accent/50"
                            style={{ maxHeight: '80px' }}
                        />
                        <button
                            type="button"
                            onClick={() => void send()}
                            disabled={!body.trim() || sending}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent text-canvas transition hover:bg-accent/90 disabled:opacity-40 dark:text-black"
                        >
                            <Send className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </div>
        </div>
    );
}
