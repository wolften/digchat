import { Head, router } from '@inertiajs/react';
import { UserAvatar } from '@/Components/UserAvatar';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { CHANNEL_BAR_COLORS, ChannelIcon, type ChannelType } from '@/Components/charts/ChannelIcons';
import { HorizontalBarChart } from '@/Components/charts/HorizontalBarChart';
import { VolumeChart } from '@/Components/charts/VolumeChart';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { Badge } from '@/Components/ui/badge';
import { formatDuration } from '@/lib/formatDuration';
import { cn } from '@/lib/utils';
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

interface SectorStat {
    name: string;
    total: number;
}

interface ChannelStat {
    name: string;
    type: ChannelType;
    total: number;
}

interface TopAttendant {
    user_id: number;
    name: string;
    profile_photo_url?: string | null;
    closed: number;
    open: number;
    avg_mins: number;
}

interface Props {
    stats: Stats;
    volumeData: { label: string; count: number }[];
    sectorStats: SectorStat[];
    channelStats: ChannelStat[];
    topAttendants: TopAttendant[];
    period: string;
}

const PERIOD_LABELS: Record<string, string> = {
    today: 'Hoje',
    week: 'Esta semana',
    month: 'Este mês',
    all: 'Todo período',
};

// ── Ranking de atendentes ────────────────────────────────────────────

function AttendantRanking({
    attendants,
    maxClosed,
}: {
    attendants: TopAttendant[];
    maxClosed: number;
}) {
    if (attendants.length === 0) {
        return (
            <div className="px-6 py-10 text-center">
                <Award className="mx-auto h-7 w-7 text-muted-foreground/50" />
                <p className="mt-3 text-sm text-muted-foreground">
                    Nenhum atendimento encerrado no período.
                </p>
            </div>
        );
    }

    return (
        <Table>
            <TableHeader>
                <TableRow className="hover:bg-transparent">
                    <TableHead className="w-10 pl-6">#</TableHead>
                    <TableHead>Atendente</TableHead>
                    <TableHead className="w-16 text-right">Enc.</TableHead>
                    <TableHead className="w-16 text-right">Aber.</TableHead>
                    <TableHead className="w-20 pr-6 text-right">TMA</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {attendants.map((attendant, index) => {
                    const rank = index + 1;
                    const pct = maxClosed > 0
                        ? Math.max(4, Math.round((attendant.closed / maxClosed) * 100))
                        : 0;

                    return (
                        <TableRow
                            key={attendant.user_id}
                            className={cn(
                                'border-ink/[0.06]',
                                rank === 1 && 'bg-accent/[0.04] hover:bg-accent/[0.06]',
                            )}
                        >
                            <TableCell className="pl-6">
                                {rank === 1 ? (
                                    <Award className="h-4 w-4 text-accent" aria-label="1º lugar" />
                                ) : (
                                    <span className="text-xs font-medium tabular-nums text-muted-foreground">
                                        {rank}
                                    </span>
                                )}
                            </TableCell>
                            <TableCell>
                                <div className="flex items-center gap-2.5">
                                    <UserAvatar
                                        name={attendant.name}
                                        photoUrl={attendant.profile_photo_url}
                                        size="sm"
                                        className={
                                            rank === 1
                                                ? 'border-accent/35 bg-accent/15 text-accent'
                                                : undefined
                                        }
                                    />
                                    <div className="min-w-0 flex-1">
                                        <div className="truncate text-sm font-medium">{attendant.name}</div>
                                        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-ink/[0.08]">
                                            <div
                                                className={cn(
                                                    'h-full rounded-full transition-all duration-500',
                                                    rank === 1 ? 'bg-accent' : 'bg-accent/50',
                                                )}
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                                <span className={cn('font-semibold', rank === 1 && 'text-accent')}>
                                    {attendant.closed}
                                </span>
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                                {attendant.open}
                            </TableCell>
                            <TableCell className="pr-6 text-right tabular-nums text-muted-foreground">
                                {attendant.avg_mins > 0 ? formatDuration(attendant.avg_mins) : '—'}
                            </TableCell>
                        </TableRow>
                    );
                })}
            </TableBody>
        </Table>
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

export default function Dashboard({ stats, volumeData, sectorStats, channelStats, topAttendants, period }: Props) {
    const periodLabel = PERIOD_LABELS[period] ?? 'Hoje';
    const totalClosed = topAttendants.reduce((t, a) => t + a.closed, 0);
    const totalOpen   = topAttendants.reduce((t, a) => t + a.open, 0);
    const maxClosed   = Math.max(...topAttendants.map((a) => a.closed), 1);
    const liveTotal   = stats.queued + stats.open + stats.bot + stats.surveying;

    function onPeriodChange(value: string) {
        router.get('/dashboard', { period: value }, { preserveState: false });
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

                {/* Distribuições */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base">Por canal</CardTitle>
                                <p className="text-xs text-muted-foreground">Atendimentos por canal</p>
                            </CardHeader>
                            <CardContent className="pt-2">
                                <HorizontalBarChart
                                    items={channelStats.map((c) => ({
                                        key: `${c.type}-${c.name}`,
                                        label: (
                                            <>
                                                <ChannelIcon type={c.type} className="h-3.5 w-3.5 shrink-0 opacity-70" />
                                                {c.name}
                                            </>
                                        ),
                                        value: c.total,
                                        barClassName: CHANNEL_BAR_COLORS[c.type],
                                    }))}
                                    emptyLabel="Sem conversas com canal definido."
                                />
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base">Por setor</CardTitle>
                                <p className="text-xs text-muted-foreground">Distribuição de conversas</p>
                            </CardHeader>
                            <CardContent className="pt-2">
                                <HorizontalBarChart
                                    items={sectorStats.map((s) => ({
                                        key: s.name,
                                        label: s.name,
                                        value: s.total,
                                    }))}
                                    emptyLabel="Sem conversas com setor definido."
                                />
                            </CardContent>
                        </Card>
                </div>

                {/* Ranking de atendentes */}
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between gap-3">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                                Ranking de atendentes
                            </CardTitle>
                            <Badge variant="outline" className="text-xs">
                                {periodLabel}
                            </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {topAttendants.length > 0 ? (
                                <>
                                    {totalClosed} encerrados · {totalOpen} abertos
                                </>
                            ) : (
                                'Performance de encerramentos'
                            )}
                        </p>
                    </CardHeader>
                    <CardContent className="p-0">
                        <AttendantRanking
                            attendants={topAttendants}
                            maxClosed={maxClosed}
                        />
                    </CardContent>
                </Card>

                {/* Volume de atendimentos */}
                <Card>
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
                    <CardContent className="pt-1 pb-4">
                        <VolumeChart data={volumeData} />
                    </CardContent>
                </Card>
            </div>
        </AuthenticatedLayout>
    );
}
