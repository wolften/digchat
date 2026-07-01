import { Badge } from '@/Components/ui/badge';
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
import { ActivityLogEntry, Paginated, UserSummary } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowLeftRight,
    Building2,
    Calendar,
    ChevronLeft,
    ChevronRight,
    Download,
    LogIn,
    LogOut,
    MessageSquare,
    ScrollText,
    Search,
    Settings,
    UserCog,
    Wifi,
    WifiOff,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface Filters {
    date_from: string;
    date_to: string;
    event: string | null;
    actor_user_id: number | null;
    sector_id: number | null;
    search: string | null;
}

interface Stats {
    total: number;
    auth: number;
    conversation: number;
    presence: number;
    admin: number;
}

interface Props {
    logs: Paginated<ActivityLogEntry>;
    filters: Filters;
    eventTypes: Record<string, string>;
    users: UserSummary[];
    sectors: Array<{ id: number; name: string }>;
    stats: Stats;
    can_export: boolean;
}

const CATEGORY_META: Record<
    string,
    { label: string; variant: 'default' | 'bot' | 'queued' | 'outline' }
> = {
    auth: { label: 'Autenticação', variant: 'outline' },
    conversation: { label: 'Atendimento', variant: 'default' },
    presence: { label: 'Presença', variant: 'queued' },
    admin: { label: 'Administração', variant: 'bot' },
    other: { label: 'Outros', variant: 'outline' },
};

function eventIcon(event: string) {
    if (event.startsWith('auth.login')) return LogIn;
    if (event.startsWith('auth.logout')) return LogOut;
    if (event.startsWith('presence.')) return event.includes('offline') ? WifiOff : Wifi;
    if (event.startsWith('conversation.')) return MessageSquare;
    if (event.startsWith('user.') || event.startsWith('sector.')) return UserCog;
    if (event.startsWith('channel.')) return ArrowLeftRight;
    if (event.startsWith('settings.')) return Settings;
    return ScrollText;
}

function formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function DateFilterInput({
    id,
    value,
    onChange,
}: {
    id: string;
    value: string;
    onChange: (value: string) => void;
}) {
    return (
        <div className="relative w-32 shrink-0">
            <Input
                id={id}
                type="date"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="date-filter-input h-8 w-full cursor-pointer pr-8 pl-2.5 text-xs"
            />
            <Calendar
                aria-hidden
                className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/35"
            />
        </div>
    );
}

