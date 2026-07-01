import { CHANNEL_BAR_COLORS, ChannelIcon, type ChannelType } from '@/Components/charts/ChannelIcons';
import { HorizontalBarChart } from '@/Components/charts/HorizontalBarChart';
import { VolumeChart } from '@/Components/charts/VolumeChart';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/Components/ui/tabs';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { formatDuration } from '@/lib/formatDuration';
import { tagDotClass } from '@/lib/tagColors';
import { cn } from '@/lib/utils';
import { PageProps } from '@/types';
import { Head, router } from '@inertiajs/react';
import {
    Activity,
    Award,
    BarChart2,
    Bot,
    Calendar,
    CheckCircle2,
    Clock,
    Download,
    Hourglass,
    Link2,
    MessageSquare,
    RefreshCw,
    Star,
    Timer,
    TrendingUp,
    UserRound,
    Users,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Filters {
    date_from: string;
    date_to: string;
    sector_id: number | null;
    user_id: number | null;
    tag_id: number | null;
    channel: string | null;
    tab: 'atendimentos' | 'atendentes' | 'clientes';
}

interface TagOption {
    id: number;
    name: string;
    color: string;
}

interface AtendimentosData {
    total_created: number;
    closed: number;
    resolution_rate: number;
    avg_handling_mins: number;
    avg_tme_mins: number;
    bot_only_pct: number;
    survey_completion_rate: number;
    survey_completed: number;
    avg_csat: number | null;
    csat_count: number;
    volume_data: { label: string; count: number }[];
    channel_stats: { name: string; type: ChannelType; total: number }[];
    sector_stats: { name: string; total: number }[];
    tag_stats: { id: number; name: string; color: string; total: number }[];
    hourly_stats: { label: string; count: number }[];
    status_stats: { status: string; label: string; total: number }[];
}

interface AttendantRow {
    user_id: number;
    name: string;
    closed: number;
    open: number;
    messages_sent: number;
    avg_mins: number;
    avg_tme_mins: number;
    avg_csat: number | null;
    csat_count: number;
}

interface AtendentesData {
    active_count: number;
    avg_closed: number;
    best_csat_name: string | null;
    best_csat_value: number | null;
    attendants: AttendantRow[];
}

interface ClientRow {
    contact_id: number;
    name: string;
    wa_id: string;
    channel_type: ChannelType | null;
    channel_name: string | null;
    conversations: number;
    first_at: string | null;
    last_at: string | null;
    ixc_linked: boolean;
}

interface ClientesData {
    unique_contacts: number;
    new_contacts: number;
    returning_count: number;
    return_rate: number;
    ixc_linked: number;
    channel_stats: { name: string; type: ChannelType; total: number }[];
    top_clients: ClientRow[];
}

interface Props extends PageProps {
    filters: Filters;
    sectors: { id: number; name: string }[];
    users: { id: number; name: string }[];
    tags: TagOption[];
    atendimentos: AtendimentosData;
    atendentes: AtendentesData;
    clientes: ClientesData;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
    return name
        .split(' ')
        .filter(Boolean)
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
}

function formatDate(iso: string | null): string {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        });
    } catch {
        return '—';
    }
}

function buildExportUrl(filters: Filters): string {
    const params = new URLSearchParams();
    params.set('tab', filters.tab);
    params.set('date_from', filters.date_from);
    params.set('date_to', filters.date_to);
    if (filters.sector_id) params.set('sector_id', String(filters.sector_id));
    if (filters.user_id) params.set('user_id', String(filters.user_id));
    if (filters.tag_id) params.set('tag_id', String(filters.tag_id));
    if (filters.channel) params.set('channel', filters.channel);
    return route('relatorios.export') + '?' + params.toString();
}

// ─── Stat card ───────────────────────────────────────────────────────────────

interface StatCardProps {
    label: string;
    value: string | number;
    sub: string;
    icon: React.ReactNode;
    iconBg: string;
}

