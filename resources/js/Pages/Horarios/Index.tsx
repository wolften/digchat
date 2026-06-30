import { Button } from '@/Components/ui/button';
import { Card } from '@/Components/ui/card';
import { Label } from '@/Components/ui/label';
import { Switch } from '@/Components/ui/switch';
import { Textarea } from '@/Components/ui/textarea';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { cn } from '@/lib/utils';
import { Head, router } from '@inertiajs/react';
import { Clock } from 'lucide-react';
import { useState } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface HourRow {
    weekday: number;   // 0=Sunday … 6=Saturday
    opens_at: string;  // "HH:MM"
    closes_at: string;
    is_active: boolean;
}

interface TabState {
    hours: HourRow[];
    out_of_hours_enabled: boolean;
    out_of_hours_message: string;
}

interface Sector {
    id: number;
    name: string;
    out_of_hours_enabled: boolean;
    out_of_hours_message: string | null;
}

interface Props {
    sectors: Sector[];
    hoursMap: Record<string, HourRow[]>;  // 'global' | sector_id string
    global: { out_of_hours_enabled: boolean; out_of_hours_message: string };
}

// ─── Constants ───────────────────────────────────────────────────────────────

// Display order: Mon → Fri → Sat → Sun
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

const WEEKDAY_LABELS: Record<number, string> = {
    0: 'Domingo',
    1: 'Segunda-feira',
    2: 'Terça-feira',
    3: 'Quarta-feira',
    4: 'Quinta-feira',
    5: 'Sexta-feira',
    6: 'Sábado',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function defaultHours(): HourRow[] {
    return WEEKDAY_ORDER.map((w) => ({
        weekday: w,
        opens_at: '08:00',
        closes_at: '18:00',
        is_active: w >= 1 && w <= 5,
    }));
}

function mergeHours(serverRows: HourRow[] | undefined): HourRow[] {
    const base = defaultHours();
    if (!serverRows || serverRows.length === 0) return base;
    return base.map((def) => serverRows.find((h) => h.weekday === def.weekday) ?? def);
}

function buildInitialStates(
    sectors: Sector[],
    hoursMap: Record<string, HourRow[]>,
    global: Props['global'],
): Record<string, TabState> {
    const states: Record<string, TabState> = {
        global: {
            hours: mergeHours(hoursMap['global']),
            out_of_hours_enabled: global.out_of_hours_enabled,
            out_of_hours_message: global.out_of_hours_message ?? '',
        },
    };
    for (const s of sectors) {
        states[String(s.id)] = {
            hours: mergeHours(hoursMap[String(s.id)]),
            out_of_hours_enabled: s.out_of_hours_enabled,
            out_of_hours_message: s.out_of_hours_message ?? '',
        };
    }
    return states;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function HorariosIndex({ sectors, hoursMap, global }: Props) {
    const [activeTab, setActiveTab] = useState<string>('global');
    const [states, setStates] = useState<Record<string, TabState>>(() =>
        buildInitialStates(sectors, hoursMap, global),
    );
    const [processing, setProcessing] = useState(false);

    const tab = states[activeTab] ?? states['global'];

    // ── Mutators ──────────────────────────────────────────────────────────────

    const setHourField = (weekday: number, field: keyof HourRow, value: string | boolean) => {
        setStates((prev) => ({
            ...prev,
            [activeTab]: {
                ...prev[activeTab],
                hours: prev[activeTab].hours.map((h) =>
                    h.weekday === weekday ? { ...h, [field]: value } : h,
                ),
            },
        }));
    };

    const setTabField = <K extends 'out_of_hours_enabled' | 'out_of_hours_message'>(
        field: K,
        value: TabState[K],
    ) => {
        setStates((prev) => ({
            ...prev,
            [activeTab]: { ...prev[activeTab], [field]: value },
        }));
    };

    // ── Submit ────────────────────────────────────────────────────────────────

    const save = () => {
        setProcessing(true);
        router.put(
            route('horarios.update'),
            {
                sector_id: activeTab === 'global' ? null : Number(activeTab),
                hours: tab.hours as unknown as Record<string, string | number | boolean>[],
                out_of_hours_enabled: tab.out_of_hours_enabled,
                out_of_hours_message: tab.out_of_hours_message,
            },
            {
                preserveState: true,
                preserveScroll: true,
                onFinish: () => setProcessing(false),
            },
        );
    };

    // ── Tabs definition ───────────────────────────────────────────────────────

    const tabs = [
        { key: 'global', label: 'Padrão' },
        ...sectors.map((s) => ({ key: String(s.id), label: s.name })),
    ];

    // ─────────────────────────────────────────────────────────────────────────

    return (
        <AuthenticatedLayout>
            <Head title="Horários de Atendimento" />

            <div className="space-y-4 p-6">
                {/* Header */}
                <div>
                    <h1 className="font-manrope text-xl font-bold">Horários de Atendimento</h1>
                    <p className="text-sm text-ink/60">
                        Configure os horários por setor. Fora do horário, o bot envia uma resposta automática.
                    </p>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 rounded-xl border border-ink/[0.08] bg-ink/[0.02] p-1">
                    {tabs.map((t) => (
                        <button
                            key={t.key}
                            type="button"
                            onClick={() => setActiveTab(t.key)}
                            className={cn(
                                'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                                activeTab === t.key
                                    ? 'bg-canvas text-ink shadow-sm'
                                    : 'text-ink/50 hover:text-ink/80',
                            )}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* Weekday table */}
                <Card className="overflow-hidden">
                    <div className="border-b border-ink/[0.08] bg-ink/[0.02] px-4 py-2.5">
                        <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">
                            Horários da semana
                        </p>
                    </div>
                    <div className="divide-y divide-ink/[0.06]">
                        {tab.hours.map((row) => (
                            <div
                                key={row.weekday}
                                className={cn(
                                    'flex items-center gap-4 px-4 py-3 transition-colors',
                                    !row.is_active && 'opacity-50',
                                )}
                            >
                                {/* Active toggle */}
                                <Switch
                                    checked={row.is_active}
                                    onCheckedChange={(v) => setHourField(row.weekday, 'is_active', v)}
                                />

                                {/* Weekday label */}
                                <span className="w-36 text-sm font-medium text-ink/80">
                                    {WEEKDAY_LABELS[row.weekday]}
                                </span>

                                {/* Time inputs */}
                                <div className="flex items-center gap-2">
                                    <input
                                        type="time"
                                        value={row.opens_at}
                                        disabled={!row.is_active}
                                        onChange={(e) => setHourField(row.weekday, 'opens_at', e.target.value)}
                                        className="rounded-lg border border-ink/[0.15] bg-canvas px-2.5 py-1.5 text-sm text-ink disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-accent/30"
                                    />
                                    <span className="text-sm text-ink/40">até</span>
                                    <input
                                        type="time"
                                        value={row.closes_at}
                                        disabled={!row.is_active}
                                        onChange={(e) => setHourField(row.weekday, 'closes_at', e.target.value)}
                                        className="rounded-lg border border-ink/[0.15] bg-canvas px-2.5 py-1.5 text-sm text-ink disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-accent/30"
                                    />
                                </div>

                                {/* Closed label */}
                                {!row.is_active && (
                                    <span className="text-xs text-ink/35">Fechado</span>
                                )}
                            </div>
                        ))}
                    </div>
                </Card>

                {/* Out-of-hours section */}
                <Card className="overflow-hidden">
                    <div className="border-b border-ink/[0.08] bg-ink/[0.02] px-4 py-2.5">
                        <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">
                            Resposta automática fora do horário
                        </p>
                    </div>
                    <div className="space-y-4 p-4">
                        <div className="flex items-center gap-3">
                            <Switch
                                id="ooh-enabled"
                                checked={tab.out_of_hours_enabled}
                                onCheckedChange={(v) => setTabField('out_of_hours_enabled', v)}
                            />
                            <Label htmlFor="ooh-enabled" className="cursor-pointer">
                                Enviar mensagem automática quando fora do horário
                            </Label>
                        </div>

                        {tab.out_of_hours_enabled && (
                            <div className="space-y-1.5">
                                <Label htmlFor="ooh-message" className="text-sm text-ink/70">
                                    Mensagem
                                </Label>
                                <Textarea
                                    id="ooh-message"
                                    value={tab.out_of_hours_message}
                                    onChange={(e) => setTabField('out_of_hours_message', e.target.value)}
                                    placeholder="Ex: Olá! Nosso atendimento funciona de segunda a sexta das 8h às 18h. Retornaremos em breve!"
                                    rows={3}
                                    maxLength={1000}
                                    className="resize-none"
                                />
                                <p className="text-right text-xs text-ink/35">
                                    {tab.out_of_hours_message.length}/1000
                                </p>
                            </div>
                        )}

                        {tab.out_of_hours_enabled && !tab.out_of_hours_message && (
                            <p className="text-xs text-amber-600 dark:text-amber-400">
                                Defina uma mensagem para ser enviada fora do horário.
                            </p>
                        )}
                    </div>
                </Card>

                {/* Bot behavior note */}
                <div className="flex items-start gap-2.5 rounded-xl border border-accent/20 bg-accent/5 p-3.5">
                    <Clock className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    <p className="text-sm text-ink/70">
                        <strong className="font-semibold text-ink/85">Comportamento do bot:</strong>{' '}
                        fora do horário, o fluxo não é executado e a mensagem automática é enviada (máximo 1 vez a cada 4 horas por conversa).
                        No editor de fluxos, use o nó{' '}
                        <code className="rounded bg-ink/[0.06] px-1 py-0.5 text-xs font-mono">horário de atendimento</code>{' '}
                        para criar ramificações aberto/fechado dentro do fluxo.
                    </p>
                </div>

                {/* Save */}
                <div className="flex justify-end">
                    <Button onClick={save} disabled={processing}>
                        {processing ? 'Salvando…' : 'Salvar horários'}
                    </Button>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
