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
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { cn } from '@/lib/utils';
import { UserRole } from '@/types';
import { Head, router } from '@inertiajs/react';
import {
    Clock3,
    Headphones,
    RefreshCcw,
    Search,
    ShieldCheck,
    Sparkles,
    UserMinus,
    UserRoundCheck,
    UsersRound,
    WifiOff,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

type PresenceState = 'online' | 'away' | 'offline' | 'inactive';

interface PresenceUser {
    id: number;
    name: string;
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
    { label: string; detail: string; dot: string; variant: BadgeProps['variant'] }
> = {
    online: {
        label: 'Online',
        detail: 'ativo agora',
        dot: 'bg-emerald-400',
        variant: 'default',
    },
    away: {
        label: 'Ausente',
        detail: 'atividade recente',
        dot: 'bg-amber-400',
        variant: 'queued',
    },
    offline: {
        label: 'Offline',
        detail: 'fora da sessão',
        dot: 'bg-slate-400 dark:bg-ink/30',
        variant: 'secondary',
    },
    inactive: {
        label: 'Inativo',
        detail: 'usuário bloqueado',
        dot: 'bg-red-400',
        variant: 'destructive',
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

function initials(name: string): string {
    return name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join('')
        .toUpperCase();
}

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

function refreshPresence() {
    router.reload({
        only: ['users', 'summary', 'generatedAt'],
    });
}

export default function PresenceIndex({ users, summary, generatedAt }: Props) {
    const [query, setQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
    const [presenceFilter, setPresenceFilter] = useState<PresenceState | 'all'>('all');

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
    const onlineRatio = summary.total > 0 ? Math.round((summary.online / summary.total) * 100) : 0;

    useEffect(() => {
        const id = window.setInterval(refreshPresence, 30000);
        return () => window.clearInterval(id);
    }, []);

    return (
        <AuthenticatedLayout header={<h2>Presença</h2>}>
            <Head title="Presença" />

            <div className="scrollbar-thin flex-1 overflow-y-auto p-6">
                <div className="flex flex-col gap-4">

                    {/* Page intro row */}
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="font-manrope text-lg font-semibold text-ink">
                                Presença da equipe
                            </h1>
                            <p className="mt-0.5 text-sm text-ink/48">
                                Atualizado {timeAgo(generatedAt)} · {formatClock(generatedAt)}
                            </p>
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={refreshPresence}>
                            <RefreshCcw className="h-3.5 w-3.5" />
                            Atualizar
                        </Button>
                    </div>

                    {/* Stat cards */}
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                        <StatCard icon={UserRoundCheck} label="Online" value={summary.online} tone="emerald" />
                        <StatCard icon={Clock3} label="Ausentes" value={summary.away} tone="amber" />
                        <StatCard icon={WifiOff} label="Offline" value={summary.offline} tone="muted" />
                        <StatCard icon={UserMinus} label="Inativos" value={summary.inactive} tone="red" />
                        <StatCard icon={UsersRound} label="Cobertura" value={`${onlineRatio}%`} tone="accent" />
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
                                        onClick={() => {
                                            setQuery('');
                                            setRoleFilter('all');
                                            setPresenceFilter('all');
                                        }}
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
                                        className="h-9 pl-9"
                                    />
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

                            <div className="flex flex-wrap items-center gap-1">
                                {PRESENCE_FILTERS.map((status) => (
                                    <button
                                        key={status.value}
                                        type="button"
                                        onClick={() => setPresenceFilter(status.value)}
                                        className={cn(
                                            'rounded-lg px-3 py-1 text-sm font-medium transition-colors',
                                            presenceFilter === status.value
                                                ? 'bg-accent text-canvas dark:text-black'
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
                                <div className="px-5 py-5">
                                    <div className="rounded-xl border border-ink/10 bg-ink/[0.03] p-5 text-sm text-ink/55">
                                        Nenhum usuário encontrado com os filtros atuais.
                                    </div>
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

                                            return (
                                                <TableRow
                                                    key={user.id}
                                                    className="hover:bg-accent/[0.04]"
                                                >
                                                    <TableCell className="pl-5">
                                                        <div className="flex items-center gap-3">
                                                            <div className="relative shrink-0">
                                                                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-accent/35 bg-accent/15 text-xs font-bold text-accent">
                                                                    {initials(user.name) || 'DC'}
                                                                </div>
                                                                <span
                                                                    className={cn(
                                                                        'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-canvas',
                                                                        presence.dot,
                                                                    )}
                                                                />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="truncate text-[15px] font-semibold text-ink/92">
                                                                    {user.name}
                                                                </p>
                                                                <p className="truncate text-sm text-ink/58">
                                                                    {user.email}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div>
                                                            <Badge
                                                                variant={presence.variant}
                                                                className="mb-1"
                                                            >
                                                                {presence.label}
                                                            </Badge>
                                                            <p className="text-xs text-ink/58">
                                                                {presence.detail}
                                                            </p>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={role.variant} className="gap-1">
                                                            <RoleIcon className="h-3.5 w-3.5" />
                                                            {ROLE_LABELS[user.role]}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        {user.sectors.length === 0 ? (
                                                            <Badge variant="secondary">Sem setor</Badge>
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
                                                        <span className="inline-flex min-w-8 items-center justify-center rounded-lg border border-ink/25 bg-white px-2 py-0.5 text-sm font-semibold text-ink dark:border-ink/15 dark:bg-ink/[0.05] dark:text-ink/90">
                                                            {user.open_conversations_count}
                                                        </span>
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
    tone,
}: {
    icon: typeof UsersRound;
    label: string;
    value: number | string;
    tone: 'emerald' | 'amber' | 'muted' | 'accent' | 'red';
}) {
    const toneClass = {
        emerald: 'text-emerald-300 bg-emerald-400/12 border-emerald-400/25',
        amber: 'text-amber-200 bg-amber-300/12 border-amber-300/25',
        muted: 'text-ink/50 bg-ink/[0.05] border-ink/12',
        accent: 'text-accent bg-accent/12 border-accent/25',
        red: 'text-red-200 bg-red-400/12 border-red-400/25',
    }[tone];

    return (
        <Card className="rounded-2xl">
            <CardContent className="flex items-center justify-between p-4">
                <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-ink/45">
                        {label}
                    </p>
                    <p className="mt-1 font-manrope text-3xl font-bold text-ink">{value}</p>
                </div>
                <div
                    className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-xl border',
                        toneClass,
                    )}
                >
                    <Icon className="h-4 w-4" />
                </div>
            </CardContent>
        </Card>
    );
}
