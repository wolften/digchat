import { useState, type KeyboardEvent } from 'react';
import { Head, router } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { Badge } from '@/Components/ui/badge';
import { formatClientDisplayName, formatClientPhone } from '@/lib/utils';
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
import {
    Activity,
    Award,
    BarChart2,
    Bot,
    CheckCircle2,
    Clock,
    ClipboardList,
    Hourglass,
    MessageSquare,
    Star,
    Timer,
    TrendingUp,
    Users,
} from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────────

interface Stats {
    queued: number;
    open: number;
    bot: number;
    surveying: number;
    closed: number;
    avg_wait_mins: number;
    avg_handling_mins: number;
    avg_tme_mins: number;
    resolution_rate: number;
    unique_contacts: number;
    avg_csat: number | null;
    csat_count: number;
}

interface VolumeDataPoint {
    label: string;
    count: number;
}

interface SectorStat {
    name: string;
    total: number;
}

interface WaitingConversation {
    id: number;
    contact_name: string;
    contact_wa: string | null;
    sector: string | null;
    waiting_since: string;
    waiting_mins: number;
}

interface TopAttendant {
    user_id: number;
    name: string;
    closed: number;
    open: number;
    avg_mins: number;
}

interface Props {
    stats: Stats;
    volumeData: VolumeDataPoint[];
    sectorStats: SectorStat[];
    waiting: WaitingConversation[];
    topAttendants: TopAttendant[];
    period: string;
}

// ── Helpers ─────────────────────────────────────────────────────────

const PERIOD_LABELS: Record<string, string> = {
    today: 'Hoje',
    week: 'Esta semana',
    month: 'Este mês',
    all: 'Todo período',
};

function formatDuration(mins: number): string {
    if (mins <= 0) return '—';
    if (mins < 60) return `${mins}min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function WaitBadge({ mins }: { mins: number }) {
    if (mins > 60) return <Badge variant="destructive">{formatDuration(mins)}</Badge>;
    if (mins > 20) {
        return (
            <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400">
                {formatDuration(mins)}
            </Badge>
        );
    }
    return <Badge variant="secondary">{formatDuration(mins)}</Badge>;
}

function getInitials(name: string): string {
    return name
        .split(' ')
        .filter(Boolean)
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
}

// ── Volume chart ─────────────────────────────────────────────────────

function VolumeChart({ data }: { data: VolumeDataPoint[] }) {
    const [hovered, setHovered] = useState<number | null>(null);

    if (data.length === 0) {
        return (
            <div className="flex h-36 items-center justify-center text-sm text-muted-foreground">
                Sem conversas iniciadas no período.
            </div>
        );
    }

    const max = Math.max(...data.map((d) => d.count), 1);
    const total = data.length;
    const showEvery = total <= 7 ? 1 : total <= 14 ? 2 : total <= 24 ? 3 : 5;

    return (
        <div className="select-none space-y-1">
            <div className="flex items-end gap-px" style={{ height: 140 }}>
                {data.map((d, i) => {
                    const pct = d.count > 0 ? Math.max((d.count / max) * 100, 4) : 1;
                    const isHovered = hovered === i;
                    return (
                        <div
                            key={i}
                            className="relative flex h-full flex-1 flex-col items-center justify-end cursor-default"
                            onMouseEnter={() => setHovered(i)}
                            onMouseLeave={() => setHovered(null)}
                        >
                            {isHovered && d.count > 0 && (
                                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-[11px] font-semibold text-popover-foreground shadow-lg">
                                    {d.count} {d.count === 1 ? 'conversa' : 'conversas'}
                                </div>
                            )}
                            <div
                                className={`w-full rounded-t-[3px] transition-colors duration-100 ${
                                    isHovered ? 'bg-accent' : 'bg-accent/55'
                                } ${d.count === 0 ? 'opacity-20' : ''}`}
                                style={{ height: `${pct}%` }}
                            />
                        </div>
                    );
                })}
            </div>
            <div className="flex gap-px">
                {data.map((d, i) => (
                    <div key={i} className="flex-1 overflow-hidden text-center">
                        {i % showEvery === 0 ? (
                            <span
                                className={`block truncate text-[9px] leading-tight transition-colors ${
                                    hovered === i ? 'font-medium text-foreground' : 'text-muted-foreground'
                                }`}
                            >
                                {d.label}
                            </span>
                        ) : null}
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Stat card ────────────────────────────────────────────────────────

interface StatCardProps {
    label: string;
    value: string | number;
    sub: string;
    icon: React.ReactNode;
    iconBg: string;
    borderColor?: string;
}

function StatCard({ label, value, sub, icon, iconBg, borderColor }: StatCardProps) {
    return (
        <Card className={borderColor}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {label}
                </CardTitle>
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconBg}`}>
                    {icon}
                </div>
            </CardHeader>
            <CardContent>
                <div className="text-3xl font-bold tracking-tight">{value}</div>
                <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
            </CardContent>
        </Card>
    );
}

