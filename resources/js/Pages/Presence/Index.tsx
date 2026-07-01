import { Badge, BadgeProps } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent } from '@/Components/ui/card';
import { Input } from '@/Components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/Components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/Components/ui/table';
import { UserAvatar } from '@/Components/UserAvatar';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { cn } from '@/lib/utils';
import { UserRole } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import {
    Clock3,
    Headphones,
    MessageSquare,
    RefreshCcw,
    Search,
    ShieldCheck,
    Sparkles,
    UserMinus,
    UserRoundCheck,
    UsersRound,
    WifiOff,
    X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

type PresenceState = 'online' | 'away' | 'offline' | 'inactive';

interface PresenceUser {
    id: number;
    name: string;
    profile_photo_url?: string | null;
    email: string;
    role: UserRole;
    is_active: boolean;
    presence: PresenceState;
    last_seen_at: string | null;
    last_seen_timestamp: number;
    open_conversations_count: number;
    sectors: Array<{ id: number; name: string }>;
}

interface Summary {
    online: number;
    away: number;
    offline: number;
    inactive: number;
    total: number;
}

interface Props {
    users: PresenceUser[];
    summary: Summary;
    generatedAt: string;
}

const ROLE_LABELS: Record<UserRole, string> = {
    admin: 'Admin',
    gestor: 'Gestor',
    atendente: 'Atendente',
};

const ROLE_META: Record<UserRole, { Icon: typeof ShieldCheck; variant: BadgeProps['variant'] }> = {
    admin: { Icon: ShieldCheck, variant: 'default' },
    gestor: { Icon: Sparkles, variant: 'bot' },
    atendente: { Icon: Headphones, variant: 'queued' },
};

const PRESENCE_META: Record<
    PresenceState,
    { label: string; dot: string; variant: BadgeProps['variant']; avatar: string }
> = {
    online: {
        label: 'Online',
        dot: 'bg-emerald-400',
        variant: 'default',
        avatar: 'border-accent/35 bg-accent/15 text-accent',
    },
    away: {
        label: 'Ausente',
        dot: 'bg-amber-400',
        variant: 'queued',
        avatar: 'border-amber-500/45 bg-amber-400/18 text-amber-800 dark:border-amber-300/35 dark:bg-amber-400/16 dark:text-amber-200',
    },
    offline: {
        label: 'Offline',
        dot: 'bg-slate-400 dark:bg-ink/30',
        variant: 'secondary',
        avatar: 'border-ink/[0.14] bg-ink/[0.06] text-ink/45',
    },
    inactive: {
        label: 'Inativo',
        dot: 'bg-red-400',
        variant: 'destructive',
        avatar: 'border-red-500/35 bg-red-500/12 text-red-700 dark:border-red-400/30 dark:bg-red-500/14 dark:text-red-200',
    },
};

const PRESENCE_FILTERS: Array<{ value: PresenceState | 'all'; label: string }> = [
    { value: 'all', label: 'Todos' },
    { value: 'online', label: 'Online' },
    { value: 'away', label: 'Ausentes' },
    { value: 'offline', label: 'Offline' },
    { value: 'inactive', label: 'Inativos' },
];

const PRESENCE_ORDER: Record<PresenceState, number> = {
    online: 0,
    away: 1,
    offline: 2,
    inactive: 3,
};

function timeAgo(value: string | null): string {
    if (!value) return 'Nunca entrou';

    const diffSeconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
    if (diffSeconds < 60) return 'agora';

    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes} min atrás`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} h atrás`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} d atrás`;
}

function formatClock(value: string | null): string {
    if (!value) return 'Sem registro';

    return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(value));
}

export default function PresenceIndex({ users, summary, generatedAt }: Props) {
    const currentUser = usePage().props.auth.user;

    const [query, setQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
    const [presenceFilter, setPresenceFilter] = useState<PresenceState | 'all'>('all');
    const [refreshing, setRefreshing] = useState(false);

    const refreshPresence = useCallback((silent = false) => {
        if (!silent) setRefreshing(true);
        router.reload({
            only: ['users', 'summary', 'generatedAt'],
            onFinish: () => setRefreshing(false),
        });
    }, []);

    const countsByRole = useMemo(
        () =>
            users.reduce(
                (acc, user) => {
                    acc[user.role] += 1;
                    return acc;
                },
                { admin: 0, gestor: 0, atendente: 0 } as Record<UserRole, number>,
            ),
        [users],
    );

    const filteredUsers = useMemo(() => {
        const term = query.trim().toLowerCase();

        return users
            .filter((user) => {
                if (roleFilter !== 'all' && user.role !== roleFilter) return false;
                if (presenceFilter !== 'all' && user.presence !== presenceFilter) return false;
                if (!term) return true;

                return (
                    user.name.toLowerCase().includes(term) ||
                    user.email.toLowerCase().includes(term) ||
                    user.sectors.some((sector) => sector.name.toLowerCase().includes(term))
                );
            })
            .sort((a, b) => {
                const byPresence = PRESENCE_ORDER[a.presence] - PRESENCE_ORDER[b.presence];
                if (byPresence !== 0) return byPresence;
                return a.name.localeCompare(b.name, 'pt-BR');
            });
    }, [users, query, roleFilter, presenceFilter]);

    const hasFilters = query.trim() !== '' || roleFilter !== 'all' || presenceFilter !== 'all';

    const pct = (n: number) => (summary.total > 0 ? Math.round((n / summary.total) * 100) : 0);
    const onlineRatio = pct(summary.online);

    const clearFilters = () => {
        setQuery('');
        setRoleFilter('all');
        setPresenceFilter('all');
    };

    useEffect(() => {
        const id = window.setInterval(() => refreshPresence(true), 30000);
        return () => window.clearInterval(id);
    }, [refreshPresence]);

    return (
        <AuthenticatedLayout header={<h2>Presença</h2>}>
            <Head title="Presença" />

            <div className="scrollbar-thin flex-1 overflow-y-auto p-6">
                <div className="flex flex-col gap-4">

                    {/* Page intro row */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h1 className="font-manrope text-xl font-bold text-ink">
                                Presença da equipe
                            </h1>
                            <div className="mt-1 flex items-center gap-2">
                                <span
                                    className="relative flex h-2 w-2"
                                    title="Atualiza automaticamente a cada 30 segundos"
                                >
                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                                    <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
                                </span>
                                <p className="text-sm text-ink/48">
                                    Atualizado {timeAgo(generatedAt)} · {formatClock(generatedAt)}
                                </p>
                            </div>
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => refreshPresence(false)}
                            disabled={refreshing}
                        >
                            <RefreshCcw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
                            Atualizar
                        </Button>
                    </div>

                    {/* Stat cards */}
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
                        <StatCard
                            icon={UserRoundCheck}
                            label="Online"
                            value={summary.online}
                            sub="ativos agora"
                            tone="emerald"
                            progress={pct(summary.online)}
                        />
                        <StatCard
                            icon={Clock3}
                            label="Ausentes"
                            value={summary.away}
                            sub="inatividade recente"
                            tone="amber"
                            progress={pct(summary.away)}
                        />
                        <StatCard
                            icon={WifiOff}
                            label="Offline"
                            value={summary.offline}
                            sub="fora do ar"
                            tone="muted"
                            progress={pct(summary.offline)}
                        />
                        <StatCard
                            icon={UserMinus}
                            label="Inativos"
                            value={summary.inactive}
                            sub="conta desativada"
                            tone="red"
                            progress={pct(summary.inactive)}
                        />
                        <StatCard
                            icon={UsersRound}
                            label="Cobertura"
                            value={`${onlineRatio}%`}
                            sub="da equipe disponível"
                            tone="accent"
                            progress={onlineRatio}
                        />
                    </div>

                    {/* Filters + table unified */}
                    <Card className="rounded-2xl">
                        {/* Filter header */}
                        <div className="flex flex-col gap-3 border-b border-ink/[0.06] p-5">
                            <div className="flex items-center justify-between">
                                <p className="text-[15px] font-semibold text-ink">
                                    Equipe monitorada{' '}
                                    <span className="font-normal text-ink/40">
                                        ({filteredUsers.length})
                                    </span>
                                </p>
                                {hasFilters && (
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 text-xs text-ink/55 hover:text-ink"
                                        onClick={clearFilters}
                                    >
                                        Limpar filtros
                                    </Button>
                                )}
                            </div>

                            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_13rem]">
                                <div className="relative">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35" />
                                    <Input
                                        value={query}
                                        onChange={(event) => setQuery(event.target.value)}
                                        placeholder="Buscar por nome, e-mail ou setor"
                                        className="h-9 pl-9 pr-8"
                                    />
                                    {query !== '' && (
                                        <button
                                            type="button"
                                            onClick={() => setQuery('')}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink/35 transition-colors hover:text-ink/70"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                </div>
                                <Select
                                    value={roleFilter}
                                    onValueChange={(value) =>
                                        setRoleFilter(value as 'all' | UserRole)
                                    }
                                >
                                    <SelectTrigger className="h-9">
                                        <SelectValue placeholder="Filtrar perfil" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todos os perfis</SelectItem>
                                        <SelectItem value="admin">
                                            Admin ({countsByRole.admin})
                                        </SelectItem>
                                        <SelectItem value="gestor">
                                            Gestor ({countsByRole.gestor})
                                        </SelectItem>
                                        <SelectItem value="atendente">
                                            Atendente ({countsByRole.atendente})
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="inline-flex w-fit flex-wrap items-center gap-1 rounded-xl border border-accent/15 bg-ink/[0.04] p-1">
                                {PRESENCE_FILTERS.map((status) => (
                                    <button
                                        key={status.value}
                                        type="button"
                                        onClick={() => setPresenceFilter(status.value)}
                                        className={cn(
                                            'rounded-lg px-3 py-1 text-sm font-medium transition-colors',
                                            presenceFilter === status.value
                                                ? 'bg-accent text-canvas shadow-sm dark:text-black'
                                                : 'text-ink/58 hover:bg-ink/[0.06] hover:text-ink',
                                        )}
                                    >
                                        {status.label}
                                        {status.value !== 'all' && (
                                            <span className="ml-1 text-[11px] opacity-65">
                                                ({summary[status.value]})
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Table */}
                        <CardContent className="p-0">
                            {filteredUsers.length === 0 ? (
                                <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
                                    <UsersRound className="h-6 w-6 text-ink/20" />
                                    <p className="text-sm text-ink/55">
                                        Nenhum usuário encontrado com os filtros atuais.
                                    </p>
                                    {hasFilters && (
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            className="text-xs text-ink/55 hover:text-ink"
                                            onClick={clearFilters}
                                        >
                                            Limpar filtros
                                        </Button>
                                    )}
                                </div>
                            ) : (
                                <Table className="[&_tbody_tr]:align-top">
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="pl-5 text-[11px] uppercase tracking-wide text-ink/62">
                                                Usuário
                                            </TableHead>
                                            <TableHead className="text-[11px] uppercase tracking-wide text-ink/62">
                                                Status
                                            </TableHead>
                                            <TableHead className="text-[11px] uppercase tracking-wide text-ink/62">
                                                Perfil
                                            </TableHead>
                                            <TableHead className="text-[11px] uppercase tracking-wide text-ink/62">
                                                Setores
                                            </TableHead>
                                            <TableHead className="text-right text-[11px] uppercase tracking-wide text-ink/62">
                                                Conversas
                                            </TableHead>
                                            <TableHead className="pr-5 text-[11px] uppercase tracking-wide text-ink/62">
                                                Último sinal
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredUsers.map((user) => {
                                            const role = ROLE_META[user.role];
                                            const RoleIcon = role.Icon;
                                            const presence = PRESENCE_META[user.presence];
                                            const isSelf = user.id === currentUser.id;

                                            return (
                                                <TableRow
                                                    key={user.id}
                                                    className="hover:bg-accent/[0.04]"
                                                >
                                                    <TableCell className="pl-5">
                                                        <div className="flex items-center gap-3">
                                                            <div className="relative shrink-0">
                                                                <UserAvatar
                                                                    name={user.name}
                                                                    photoUrl={user.profile_photo_url}
                                                                    size="lg"
                                                                    className={presence.avatar}
                                                                />
                                                                <span
                                                                    className={cn(
                                                                        'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-canvas',
                                                                        presence.dot,
                                                                        user.presence === 'online' && 'animate-pulse',
                                                                    )}
                                                                />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div className="flex min-w-0 items-center gap-1.5">
                                                                    <p className="truncate text-[15px] font-semibold text-ink/92">
                                                                        {user.name}
                                                                    </p>
                                                                    {isSelf && (
                                                                        <Badge
                                                                            variant="outline"
                                                                            className="shrink-0 px-1.5 py-0 text-[10px] leading-4"
                                                                        >
                                                                            Você
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                                <p className="truncate text-sm text-ink/58">
                                                                    {user.email}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={presence.variant}>
                                                            {presence.label}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={role.variant} className="gap-1">
                                                            <RoleIcon className="h-3.5 w-3.5" />
                                                            {ROLE_LABELS[user.role]}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        {user.sectors.length === 0 ? (
                                                            <Badge variant="outline">Sem setor</Badge>
                                                        ) : (
                                                            <div className="flex flex-wrap gap-1">
                                                                {user.sectors.slice(0, 2).map((sector) => (
                                                                    <Badge
                                                                        key={sector.id}
                                                                        variant="secondary"
                                                                    >
                                                                        {sector.name}
                                                                    </Badge>
                                                                ))}
                                                                {user.sectors.length > 2 && (
                                                                    <Badge variant="secondary">
                                                                        +{user.sectors.length - 2}
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Badge
                                                            variant={user.open_conversations_count > 0 ? 'bot' : 'secondary'}
                                                            className="gap-1 tabular-nums"
                                                        >
                                                            <MessageSquare className="h-3 w-3" />
                                                            {user.open_conversations_count}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="pr-5">
                                                        <div className="text-xs">
                                                            <p className="font-medium text-ink/88">
                                                                {timeAgo(user.last_seen_at)}
                                                            </p>
                                                            <p className="text-ink/52">
                                                                {formatClock(user.last_seen_at)}
                                                            </p>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

function StatCard({
    icon: Icon,
    label,
    value,
    sub,
    tone,
    progress,
}: {
    icon: typeof UsersRound;
    label: string;
    value: number | string;
    sub: string;
    tone: 'emerald' | 'amber' | 'muted' | 'accent' | 'red';
    progress: number;
}) {
    const toneClass = {
        emerald: 'text-emerald-300 bg-emerald-400/12 border-emerald-400/25',
        amber: 'text-amber-200 bg-amber-300/12 border-amber-300/25',
        muted: 'text-ink/50 bg-ink/[0.05] border-ink/12',
        accent: 'text-accent bg-accent/12 border-accent/25',
        red: 'text-red-200 bg-red-400/12 border-red-400/25',
    }[tone];

    const barClass = {
        emerald: 'bg-emerald-400',
        amber: 'bg-amber-400',
        muted: 'bg-ink/25',
        accent: 'bg-accent',
        red: 'bg-red-400',
    }[tone];

    return (
        <Card className="rounded-2xl">
            <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-ink/45">
                        {label}
                    </p>
                    <div
                        className={cn(
                            'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border',
                            toneClass,
                        )}
                    >
                        <Icon className="h-4 w-4" />
                    </div>
                </div>
                <p className="mt-2 font-manrope text-3xl font-bold text-ink">{value}</p>
                <p className="mt-0.5 text-xs text-ink/45">{sub}</p>
                <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-ink/[0.08]">
                    <div
                        className={cn('h-full rounded-full transition-all duration-500', barClass)}
                        style={{ width: `${progress > 0 ? Math.max(4, Math.min(100, progress)) : 0}%` }}
                    />
                </div>
            </CardContent>
        </Card>
    );
}