export default function AuditoriaIndex({
    logs,
    filters,
    eventTypes,
    users,
    sectors,
    stats,
    can_export,
}: Props) {
    const [localSearch, setLocalSearch] = useState(filters.search ?? '');
    const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        setLocalSearch(filters.search ?? '');
    }, [filters.search]);

    const go = (
        overrides: Record<string, string | number | null | undefined> = {},
    ) => {
        const params: Record<string, string | number> = {
            date_from: filters.date_from,
            date_to: filters.date_to,
        };

        if (filters.event) params.event = filters.event;
        if (filters.actor_user_id) params.actor_user_id = filters.actor_user_id;
        if (filters.sector_id) params.sector_id = filters.sector_id;
        if (filters.search) params.search = filters.search;

        for (const [key, value] of Object.entries(overrides)) {
            if (value !== null && value !== undefined && value !== '') {
                params[key] = value as string | number;
            } else {
                delete params[key];
            }
        }

        router.get(route('auditoria.index'), params, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const handleSearch = (value: string) => {
        setLocalSearch(value);
        if (searchTimer.current) clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => {
            go({ search: value || null, page: 1 });
        }, 400);
    };

    const exportUrl = (() => {
        const p = new URLSearchParams({
            date_from: filters.date_from,
            date_to: filters.date_to,
        });
        if (filters.event) p.set('event', filters.event);
        if (filters.actor_user_id) p.set('actor_user_id', String(filters.actor_user_id));
        if (filters.sector_id) p.set('sector_id', String(filters.sector_id));
        if (filters.search) p.set('search', filters.search);
        return route('auditoria.export') + '?' + p.toString();
    })();

    return (
        <AuthenticatedLayout>
            <Head title="Auditoria" />

            <div className="flex h-full flex-col overflow-hidden">
                <div className="shrink-0 space-y-4 border-b border-accent/10 p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <h1 className="font-manrope text-xl font-bold">Auditoria</h1>
                            <p className="text-sm text-ink/60">
                                Histórico de ações no sistema — atendimentos, login, presença e administração.
                            </p>
                        </div>
                        {can_export && (
                            <Button asChild variant="outline" size="sm">
                                <a href={exportUrl}>
                                    <Download className="mr-2 h-4 w-4" />
                                    Exportar CSV
                                </a>
                            </Button>
                        )}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                        {[
                            { label: 'Total', value: stats.total },
                            { label: 'Atendimento', value: stats.conversation },
                            { label: 'Autenticação', value: stats.auth },
                            { label: 'Presença', value: stats.presence },
                            { label: 'Administração', value: stats.admin },
                        ].map((item) => (
                            <Card key={item.label} className="border-accent/10 bg-surface/60">
                                <CardContent className="p-4">
                                    <p className="text-xs font-medium uppercase tracking-wide text-ink/45">
                                        {item.label}
                                    </p>
                                    <p className="mt-1 text-2xl font-semibold text-ink">{item.value}</p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex shrink-0 items-center gap-1.5">
                            <DateFilterInput
                                id="auditoria-date-from"
                                value={filters.date_from}
                                onChange={(date_from) => go({ date_from, page: 1 })}
                            />
                            <span className="text-xs text-ink/35">até</span>
                            <DateFilterInput
                                id="auditoria-date-to"
                                value={filters.date_to}
                                onChange={(date_to) => go({ date_to, page: 1 })}
                            />
                        </div>
                        <Select
                            value={filters.event ?? 'all'}
                            onValueChange={(v) => go({ event: v === 'all' ? null : v, page: 1 })}
                        >
                            <SelectTrigger className="h-8 w-44 text-xs">
                                <SelectValue placeholder="Tipo de evento" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos os eventos</SelectItem>
                                {Object.entries(eventTypes).map(([value, label]) => (
                                    <SelectItem key={value} value={value}>
                                        {label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select
                            value={filters.actor_user_id ? String(filters.actor_user_id) : 'all'}
                            onValueChange={(v) =>
                                go({ actor_user_id: v === 'all' ? null : Number(v), page: 1 })
                            }
                        >
                            <SelectTrigger className="h-8 w-40 text-xs">
                                <SelectValue placeholder="Usuário" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos os usuários</SelectItem>
                                {users.map((user) => (
                                    <SelectItem key={user.id} value={String(user.id)}>
                                        {user.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select
                            value={filters.sector_id ? String(filters.sector_id) : 'all'}
                            onValueChange={(v) =>
                                go({ sector_id: v === 'all' ? null : Number(v), page: 1 })
                            }
                        >
                            <SelectTrigger className="h-8 w-40 text-xs">
                                <SelectValue placeholder="Setor" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos os setores</SelectItem>
                                {sectors.map((sector) => (
                                    <SelectItem key={sector.id} value={String(sector.id)}>
                                        {sector.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <div className="relative min-w-[12rem] flex-1">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35" />
                            <Input
                                className="h-8 pl-9 text-xs"
                                placeholder="Buscar descrição ou protocolo..."
                                value={localSearch}
                                onChange={(e) => handleSearch(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <div className="min-h-0 flex-1 overflow-auto p-6">
                    <Table className="min-w-[960px] table-auto">
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[1%] whitespace-nowrap">Data/Hora</TableHead>
                                <TableHead className="w-[1%] whitespace-nowrap">Evento</TableHead>
                                <TableHead className="w-[1%] whitespace-nowrap">Usuário</TableHead>
                                <TableHead className="whitespace-nowrap">Descrição</TableHead>
                                <TableHead className="w-[1%] whitespace-nowrap">Referência</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {logs.data.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="py-12 text-center text-ink/45">
                                        Nenhum registro encontrado para os filtros selecionados.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                logs.data.map((log) => {
                                    const Icon = eventIcon(log.event);
                                    const category = CATEGORY_META[log.event_category] ?? CATEGORY_META.other;
                                    const conversationId = log.properties.conversation_id as number | undefined;
                                    const protocol = log.properties.protocol_number as string | undefined;

                                    return (
                                        <TableRow key={log.id} className="h-11">
                                            <TableCell className="w-[1%] whitespace-nowrap py-2 text-xs text-ink/70">
                                                {formatDateTime(log.created_at)}
                                            </TableCell>
                                            <TableCell className="w-[1%] whitespace-nowrap py-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                                                        <Icon className="h-3.5 w-3.5" />
                                                    </div>
                                                    <span className="text-sm font-medium text-ink">
                                                        {log.event_label}
                                                    </span>
                                                    <Badge
                                                        variant={category.variant}
                                                        className="shrink-0 px-1.5 py-0 text-[10px] leading-4"
                                                    >
                                                        {category.label}
                                                    </Badge>
                                                </div>
                                            </TableCell>
                                            <TableCell className="w-[1%] max-w-[11rem] py-2">
                                                {log.actor ? (
                                                    <div className="flex min-w-0 items-center gap-2 whitespace-nowrap">
                                                        <UserAvatar
                                                            name={log.actor.name}
                                                            photoUrl={log.actor.profile_photo_url}
                                                            size="xs"
                                                            className="h-6 w-6 shrink-0 text-[9px]"
                                                        />
                                                        <button
                                                            type="button"
                                                            title={log.actor.name}
                                                            className="min-w-0 truncate text-left text-sm text-ink hover:text-accent"
                                                            onClick={() =>
                                                                go({
                                                                    actor_user_id: log.actor!.id,
                                                                    page: 1,
                                                                })
                                                            }
                                                        >
                                                            {log.actor.name}
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span className="whitespace-nowrap text-sm text-ink/45">Sistema</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="py-2">
                                                <p
                                                    className="truncate text-sm text-ink/80"
                                                    title={log.description}
                                                >
                                                    {log.description}
                                                </p>
                                            </TableCell>
                                            <TableCell className="w-[1%] whitespace-nowrap py-2">
                                                {conversationId ? (
                                                    <Link
                                                        href={route('historico.index', {
                                                            conversation: conversationId,
                                                        })}
                                                        className="text-sm font-medium text-accent hover:underline"
                                                    >
                                                        {protocol ? `#${protocol}` : `#${conversationId}`}
                                                    </Link>
                                                ) : log.subject_type?.includes('Sector') ? (
                                                    <span className="inline-flex items-center gap-1 text-sm text-ink/55">
                                                        <Building2 className="h-3.5 w-3.5 shrink-0" />
                                                        Setor
                                                    </span>
                                                ) : null}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>

                    {logs.last_page > 1 && (
                        <div className="mt-4 flex items-center justify-between">
                            <p className="text-sm text-ink/45">
                                {logs.from}–{logs.to} de {logs.total}
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={logs.current_page <= 1}
                                    onClick={() => go({ page: logs.current_page - 1 })}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={logs.current_page >= logs.last_page}
                                    onClick={() => go({ page: logs.current_page + 1 })}
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}