function StatCard({ label, value, sub, icon, iconBg }: StatCardProps) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {label}
                </CardTitle>
                <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', iconBg)}>
                    {icon}
                </div>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold tracking-tight sm:text-3xl">{value}</div>
                <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
            </CardContent>
        </Card>
    );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function RelatoriosIndex({
    filters,
    sectors,
    users,
    tags,
    atendimentos,
    atendentes,
    clientes,
}: Props) {
    function applyFilters(updates: Partial<Filters>) {
        const next = { ...filters, ...updates };
        router.get(
            route('relatorios.index'),
            {
                date_from: next.date_from,
                date_to: next.date_to,
                sector_id: next.sector_id ?? '',
                user_id: next.user_id ?? '',
                tag_id: next.tag_id ?? '',
                channel: next.channel ?? '',
                tab: next.tab,
            },
            { preserveState: true, preserveScroll: true },
        );
    }

    function setPreset(preset: 'today' | 'week' | 'month') {
        const now = new Date();
        const to = now.toISOString().slice(0, 10);
        let from = to;
        if (preset === 'week') {
            const d = new Date(now);
            d.setDate(d.getDate() - d.getDay());
            from = d.toISOString().slice(0, 10);
        } else if (preset === 'month') {
            from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
        }
        applyFilters({ date_from: from, date_to: to });
    }

    const maxClosed = Math.max(...atendentes.attendants.map((a) => a.closed), 1);
    const periodLabel = `${formatDate(filters.date_from)} — ${formatDate(filters.date_to)}`;

    return (
        <AuthenticatedLayout header={<h2>Relatórios</h2>}>
            <Head title="Relatórios" />

            <div className="scrollbar-thin flex-1 overflow-y-auto p-6">
                <div className="flex flex-col gap-6">
                    {/* Header */}
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <h1 className="font-manrope text-xl font-bold text-ink">Relatórios</h1>
                            <p className="mt-1 text-sm text-ink/48">
                                Análise detalhada de atendimentos, equipe e clientes
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => applyFilters({})}
                                className="gap-1.5"
                            >
                                <RefreshCw className="h-3.5 w-3.5" />
                                Atualizar
                            </Button>
                            <Button variant="outline" size="sm" asChild>
                                <a href={buildExportUrl(filters)} download className="gap-1.5">
                                    <Download className="h-3.5 w-3.5" />
                                    Exportar CSV
                                </a>
                            </Button>
                        </div>
                    </div>

                    {/* Filters */}
                    <Card className="border-accent/10">
                        <CardContent className="flex flex-col gap-3 p-4">
                            <div className="flex flex-wrap items-center gap-2">
                                <div className="flex items-center gap-1.5 rounded-xl border border-accent/15 bg-ink/[0.02] px-2 py-1">
                                    <Calendar className="h-3.5 w-3.5 text-ink/40" />
                                    <Input
                                        type="date"
                                        value={filters.date_from}
                                        onChange={(e) => applyFilters({ date_from: e.target.value })}
                                        className="h-8 w-36 border-0 bg-transparent px-1 text-xs shadow-none"
                                    />
                                    <span className="text-xs text-ink/35">até</span>
                                    <Input
                                        type="date"
                                        value={filters.date_to}
                                        onChange={(e) => applyFilters({ date_to: e.target.value })}
                                        className="h-8 w-36 border-0 bg-transparent px-1 text-xs shadow-none"
                                    />
                                </div>

                                <Select
                                    value={filters.sector_id ? String(filters.sector_id) : 'all'}
                                    onValueChange={(v) =>
                                        applyFilters({ sector_id: v === 'all' ? null : Number(v) })
                                    }
                                >
                                    <SelectTrigger className="h-8 w-40 text-xs">
                                        <SelectValue placeholder="Setor" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todos os setores</SelectItem>
                                        {sectors.map((s) => (
                                            <SelectItem key={s.id} value={String(s.id)}>
                                                {s.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <Select
                                    value={filters.channel ?? 'all'}
                                    onValueChange={(v) =>
                                        applyFilters({ channel: v === 'all' ? null : v })
                                    }
                                >
                                    <SelectTrigger className="h-8 w-36 text-xs">
                                        <SelectValue placeholder="Canal" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todos os canais</SelectItem>
                                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                                        <SelectItem value="telegram">Telegram</SelectItem>
                                        <SelectItem value="web">Web</SelectItem>
                                    </SelectContent>
                                </Select>

                                <Select
                                    value={filters.user_id ? String(filters.user_id) : 'all'}
                                    onValueChange={(v) =>
                                        applyFilters({ user_id: v === 'all' ? null : Number(v) })
                                    }
                                >
                                    <SelectTrigger className="h-8 w-40 text-xs">
                                        <SelectValue placeholder="Atendente" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todos os atendentes</SelectItem>
                                        {users.map((u) => (
                                            <SelectItem key={u.id} value={String(u.id)}>
                                                {u.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <Select
                                    value={filters.tag_id ? String(filters.tag_id) : 'all'}
                                    onValueChange={(v) =>
                                        applyFilters({ tag_id: v === 'all' ? null : Number(v) })
                                    }
                                >
                                    <SelectTrigger className="h-8 w-36 text-xs">
                                        <SelectValue placeholder="Etiqueta" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todas as etiquetas</SelectItem>
                                        {tags.map((t) => (
                                            <SelectItem key={t.id} value={String(t.id)}>
                                                {t.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                                    Atalhos:
                                </span>
                                {(['today', 'week', 'month'] as const).map((preset) => (
                                    <Button
                                        key={preset}
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs"
                                        onClick={() => setPreset(preset)}
                                    >
                                        {preset === 'today' ? 'Hoje' : preset === 'week' ? 'Esta semana' : 'Este mês'}
                                    </Button>
                                ))}
                                <Badge variant="outline" className="ml-auto text-xs">
                                    {periodLabel}
                                </Badge>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Tabs */}
                    <Tabs
                        value={filters.tab}
                        onValueChange={(tab) =>
                            applyFilters({ tab: tab as Filters['tab'] })
                        }
                    >
                        <TabsList className="grid w-full max-w-md grid-cols-3">
                            <TabsTrigger value="atendimentos">Atendimentos</TabsTrigger>
                            <TabsTrigger value="atendentes">Atendentes</TabsTrigger>
                            <TabsTrigger value="clientes">Clientes</TabsTrigger>
                        </TabsList>

                        {/* ── Atendimentos ── */}
                        <TabsContent value="atendimentos" className="mt-4 space-y-4">
                            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                                <StatCard
                                    label="Total criadas"
                                    value={atendimentos.total_created}
                                    sub="conversas no período"
                                    icon={<MessageSquare className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
                                    iconBg="bg-blue-50 dark:bg-blue-900/20"
                                />
                                <StatCard
                                    label="Encerradas"
                                    value={atendimentos.closed}
                                    sub={`${atendimentos.resolution_rate}% de resolução`}
                                    icon={<CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />}
                                    iconBg="bg-green-50 dark:bg-green-900/20"
                                />
                                <StatCard
                                    label="TME"
                                    value={atendimentos.avg_tme_mins > 0 ? formatDuration(atendimentos.avg_tme_mins) : '—'}
                                    sub="tempo médio de espera na fila"
                                    icon={<Hourglass className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />}
                                    iconBg="bg-cyan-50 dark:bg-cyan-900/20"
                                />
                                <StatCard
                                    label="TMA"
                                    value={atendimentos.avg_handling_mins > 0 ? formatDuration(atendimentos.avg_handling_mins) : '—'}
                                    sub="tempo médio de atendimento"
                                    icon={<Timer className="h-4 w-4 text-orange-600 dark:text-orange-400" />}
                                    iconBg="bg-orange-50 dark:bg-orange-900/20"
                                />
                                <StatCard
                                    label="CSAT médio"
                                    value={atendimentos.avg_csat !== null ? `${atendimentos.avg_csat}/5` : '—'}
                                    sub={atendimentos.csat_count > 0 ? `${atendimentos.csat_count} avaliações` : 'sem avaliações'}
                                    icon={<Star className="h-4 w-4 text-amber-500 dark:text-amber-400" />}
                                    iconBg="bg-amber-50 dark:bg-amber-900/20"
                                />
                                <StatCard
                                    label="Somente bot"
                                    value={`${atendimentos.bot_only_pct}%`}
                                    sub="sem atendente humano"
                                    icon={<Bot className="h-4 w-4 text-purple-600 dark:text-purple-400" />}
                                    iconBg="bg-purple-50 dark:bg-purple-900/20"
                                />
                                <StatCard
                                    label="Pesquisas"
                                    value={`${atendimentos.survey_completion_rate}%`}
                                    sub={`${atendimentos.survey_completed} concluídas`}
                                    icon={<Activity className="h-4 w-4 text-teal-600 dark:text-teal-400" />}
                                    iconBg="bg-teal-50 dark:bg-teal-900/20"
                                />
                                <StatCard
                                    label="Taxa resolução"
                                    value={atendimentos.resolution_rate > 0 ? `${atendimentos.resolution_rate}%` : '—'}
                                    sub="encerradas / criadas"
                                    icon={<TrendingUp className="h-4 w-4 text-rose-600 dark:text-rose-400" />}
                                    iconBg="bg-rose-50 dark:bg-rose-900/20"
                                />
                            </div>

                            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="flex items-center gap-2 text-base">
                                            <BarChart2 className="h-4 w-4 text-muted-foreground" />
                                            Volume diário
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="pb-4">
                                        <VolumeChart data={atendimentos.volume_data} />
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="flex items-center gap-2 text-base">
                                            <Clock className="h-4 w-4 text-muted-foreground" />
                                            Picos por horário
                                        </CardTitle>
                                        <p className="text-xs text-muted-foreground">Distribuição por hora do dia</p>
                                    </CardHeader>
                                    <CardContent className="pb-4">
                                        <VolumeChart
                                            data={atendimentos.hourly_stats}
                                            emptyLabel="Sem conversas no período."
                                        />
                                    </CardContent>
                                </Card>
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-base">Por canal</CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-2">
                                        <HorizontalBarChart
                                            items={atendimentos.channel_stats.map((c) => ({
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
                                        />
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-base">Por setor</CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-2">
                                        <HorizontalBarChart
                                            items={atendimentos.sector_stats.map((s) => ({
                                                key: s.name,
                                                label: s.name,
                                                value: s.total,
                                            }))}
                                        />
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-base">Por etiqueta</CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-2">
                                        <HorizontalBarChart
                                            items={atendimentos.tag_stats.map((t) => ({
                                                key: String(t.id),
                                                label: (
                                                    <span className="flex items-center gap-1.5">
                                                        <span
                                                            className={cn('h-2 w-2 shrink-0 rounded-full', tagDotClass(t.color))}
                                                        />
                                                        {t.name}
                                                    </span>
                                                ),
                                                value: t.total,
                                            }))}
                                            emptyLabel="Sem etiquetas no período."
                                        />
                                    </CardContent>
                                </Card>
                            </div>

                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-base">Por status</CardTitle>
                                </CardHeader>
                                <CardContent className="pt-2">
                                    <HorizontalBarChart
                                        items={atendimentos.status_stats.map((s) => ({
                                            key: s.status,
                                            label: s.label,
                                            value: s.total,
                                        }))}
                                    />
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* ── Atendentes ── */}
                        <TabsContent value="atendentes" className="mt-4 space-y-4">
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                <StatCard
                                    label="Com atividade"
                                    value={atendentes.active_count}
                                    sub="atendentes no período"
                                    icon={<Users className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />}
                                    iconBg="bg-indigo-50 dark:bg-indigo-900/20"
                                />
                                <StatCard
                                    label="Média encerrados"
                                    value={atendentes.avg_closed}
                                    sub="por atendente ativo"
                                    icon={<CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />}
                                    iconBg="bg-green-50 dark:bg-green-900/20"
                                />
                                <StatCard
                                    label="Melhor CSAT"
                                    value={
                                        atendentes.best_csat_value !== null
                                            ? `${atendentes.best_csat_value}/5`
                                            : '—'
                                    }
                                    sub={atendentes.best_csat_name ?? 'sem avaliações'}
                                    icon={<Award className="h-4 w-4 text-amber-500 dark:text-amber-400" />}
                                    iconBg="bg-amber-50 dark:bg-amber-900/20"
                                />
                            </div>

                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="flex items-center gap-2 text-base">
                                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                                        Performance da equipe
                                    </CardTitle>
                                    <p className="text-xs text-muted-foreground">
                                        Ranking por atendimentos encerrados no período
                                    </p>
                                </CardHeader>
                                <CardContent className="p-0">
                                    {atendentes.attendants.length === 0 ? (
                                        <div className="flex flex-col items-center gap-3 py-16 text-center">
                                            <Award className="h-10 w-10 text-ink/20" />
                                            <p className="font-medium text-ink/50">Nenhum atendente com dados no período</p>
                                        </div>
                                    ) : (
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="hover:bg-transparent">
                                                    <TableHead className="w-10 pl-6">#</TableHead>
                                                    <TableHead>Atendente</TableHead>
                                                    <TableHead className="text-right">Enc.</TableHead>
                                                    <TableHead className="text-right">Aber.</TableHead>
                                                    <TableHead className="text-right">Msgs</TableHead>
                                                    <TableHead className="text-right">TME</TableHead>
                                                    <TableHead className="text-right">TMA</TableHead>
                                                    <TableHead className="pr-6 text-right">CSAT</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {atendentes.attendants.map((attendant, index) => {
                                                    const rank = index + 1;
                                                    const pct = Math.max(
                                                        4,
                                                        Math.round((attendant.closed / maxClosed) * 100),
                                                    );

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
                                                                    <Award className="h-4 w-4 text-accent" />
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
                                                                        <div className="truncate text-sm font-medium">
                                                                            {attendant.name}
                                                                        </div>
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
                                                            <TableCell className="text-right tabular-nums font-semibold">
                                                                {attendant.closed}
                                                            </TableCell>
                                                            <TableCell className="text-right tabular-nums text-muted-foreground">
                                                                {attendant.open}
                                                            </TableCell>
                                                            <TableCell className="text-right tabular-nums text-muted-foreground">
                                                                {attendant.messages_sent}
                                                            </TableCell>
                                                            <TableCell className="text-right tabular-nums text-muted-foreground">
                                                                {attendant.avg_tme_mins > 0
                                                                    ? formatDuration(attendant.avg_tme_mins)
                                                                    : '—'}
                                                            </TableCell>
                                                            <TableCell className="text-right tabular-nums text-muted-foreground">
                                                                {attendant.avg_mins > 0
                                                                    ? formatDuration(attendant.avg_mins)
                                                                    : '—'}
                                                            </TableCell>
                                                            <TableCell className="pr-6 text-right tabular-nums">
                                                                {attendant.avg_csat !== null
                                                                    ? `${attendant.avg_csat}/5`
                                                                    : '—'}
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* ── Clientes ── */}
                        <TabsContent value="clientes" className="mt-4 space-y-4">
                            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                                <StatCard
                                    label="Contatos únicos"
                                    value={clientes.unique_contacts}
                                    sub="no período"
                                    icon={<Users className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />}
                                    iconBg="bg-indigo-50 dark:bg-indigo-900/20"
                                />
                                <StatCard
                                    label="Novos"
                                    value={clientes.new_contacts}
                                    sub="primeira conversa"
                                    icon={<UserRound className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
                                    iconBg="bg-blue-50 dark:bg-blue-900/20"
                                />
                                <StatCard
                                    label="Retornantes"
                                    value={clientes.returning_count}
                                    sub={`${clientes.return_rate}% dos contatos`}
                                    icon={<RefreshCw className="h-4 w-4 text-teal-600 dark:text-teal-400" />}
                                    iconBg="bg-teal-50 dark:bg-teal-900/20"
                                />
                                <StatCard
                                    label="IXC vinculados"
                                    value={clientes.ixc_linked}
                                    sub="clientes com ERP"
                                    icon={<Link2 className="h-4 w-4 text-violet-600 dark:text-violet-400" />}
                                    iconBg="bg-violet-50 dark:bg-violet-900/20"
                                />
                                <StatCard
                                    label="Taxa retorno"
                                    value={clientes.return_rate > 0 ? `${clientes.return_rate}%` : '—'}
                                    sub="clientes recorrentes"
                                    icon={<TrendingUp className="h-4 w-4 text-rose-600 dark:text-rose-400" />}
                                    iconBg="bg-rose-50 dark:bg-rose-900/20"
                                />
                            </div>

                            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                                <Card className="lg:col-span-1">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-base">Por canal</CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-2">
                                        <HorizontalBarChart
                                            items={clientes.channel_stats.map((c) => ({
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
                                        />
                                    </CardContent>
                                </Card>

                                <Card className="lg:col-span-2">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-base">Top clientes</CardTitle>
                                        <p className="text-xs text-muted-foreground">
                                            Clientes com mais conversas no período
                                        </p>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        {clientes.top_clients.length === 0 ? (
                                            <div className="flex flex-col items-center gap-3 py-16 text-center">
                                                <Users className="h-10 w-10 text-ink/20" />
                                                <p className="font-medium text-ink/50">Nenhum cliente no período</p>
                                            </div>
                                        ) : (
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="hover:bg-transparent">
                                                        <TableHead className="pl-6">Cliente</TableHead>
                                                        <TableHead>Canal</TableHead>
                                                        <TableHead className="text-right">Conversas</TableHead>
                                                        <TableHead>Primeira</TableHead>
                                                        <TableHead className="pr-6">Última</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {clientes.top_clients.map((client) => (
                                                        <TableRow key={client.contact_id} className="border-ink/[0.06]">
                                                            <TableCell className="pl-6">
                                                                <div className="min-w-0">
                                                                    <div className="truncate text-sm font-medium">
                                                                        {client.name}
                                                                    </div>
                                                                    <div className="truncate text-xs text-muted-foreground">
                                                                        {client.wa_id}
                                                                    </div>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell>
                                                                {client.channel_type ? (
                                                                    <span className="flex items-center gap-1.5 text-sm">
                                                                        <ChannelIcon
                                                                            type={client.channel_type}
                                                                            className="h-3.5 w-3.5 opacity-70"
                                                                        />
                                                                        {client.channel_name}
                                                                    </span>
                                                                ) : (
                                                                    '—'
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="text-right tabular-nums font-semibold">
                                                                {client.conversations}
                                                            </TableCell>
                                                            <TableCell className="text-sm text-muted-foreground">
                                                                {formatDate(client.first_at)}
                                                            </TableCell>
                                                            <TableCell className="pr-6 text-sm text-muted-foreground">
                                                                {formatDate(client.last_at)}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}