// ── Dashboard ────────────────────────────────────────────────────────

export default function Dashboard({ stats, volumeData, sectorStats, waiting, topAttendants, period }: Props) {
    const periodLabel = PERIOD_LABELS[period] ?? 'Hoje';
    const totalClosed = topAttendants.reduce((t, a) => t + a.closed, 0);
    const totalOpen   = topAttendants.reduce((t, a) => t + a.open, 0);
    const maxClosed   = Math.max(...topAttendants.map((a) => a.closed), 1);
    const maxSector   = Math.max(...sectorStats.map((s) => s.total), 1);
    const leader      = topAttendants[0];
    const others      = topAttendants.slice(1);
    const liveTotal   = stats.queued + stats.open + stats.bot + stats.surveying;

    function onPeriodChange(value: string) {
        router.get('/dashboard', { period: value }, { preserveState: false });
    }

    function openConversation(id: number) {
        router.visit(route('inbox.show', id));
    }

    function onWaitingRowKeyDown(e: KeyboardEvent<HTMLTableRowElement>, id: number) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openConversation(id);
        }
    }

    return (
        <AuthenticatedLayout header={<h2>Dashboard</h2>}>
            <Head title="Dashboard" />

            <div className="scrollbar-thin flex-1 overflow-y-auto p-6 space-y-6">

                {/* Header: sumário ao vivo + seletor de período */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-muted-foreground">
                        Ao vivo ·{' '}
                        <span className="font-semibold text-foreground">
                            {liveTotal} {liveTotal === 1 ? 'conversa ativa' : 'conversas ativas'}
                        </span>
                        {stats.avg_wait_mins > 0 && (
                            <>
                                {' '}· Espera média:{' '}
                                <span
                                    className={`font-semibold ${
                                        stats.avg_wait_mins > 30
                                            ? 'text-destructive'
                                            : stats.avg_wait_mins > 10
                                            ? 'text-yellow-600 dark:text-yellow-400'
                                            : 'text-foreground'
                                    }`}
                                >
                                    {formatDuration(stats.avg_wait_mins)}
                                </span>
                            </>
                        )}
                    </p>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Período:</span>
                        <Select value={period} onValueChange={onPeriodChange}>
                            <SelectTrigger className="h-8 w-40 text-xs">
                                <SelectValue placeholder="Período" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="today">Hoje</SelectItem>
                                <SelectItem value="week">Esta semana</SelectItem>
                                <SelectItem value="month">Este mês</SelectItem>
                                <SelectItem value="all">Todo período</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Status ao vivo (4 cards) */}
                <div>
                    <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                        Status ao vivo
                    </p>
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                        <StatCard
                            label="Na fila"
                            value={stats.queued}
                            sub="aguardando atendente"
                            icon={<Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />}
                            iconBg="bg-yellow-50 dark:bg-yellow-900/20"
                            borderColor="border-yellow-200/60 dark:border-yellow-900/40"
                        />
                        <StatCard
                            label="Em atendimento"
                            value={stats.open}
                            sub="conversas abertas agora"
                            icon={<MessageSquare className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
                            iconBg="bg-blue-50 dark:bg-blue-900/20"
                            borderColor="border-blue-200/60 dark:border-blue-900/40"
                        />
                        <StatCard
                            label="No bot"
                            value={stats.bot}
                            sub="em fluxo automático"
                            icon={<Bot className="h-4 w-4 text-purple-600 dark:text-purple-400" />}
                            iconBg="bg-purple-50 dark:bg-purple-900/20"
                            borderColor="border-purple-200/60 dark:border-purple-900/40"
                        />
                        <StatCard
                            label="Em pesquisa"
                            value={stats.surveying}
                            sub="respondendo pesquisa"
                            icon={<ClipboardList className="h-4 w-4 text-teal-600 dark:text-teal-400" />}
                            iconBg="bg-teal-50 dark:bg-teal-900/20"
                            borderColor="border-teal-200/60 dark:border-teal-900/40"
                        />
                    </div>
                </div>

                {/* Métricas do período (4 cards) */}
                <div>
                    <div className="mb-3 flex items-center gap-3">
                        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                            {periodLabel}
                        </p>
                        <div className="flex-1 border-t border-dashed border-ink/[0.10]" />
                    </div>
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                        <StatCard
                            label="Encerradas"
                            value={stats.closed}
                            sub="atendimentos finalizados"
                            icon={<CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />}
                            iconBg="bg-green-50 dark:bg-green-900/20"
                        />
                        <StatCard
                            label="Contatos únicos"
                            value={stats.unique_contacts}
                            sub="clientes atendidos"
                            icon={<Users className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />}
                            iconBg="bg-indigo-50 dark:bg-indigo-900/20"
                        />
                        <StatCard
                            label="Taxa de resolução"
                            value={stats.resolution_rate > 0 ? `${stats.resolution_rate}%` : '—'}
                            sub="conversas encerradas"
                            icon={<Activity className="h-4 w-4 text-rose-600 dark:text-rose-400" />}
                            iconBg="bg-rose-50 dark:bg-rose-900/20"
                        />
                        <StatCard
                            label="TMA"
                            value={stats.avg_handling_mins > 0 ? formatDuration(stats.avg_handling_mins) : '—'}
                            sub="tempo médio de atendimento"
                            icon={<Timer className="h-4 w-4 text-orange-600 dark:text-orange-400" />}
                            iconBg="bg-orange-50 dark:bg-orange-900/20"
                        />
                        <StatCard
                            label="TME"
                            value={stats.avg_tme_mins > 0 ? formatDuration(stats.avg_tme_mins) : '—'}
                            sub="tempo médio de espera na fila"
                            icon={<Hourglass className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />}
                            iconBg="bg-cyan-50 dark:bg-cyan-900/20"
                        />
                        <StatCard
                            label="CSAT médio"
                            value={stats.avg_csat !== null ? `${stats.avg_csat}/5` : '—'}
                            sub={stats.csat_count > 0 ? `${stats.csat_count} avaliações` : 'sem avaliações de nota'}
                            icon={<Star className="h-4 w-4 text-amber-500 dark:text-amber-400" />}
                            iconBg="bg-amber-50 dark:bg-amber-900/20"
                        />
                    </div>
                </div>

                {/* Gráficos: volume + setores */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    <Card className="lg:col-span-2">
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <BarChart2 className="h-4 w-4 text-muted-foreground" />
                                    Volume de atendimentos
                                </CardTitle>
                                <Badge variant="outline" className="text-xs">
                                    {periodLabel}
                                </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Conversas iniciadas no período
                            </p>
                        </CardHeader>
                        <CardContent className="pt-2">
                            <VolumeChart data={volumeData} />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base">Por setor</CardTitle>
                            <p className="text-xs text-muted-foreground">Distribuição de conversas</p>
                        </CardHeader>
                        <CardContent className="space-y-3 pt-2">
                            {sectorStats.length === 0 ? (
                                <p className="py-6 text-center text-sm text-muted-foreground">
                                    Sem conversas com setor definido.
                                </p>
                            ) : (
                                sectorStats.map((s) => (
                                    <div key={s.name} className="space-y-1.5">
                                        <div className="flex items-center justify-between gap-2 text-sm">
                                            <span className="truncate font-medium">{s.name}</span>
                                            <span className="shrink-0 tabular-nums text-muted-foreground">
                                                {s.total}
                                            </span>
                                        </div>
                                        <div className="h-1.5 overflow-hidden rounded-full bg-ink/[0.08]">
                                            <div
                                                className="h-full rounded-full bg-accent transition-all duration-500"
                                                style={{
                                                    width: `${Math.round((s.total / maxSector) * 100)}%`,
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Fila de espera + Ranking */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    {/* Clientes aguardando */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Clock className="h-4 w-4 text-yellow-500" />
                                Clientes aguardando
                                {stats.queued > 0 && (
                                    <Badge variant="destructive" className="ml-1">
                                        {stats.queued}
                                    </Badge>
                                )}
                            </CardTitle>
                            {stats.avg_wait_mins > 0 && (
                                <p className="text-xs text-muted-foreground">
                                    Tempo médio na fila:{' '}
                                    <span
                                        className={`font-semibold ${
                                            stats.avg_wait_mins > 30
                                                ? 'text-destructive'
                                                : stats.avg_wait_mins > 10
                                                ? 'text-yellow-600 dark:text-yellow-400'
                                                : 'text-foreground'
                                        }`}
                                    >
                                        {formatDuration(stats.avg_wait_mins)}
                                    </span>
                                </p>
                            )}
                        </CardHeader>
                        <CardContent className="p-0">
                            {waiting.length === 0 ? (
                                <p className="p-6 text-center text-sm text-muted-foreground">
                                    Nenhum cliente aguardando.
                                </p>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Cliente</TableHead>
                                            <TableHead>Setor</TableHead>
                                            <TableHead className="text-right">Aguardando</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {waiting.map((c) => {
                                            const contactName = formatClientDisplayName(c.contact_name, c.contact_wa);
                                            const contactPhone = formatClientPhone(c.contact_wa);
                                            return (
                                                <TableRow
                                                    key={c.id}
                                                    role="link"
                                                    tabIndex={0}
                                                    title={`Abrir conversa de ${contactName}`}
                                                    aria-label={`Abrir conversa de ${contactName}`}
                                                    className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                                                    onClick={() => openConversation(c.id)}
                                                    onKeyDown={(e) => onWaitingRowKeyDown(e, c.id)}
                                                >
                                                    <TableCell>
                                                        <div className="font-medium">{contactName}</div>
                                                        {contactPhone && contactPhone !== contactName && (
                                                            <div className="text-xs text-muted-foreground">
                                                                {contactPhone}
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        {c.sector ? (
                                                            <Badge variant="outline">{c.sector}</Badge>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground">—</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <WaitBadge mins={c.waiting_mins} />
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>

                    {/* Ranking de atendentes */}
                    <Card className="border-ink/[0.08]">
                        <CardHeader className="pb-4">
                            <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                    <CardTitle className="flex items-center gap-2 text-base">
                                        <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink/[0.10] bg-ink/[0.04] text-accent">
                                            <TrendingUp className="h-4 w-4" />
                                        </span>
                                        Ranking de atendentes
                                    </CardTitle>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        Performance de encerramentos
                                    </p>
                                </div>
                                <Badge variant="outline" className="shrink-0 px-3 py-1 text-xs">
                                    {periodLabel}
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {topAttendants.length === 0 ? (
                                <div className="rounded-lg border border-dashed border-ink/[0.14] px-4 py-8 text-center">
                                    <Award className="mx-auto h-8 w-8 text-muted-foreground/60" />
                                    <p className="mt-3 text-sm text-muted-foreground">
                                        Nenhum atendimento encerrado no período.
                                    </p>
                                </div>
                            ) : (
                                leader && (
                                    <>
                                        <div className="rounded-xl border border-ink/[0.10] bg-ink/[0.02] p-4">
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="min-w-0">
                                                    <span className="inline-flex rounded-full border border-accent/20 bg-accent/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-accent">
                                                        1º lugar
                                                    </span>
                                                    <div className="mt-2 truncate text-xl font-semibold text-ink">
                                                        {leader.name}
                                                    </div>
                                                    <p className="mt-1 text-xs text-muted-foreground">
                                                        Líder em encerramentos no período
                                                    </p>
                                                </div>
                                                <div className="flex shrink-0 items-center gap-2 text-xs">
                                                    <div className="rounded-lg bg-accent/10 px-3 py-2 text-center">
                                                        <div className="font-semibold text-accent">
                                                            {leader.closed}
                                                        </div>
                                                        <div className="mt-0.5 uppercase text-accent/80">Enc.</div>
                                                    </div>
                                                    <div className="rounded-lg border border-ink/[0.10] px-3 py-2 text-center">
                                                        <div className="font-semibold text-ink/80">
                                                            {leader.open}
                                                        </div>
                                                        <div className="mt-0.5 uppercase text-muted-foreground">Aber.</div>
                                                    </div>
                                                    {leader.avg_mins > 0 && (
                                                        <div className="rounded-lg border border-ink/[0.10] px-3 py-2 text-center">
                                                            <div className="font-semibold text-ink/80">
                                                                {formatDuration(leader.avg_mins)}
                                                            </div>
                                                            <div className="mt-0.5 uppercase text-muted-foreground">TMA</div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink/[0.08]">
                                                <div
                                                    className="h-full rounded-full bg-accent"
                                                    style={{
                                                        width: `${Math.max(10, Math.round((leader.closed / maxClosed) * 100))}%`,
                                                    }}
                                                />
                                            </div>
                                        </div>

                                        {others.length > 0 && (
                                            <div className="space-y-2">
                                                {others.map((attendant, index) => {
                                                    const pct = Math.max(8, Math.round((attendant.closed / maxClosed) * 100));
                                                    return (
                                                        <div
                                                            key={attendant.user_id}
                                                            className="rounded-lg border border-ink/[0.08] bg-background px-3 py-2.5"
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-ink/[0.10] bg-ink/[0.04] text-xs font-semibold text-ink/70">
                                                                    {index + 2}
                                                                </div>
                                                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink/[0.08] text-xs font-semibold text-ink">
                                                                    {getInitials(attendant.name)}
                                                                </div>
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="truncate text-sm font-medium text-ink">
                                                                        {attendant.name}
                                                                    </div>
                                                                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-ink/[0.08]">
                                                                        <div
                                                                            className="h-full rounded-full bg-accent"
                                                                            style={{ width: `${pct}%` }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                                <div className="flex shrink-0 items-center gap-3 text-xs">
                                                                    <div className="text-right">
                                                                        <div className="font-semibold text-accent">
                                                                            {attendant.closed}
                                                                        </div>
                                                                        <div className="uppercase text-accent/80">Enc.</div>
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <div className="font-semibold text-ink/80">
                                                                            {attendant.open}
                                                                        </div>
                                                                        <div className="uppercase text-muted-foreground">Aber.</div>
                                                                    </div>
                                                                    {attendant.avg_mins > 0 && (
                                                                        <div className="text-right">
                                                                            <div className="font-semibold text-ink/60">
                                                                                {formatDuration(attendant.avg_mins)}
                                                                            </div>
                                                                            <div className="uppercase text-muted-foreground">TMA</div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink/[0.08] bg-ink/[0.02] px-3 py-2 text-xs text-muted-foreground">
                                            <span>Total do time</span>
                                            <span className="font-semibold text-ink/80">
                                                {totalClosed} encerrados · {totalOpen} abertos
                                            </span>
                                        </div>
                                    </>
                                )
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
