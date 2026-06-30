import { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { Badge } from '@/Components/ui/badge';
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

interface VolumeDataPoint {
    label: string;
    count: number;
}

interface SectorStat {
    name: string;
    total: number;
}

interface ChannelStat {
    name: string;
    type: 'whatsapp' | 'telegram' | 'web';
    total: number;
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
    channelStats: ChannelStat[];
    topAttendants: TopAttendant[];
    period: string;
}

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

const CHANNEL_BAR_COLORS: Record<ChannelStat['type'], string> = {
    whatsapp: 'bg-green-500',
    telegram: 'bg-blue-500',
    web: 'bg-violet-500',
};

function ChannelIcon({ type, className }: { type: ChannelStat['type']; className?: string }) {
    if (type === 'telegram') return <TelegramIcon className={className} />;
    if (type === 'web') return <WebIcon className={className} />;
    return <WhatsAppIcon className={className} />;
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
            <div className="flex h-24 items-center justify-center text-sm text-muted-foreground sm:h-28">
                Sem conversas iniciadas no período.
            </div>
        );
    }

    const max = Math.max(...data.map((d) => d.count), 1);
    const total = data.length;
    const showEvery = total <= 7 ? 1 : total <= 14 ? 2 : total <= 24 ? 3 : 5;

    return (
        <div className="select-none space-y-1">
            <div className="flex h-24 items-end gap-px sm:h-28">
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
                                    <div
                                        className={cn(
                                            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                                            rank === 1
                                                ? 'bg-accent/15 text-accent'
                                                : 'bg-ink/[0.08] text-ink/70',
                                        )}
                                    >
                                        {getInitials(attendant.name)}
                                    </div>
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
    const maxSector   = Math.max(...sectorStats.map((s) => s.total), 1);
    const maxChannel  = Math.max(...channelStats.map((c) => c.total), 1);
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
                            <CardContent className="space-y-3 pt-2">
                                {channelStats.length === 0 ? (
                                    <p className="py-4 text-center text-sm text-muted-foreground">
                                        Sem conversas com canal definido.
                                    </p>
                                ) : (
                                    channelStats.map((c) => (
                                        <div key={`${c.type}-${c.name}`} className="space-y-1.5">
                                            <div className="flex items-center justify-between gap-2 text-sm">
                                                <span className="flex min-w-0 items-center gap-1.5 truncate font-medium">
                                                    <ChannelIcon type={c.type} className="h-3.5 w-3.5 shrink-0 opacity-70" />
                                                    {c.name}
                                                </span>
                                                <span className="shrink-0 tabular-nums text-muted-foreground">
                                                    {c.total}
                                                </span>
                                            </div>
                                            <div className="h-1.5 overflow-hidden rounded-full bg-ink/[0.08]">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-500 ${CHANNEL_BAR_COLORS[c.type]}`}
                                                    style={{
                                                        width: `${Math.round((c.total / maxChannel) * 100)}%`,
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    ))
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base">Por setor</CardTitle>
                                <p className="text-xs text-muted-foreground">Distribuição de conversas</p>
                            </CardHeader>
                            <CardContent className="space-y-3 pt-2">
                                {sectorStats.length === 0 ? (
                                    <p className="py-4 text-center text-sm text-muted-foreground">
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
