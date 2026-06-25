import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/Components/ui/dialog';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { Switch } from '@/Components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/Components/ui/tabs';
import { Textarea } from '@/Components/ui/textarea';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { cn, formatClientPhone } from '@/lib/utils';
import { Head, router } from '@inertiajs/react';
import axios from 'axios';
import {
    BarChart3,
    CheckCircle2,
    ChevronRight,
    Loader2,
    MessageSquare,
    Pencil,
    Plus,
    Smile,
    Trash2,
    TrendingUp,
    Users,
    X,
} from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';

/* ── Types ──────────────────────────────────────────────────────── */

interface Option {
    id: string;
    label: string;
}

interface Question {
    id?: number;
    text: string;
    position: number;
    options: Option[];
    [key: string]: unknown;
}

interface Survey {
    id: number;
    name: string;
    description: string | null;
    is_active: boolean;
    thank_you_message: string;
    questions_count: number;
    responses_count: number;
    completed_responses_count: number;
    questions: Question[];
    created_at: string;
}

interface AnswerDist {
    option_id: string;
    option_label: string;
    count: number;
}

interface QuestionStat {
    question_id: number;
    question_text: string;
    options: Option[];
    total: number;
    distribution: AnswerDist[];
}

interface ResponsesData {
    stats: QuestionStat[];
    totals: Record<string, number>;
    recent: { id: number; contact_name: string; contact_wa_id: string | null; completed_at: string }[];
}

interface ResponseDetail {
    contact_name: string;
    contact_wa_id: string | null;
    completed_at: string;
    answers: { question_text: string; option_label: string }[];
}

interface Props {
    surveys: Survey[];
}

/* ── Helpers ────────────────────────────────────────────────────── */

function slugify(text: string): string {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .substring(0, 50) || 'opcao';
}

function newOption(): Option {
    return { id: '', label: '' };
}

function newQuestion(position: number): Question {
    return { text: '', position, options: [newOption(), newOption()] };
}

/* ── Question editor ────────────────────────────────────────────── */

function QuestionEditor({
    question,
    index,
    onChange,
    onRemove,
}: {
    question: Question;
    index: number;
    onChange: (q: Question) => void;
    onRemove: () => void;
}) {
    const updateOption = (i: number, partial: Partial<Option>) => {
        const opts = question.options.map((o, idx) => {
            if (idx !== i) return o;
            const updated = { ...o, ...partial };
            // auto-set id from label if id wasn't manually set
            if ('label' in partial && o.id === slugify(o.label)) {
                updated.id = slugify(updated.label);
            }
            return updated;
        });
        onChange({ ...question, options: opts });
    };

    const addOption = () =>
        onChange({ ...question, options: [...question.options, newOption()] });

    const removeOption = (i: number) =>
        onChange({ ...question, options: question.options.filter((_, idx) => idx !== i) });

    return (
        <div className="rounded-xl border border-accent/15 bg-ink/[0.02] p-4 transition-colors hover:border-accent/25">
            <div className="mb-3 flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-semibold text-accent">
                    {index + 1}
                </span>
                <Input
                    value={question.text}
                    onChange={(e) => onChange({ ...question, text: e.target.value })}
                    placeholder="Texto da pergunta…"
                    className="h-8 flex-1 text-sm"
                />
                <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0 text-ink/35 hover:text-red-400"
                    onClick={onRemove}
                >
                    <X className="h-3.5 w-3.5" />
                </Button>
            </div>

            <div className="ml-8 space-y-1.5">
                <p className="text-[11px] font-medium uppercase tracking-wider text-ink/35">
                    Opções de resposta
                </p>
                {question.options.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-accent/20 bg-accent/8 text-[10px] font-mono text-accent/70">
                            {i + 1}
                        </div>
                        <Input
                            value={opt.label}
                            onChange={(e) => {
                                const label = e.target.value;
                                updateOption(i, {
                                    label,
                                    id: opt.id === slugify(opt.label) || opt.id === '' ? slugify(label) : opt.id,
                                });
                            }}
                            placeholder={`Opção ${i + 1} (ex: 😊 Ótimo)`}
                            className="h-7 flex-1 text-xs"
                        />
                        {question.options.length > 1 && (
                            <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 shrink-0 text-ink/25 hover:text-red-400"
                                onClick={() => removeOption(i)}
                            >
                                <X className="h-3 w-3" />
                            </Button>
                        )}
                    </div>
                ))}
                {question.options.length < 10 && (
                    <button
                        type="button"
                        onClick={addOption}
                        className="mt-1 flex items-center gap-1.5 text-xs text-accent/60 transition-colors hover:text-accent"
                    >
                        <Plus className="h-3 w-3" />
                        Adicionar opção
                    </button>
                )}
            </div>
        </div>
    );
}

/* ── Main page ───────────────────────────────────────────────────── */

export default function PesquisasIndex({ surveys: initial }: Props) {
    const [surveys, setSurveys]         = useState<Survey[]>(initial);
    const [selectedId, setSelectedId]   = useState<number | null>(null);
    const [activeTab, setActiveTab]     = useState('questions');

    // Create / edit dialog
    const [showDialog, setShowDialog]   = useState(false);
    const [editing, setEditing]         = useState<Survey | null>(null);
    const [dialogQs, setDialogQs]       = useState<Question[]>([]);

    // Inline question editing (right panel)
    const [editingQs, setEditingQs]     = useState(false);
    const [localQs, setLocalQs]         = useState<Question[]>([]);

    // Responses
    const [respData, setRespData]       = useState<ResponsesData | null>(null);
    const [respLoading, setRespLoading] = useState(false);

    const [detailOpen, setDetailOpen]     = useState(false);
    const [detailData, setDetailData]     = useState<ResponseDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);

    const openDetail = (responseId: number) => {
        setDetailData(null);
        setDetailOpen(true);
        setDetailLoading(true);
        axios
            .get<ResponseDetail>(route('pesquisas.response.detail', responseId))
            .then((r) => setDetailData(r.data))
            .catch(() => setDetailOpen(false))
            .finally(() => setDetailLoading(false));
    };

    const selected = surveys.find((s) => s.id === selectedId) ?? null;

    useEffect(() => {
        setSurveys(initial);
        setSelectedId((prev) =>
            prev != null && initial.some((s) => s.id === prev) ? prev : null,
        );
    }, [initial]);

    useEffect(() => {
        if (activeTab !== 'responses' || !selectedId) return;
        setRespData(null);
        setRespLoading(true);
        axios
            .get<ResponsesData>(route('pesquisas.responses', selectedId))
            .then((r) => setRespData(r.data))
            .catch(() => setRespData(null))
            .finally(() => setRespLoading(false));
    }, [activeTab, selectedId]);

    /* ── Dialog ── */

    const [formData, setFormData] = useState({ name: '', description: '', is_active: false, thank_you_message: 'Obrigado pela sua avaliação! 🙏' });
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [formProcessing, setFormProcessing] = useState(false);

    const openCreate = () => {
        setEditing(null);
        setFormData({ name: '', description: '', is_active: false, thank_you_message: 'Obrigado pela sua avaliação! 🙏' });
        setFormErrors({});
        setDialogQs([newQuestion(0)]);
        setShowDialog(true);
    };

    const openEdit = (survey: Survey) => {
        setEditing(survey);
        setFormErrors({});
        setFormData({
            name:              survey.name,
            description:       survey.description ?? '',
            is_active:         survey.is_active,
            thank_you_message: survey.thank_you_message,
        });
        setDialogQs(survey.questions.map((q) => ({ ...q, options: [...(q.options ?? [])] })));
        setShowDialog(true);
    };

    const submitDialog = (e: FormEvent) => {
        e.preventDefault();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const payload: any = { ...formData, questions: dialogQs };
        setFormProcessing(true);

        const opts = {
            preserveScroll: true,
            onSuccess: () => { setShowDialog(false); setFormProcessing(false); },
            onError: (e: Record<string, string>) => { setFormErrors(e); setFormProcessing(false); },
            onFinish: () => setFormProcessing(false),
        };

        if (editing) {
            router.put(route('pesquisas.update', editing.id), payload, opts);
        } else {
            router.post(route('pesquisas.store'), payload, opts);
        }
    };

    /* ── Inline question edit ── */

    const startEditQs = () => {
        setLocalQs(selected?.questions.map((q) => ({ ...q, options: [...(q.options ?? [])] })) ?? []);
        setEditingQs(true);
    };

    const saveQs = () => {
        if (!selectedId) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const payload: any = { questions: localQs };
        router.post(
            route('pesquisas.questions.sync', selectedId),
            payload,
            { preserveScroll: true, onSuccess: () => setEditingQs(false) },
        );
    };

    /* ── Misc ── */

    const toggleActive = (survey: Survey) =>
        router.put(
            route('pesquisas.update', survey.id),
            { name: survey.name, description: survey.description, is_active: !survey.is_active, thank_you_message: survey.thank_you_message },
            { preserveScroll: true },
        );

    const deleteSurvey = (survey: Survey) => {
        if (!confirm(`Excluir "${survey.name}"? Todas as respostas serão removidas.`)) return;
        router.delete(route('pesquisas.destroy', survey.id), { preserveScroll: true });
    };

    const isDialogValid =
        formData.name.trim() !== '' &&
        dialogQs.length > 0 &&
        dialogQs.every(
            (q) =>
                q.text.trim() !== '' &&
                q.options.length > 0 &&
                q.options.every((o) => o.label.trim() !== ''),
        );

    const isLocalQsValid =
        localQs.length > 0 &&
        localQs.every(
            (q) =>
                q.text.trim() !== '' &&
                q.options.length > 0 &&
                q.options.every((o) => o.label.trim() !== ''),
        );

    /* ── Render ── */

    return (
        <AuthenticatedLayout header={<h2>Pesquisas</h2>}>
            <Head title="Pesquisas de Satisfação" />

            <div className="flex min-h-0 flex-1 overflow-hidden">

                {/* ══ Left panel ══ */}
                <aside className="scrollbar-thin flex w-72 shrink-0 flex-col overflow-y-auto border-r border-accent/10">
                    <div
                        className="sticky top-0 z-10 flex items-center justify-between border-b border-accent/10 px-4 py-3"
                        style={{ background: 'var(--sidebar-surface)' }}
                    >
                        <p className="text-xs font-semibold uppercase tracking-widest text-ink/40">
                            Pesquisas
                        </p>
                        <Button size="sm" className="h-7 gap-1 text-xs" onClick={openCreate}>
                            <Plus className="h-3.5 w-3.5" />
                            Nova
                        </Button>
                    </div>

                    <div className="flex-1 p-2">
                        {surveys.length === 0 ? (
                            <div className="flex flex-col items-center gap-2 py-10 text-center">
                                <MessageSquare className="h-8 w-8 text-ink/20" />
                                <p className="text-sm text-ink/40">Nenhuma pesquisa</p>
                                <p className="text-xs text-ink/30">Crie sua primeira pesquisa de satisfação</p>
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {surveys.map((s) => (
                                    <button
                                        key={s.id}
                                        type="button"
                                        onClick={() => {
                                            setSelectedId(s.id);
                                            setEditingQs(false);
                                            setActiveTab('questions');
                                        }}
                                        className={cn(
                                            'group w-full rounded-xl px-3 py-3 text-left transition-all',
                                            selectedId === s.id
                                                ? 'bg-accent/12 ring-1 ring-accent/25'
                                                : 'hover:bg-ink/[0.05]',
                                        )}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <p className={cn(
                                                'line-clamp-2 text-sm font-medium leading-snug',
                                                selectedId === s.id ? 'text-accent' : 'text-ink/82',
                                            )}>
                                                {s.name}
                                            </p>
                                            <ChevronRight className={cn(
                                                'mt-0.5 h-3.5 w-3.5 shrink-0 transition-colors',
                                                selectedId === s.id
                                                    ? 'text-accent'
                                                    : 'text-ink/20 group-hover:text-ink/40',
                                            )} />
                                        </div>
                                        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink/45">
                                            <span>{s.questions_count} {s.questions_count !== 1 ? 'questões' : 'questão'}</span>
                                            <span>·</span>
                                            <span>{s.completed_responses_count} resp.</span>
                                            <span>·</span>
                                            {s.is_active ? (
                                                <Badge className="h-4 px-1.5 text-[10px]">Ativa</Badge>
                                            ) : (
                                                <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">Inativa</Badge>
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </aside>

                {/* ══ Right panel ══ */}
                <div className="scrollbar-thin min-w-0 flex-1 overflow-y-auto">
                    {!selected ? (
                        <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-accent/20 bg-accent/10">
                                <BarChart3 className="h-8 w-8 text-accent/60" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-ink/60">Selecione uma pesquisa</p>
                                <p className="text-xs text-ink/35">ou crie uma nova para começar</p>
                            </div>
                            <Button variant="outline" size="sm" className="gap-1.5" onClick={openCreate}>
                                <Plus className="h-4 w-4" />
                                Criar pesquisa
                            </Button>
                        </div>
                    ) : (
                        <div className="flex min-h-full flex-col">
                            {/* ── Survey header ── */}
                            <div className="border-b border-accent/10 px-6 py-4">
                                <div className="flex items-start gap-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-base font-semibold text-ink/90">{selected.name}</h3>
                                            {selected.is_active ? (
                                                <Badge className="h-5 px-2 text-[10px]">Ativa</Badge>
                                            ) : (
                                                <Badge variant="secondary" className="h-5 px-2 text-[10px]">Inativa</Badge>
                                            )}
                                        </div>
                                        {selected.description && (
                                            <p className="mt-0.5 text-sm text-ink/50">{selected.description}</p>
                                        )}
                                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink/40">
                                            <span className="flex items-center gap-1">
                                                <MessageSquare className="h-3.5 w-3.5" />
                                                {selected.questions_count} questão{selected.questions_count !== 1 ? 'ões' : ''}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Users className="h-3.5 w-3.5" />
                                                {selected.responses_count} enviadas
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <CheckCircle2 className="h-3.5 w-3.5" />
                                                {selected.completed_responses_count} concluídas
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex shrink-0 items-center gap-2">
                                        <div className="flex items-center gap-2 rounded-lg border border-accent/10 bg-ink/[0.02] px-2.5 py-1.5">
                                            <Switch
                                                id={`active-${selected.id}`}
                                                checked={selected.is_active}
                                                onCheckedChange={() => toggleActive(selected)}
                                                className="h-4 w-7"
                                            />
                                            <Label htmlFor={`active-${selected.id}`} className="cursor-pointer text-xs text-ink/55">
                                                {selected.is_active ? 'Ativa' : 'Inativa'}
                                            </Label>
                                        </div>
                                        <Button size="icon" variant="ghost" className="h-8 w-8" title="Editar pesquisa" onClick={() => openEdit(selected)}>
                                            <Pencil className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                            size="icon" variant="ghost"
                                            className="h-8 w-8 text-ink/40 hover:text-red-400"
                                            title="Excluir pesquisa"
                                            onClick={() => deleteSurvey(selected)}
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {/* ── Tabs ── */}
                            <Tabs value={activeTab} onValueChange={(t) => { setActiveTab(t); setEditingQs(false); }} className="flex min-h-0 flex-1 flex-col">
                                <div className="border-b border-accent/10 px-6 py-3">
                                    <TabsList>
                                        <TabsTrigger value="questions" className="gap-1.5 text-xs">
                                            <MessageSquare className="h-3.5 w-3.5" />
                                            Questões
                                        </TabsTrigger>
                                        <TabsTrigger value="responses" className="gap-1.5 text-xs">
                                            <BarChart3 className="h-3.5 w-3.5" />
                                            Respostas
                                        </TabsTrigger>
                                    </TabsList>
                                </div>

                                {/* ── Questions tab ── */}
                                <TabsContent value="questions" className="mt-0 flex-1 p-6">
                                    {!editingQs ? (
                                        <div className="space-y-3">
                                            {selected.questions.length === 0 ? (
                                                <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-accent/20 py-10 text-center">
                                                    <MessageSquare className="h-7 w-7 text-ink/25" />
                                                    <p className="text-sm text-ink/40">Nenhuma questão cadastrada</p>
                                                    <Button size="sm" variant="outline" className="gap-1.5" onClick={startEditQs}>
                                                        <Plus className="h-3.5 w-3.5" />
                                                        Adicionar questão
                                                    </Button>
                                                </div>
                                            ) : (
                                                <>
                                                    {selected.questions.map((q, i) => (
                                                        <div key={q.id ?? i} className="rounded-xl border border-accent/10 bg-ink/[0.02] p-4">
                                                            <div className="flex items-start gap-2">
                                                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/12 text-xs font-semibold text-accent">
                                                                    {i + 1}
                                                                </span>
                                                                <p className="text-sm font-medium text-ink/80">{q.text}</p>
                                                            </div>
                                                            <div className="ml-8 mt-2 flex flex-wrap gap-1.5">
                                                                {(q.options ?? []).map((opt) => (
                                                                    <span
                                                                        key={opt.id}
                                                                        className="rounded-full border border-accent/20 bg-accent/8 px-2.5 py-1 text-xs text-accent/80"
                                                                    >
                                                                        {opt.label}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}

                                                    {/* Thank you message preview */}
                                                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                                                        <div className="flex items-center gap-2">
                                                            <Smile className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                                            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                                                                Mensagem de agradecimento
                                                            </p>
                                                        </div>
                                                        <p className="ml-6 mt-1 text-sm text-ink/65">{selected.thank_you_message}</p>
                                                    </div>

                                                    <div className="flex justify-end pt-1">
                                                        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={startEditQs}>
                                                            <Pencil className="h-3.5 w-3.5" />
                                                            Editar questões
                                                        </Button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    ) : (
                                        /* ── Inline edit mode ── */
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <p className="text-sm font-medium text-ink/70">Editando questões</p>
                                                <span className="text-xs text-ink/35">{localQs.length} / 20</span>
                                            </div>

                                            {localQs.length === 0 && (
                                                <p className="py-4 text-center text-sm text-ink/40">
                                                    Adicione pelo menos uma questão.
                                                </p>
                                            )}

                                            {localQs.map((q, i) => (
                                                <QuestionEditor
                                                    key={i}
                                                    question={q}
                                                    index={i}
                                                    onChange={(updated) =>
                                                        setLocalQs((prev) =>
                                                            prev.map((old, idx) => (idx === i ? updated : old)),
                                                        )
                                                    }
                                                    onRemove={() =>
                                                        setLocalQs((prev) => prev.filter((_, idx) => idx !== i))
                                                    }
                                                />
                                            ))}

                                            {localQs.length < 20 && (
                                                <button
                                                    type="button"
                                                    onClick={() => setLocalQs((prev) => [...prev, newQuestion(prev.length)])}
                                                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-accent/25 py-3 text-sm text-accent/70 transition-colors hover:border-accent/50 hover:bg-accent/5 hover:text-accent"
                                                >
                                                    <Plus className="h-4 w-4" />
                                                    Adicionar questão
                                                </button>
                                            )}

                                            <div className="flex justify-end gap-2 border-t border-accent/10 pt-4">
                                                <Button variant="outline" size="sm" onClick={() => setEditingQs(false)}>
                                                    Cancelar
                                                </Button>
                                                <Button size="sm" onClick={saveQs} disabled={!isLocalQsValid}>
                                                    Salvar questões
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </TabsContent>

                                {/* ── Responses tab ── */}
                                <TabsContent value="responses" className="mt-0 flex-1 p-6">
                                    {respLoading && (
                                        <div className="flex flex-col items-center gap-3 py-16">
                                            <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
                                            <p className="text-sm text-ink/40">Carregando…</p>
                                        </div>
                                    )}

                                    {!respLoading && respData && (
                                        <div className="space-y-6">
                                            {/* Totals */}
                                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                                {[
                                                    { label: 'Enviadas',   key: 'all',         value: selected.responses_count, color: 'text-ink/80' },
                                                    { label: 'Concluídas', key: 'completed',   value: respData.totals.completed   ?? 0, color: 'text-emerald-600 dark:text-emerald-400' },
                                                    { label: 'Em andamento', key: 'in_progress', value: respData.totals.in_progress ?? 0, color: 'text-amber-600 dark:text-amber-400' },
                                                    { label: 'Abandonadas',  key: 'abandoned',   value: respData.totals.abandoned   ?? 0, color: 'text-red-500 dark:text-red-400' },
                                                ].map(({ label, key, value, color }) => (
                                                    <div key={key} className="rounded-xl border border-accent/10 bg-ink/[0.02] p-4 text-center">
                                                        <p className={cn('text-2xl font-bold tabular-nums', color)}>{value}</p>
                                                        <p className="mt-1 text-xs text-ink/45">{label}</p>
                                                    </div>
                                                ))}
                                            </div>

                                            {(respData.totals.completed ?? 0) === 0 ? (
                                                <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-accent/20 py-12 text-center">
                                                    <TrendingUp className="h-8 w-8 text-ink/20" />
                                                    <p className="text-sm text-ink/45">Nenhuma resposta concluída ainda</p>
                                                    <p className="text-xs text-ink/30">
                                                        As estatísticas aparecerão assim que clientes responderem a pesquisa.
                                                    </p>
                                                </div>
                                            ) : (
                                                <>
                                                    {/* Per-question stats */}
                                                    {respData.stats.map((stat) => {
                                                        const maxCount = Math.max(...stat.distribution.map((d) => d.count), 1);
                                                        return (
                                                            <div key={stat.question_id} className="rounded-xl border border-accent/10 bg-ink/[0.02] p-4">
                                                                <p className="text-sm font-medium text-ink/80">{stat.question_text}</p>
                                                                <p className="mb-3 mt-0.5 text-xs text-ink/40">
                                                                    {stat.total} resposta{stat.total !== 1 ? 's' : ''}
                                                                </p>

                                                                {stat.distribution.length === 0 ? (
                                                                    <p className="text-xs text-ink/35">Sem dados ainda.</p>
                                                                ) : (
                                                                    <div className="space-y-2">
                                                                        {stat.distribution
                                                                            .sort((a, b) => b.count - a.count)
                                                                            .map((d) => {
                                                                                const pct = stat.total > 0
                                                                                    ? Math.round((d.count / stat.total) * 100)
                                                                                    : 0;
                                                                                const barW = Math.round((d.count / maxCount) * 100);

                                                                                return (
                                                                                    <div key={d.option_id} className="flex items-center gap-2 text-sm">
                                                                                        <span className="w-32 shrink-0 truncate text-xs text-ink/70">
                                                                                            {d.option_label}
                                                                                        </span>
                                                                                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink/[0.07]">
                                                                                            <div
                                                                                                className="h-full rounded-full bg-accent/55 transition-all duration-500"
                                                                                                style={{ width: `${barW}%` }}
                                                                                            />
                                                                                        </div>
                                                                                        <span className="w-8 shrink-0 text-right text-xs font-semibold tabular-nums text-ink/65">
                                                                                            {d.count}
                                                                                        </span>
                                                                                        <span className="w-9 shrink-0 text-right text-xs text-ink/35 tabular-nums">
                                                                                            {pct}%
                                                                                        </span>
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}

                                                    {/* Recent responses */}
                                                    {respData.recent.length > 0 && (
                                                        <div className="space-y-2">
                                                            <div className="flex items-center justify-between">
                                                                <p className="text-xs font-semibold uppercase tracking-widest text-ink/35">
                                                                    Respostas concluídas
                                                                </p>
                                                                <span className="text-xs text-ink/35">
                                                                    {respData.recent.length} {respData.recent.length === 1 ? 'registro' : 'registros'}
                                                                </span>
                                                            </div>
                                                            <div className="overflow-hidden rounded-xl border border-accent/10">
                                                                {respData.recent.map((r, i) => (
                                                                    <button
                                                                        key={r.id}
                                                                        type="button"
                                                                        onClick={() => openDetail(r.id)}
                                                                        className={cn(
                                                                            'flex w-full items-center justify-between px-4 py-3 text-sm transition-colors hover:bg-accent/5',
                                                                            i !== 0 && 'border-t border-accent/[0.07]',
                                                                        )}
                                                                    >
                                                                        <div className="flex min-w-0 flex-col text-left">
                                                                            <span className="font-medium text-ink/75">
                                                                                {r.contact_wa_id && r.contact_name === r.contact_wa_id
                                                                                    ? formatClientPhone(r.contact_wa_id)
                                                                                    : r.contact_name}
                                                                            </span>
                                                                            {r.contact_wa_id && r.contact_name !== r.contact_wa_id && (
                                                                                <span className="text-xs text-ink/40">
                                                                                    {formatClientPhone(r.contact_wa_id)}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <div className="flex shrink-0 items-center gap-2">
                                                                            <span className="text-xs text-ink/40">
                                                                                {new Date(r.completed_at).toLocaleDateString('pt-BR', {
                                                                                    day: '2-digit', month: 'short', year: 'numeric',
                                                                                    hour: '2-digit', minute: '2-digit',
                                                                                })}
                                                                            </span>
                                                                            <ChevronRight className="h-3.5 w-3.5 text-ink/25" />
                                                                        </div>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    )}

                                    {!respLoading && !respData && (
                                        <p className="py-16 text-center text-sm text-ink/40">
                                            Não foi possível carregar as respostas.
                                        </p>
                                    )}
                                </TabsContent>
                            </Tabs>
                        </div>
                    )}
                </div>
            </div>

            {/* ══ Create / Edit Dialog ══ */}
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
                <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
                    <form onSubmit={submitDialog}>
                        <DialogHeader>
                            <DialogTitle>{editing ? 'Editar pesquisa' : 'Nova pesquisa'}</DialogTitle>
                            <DialogDescription>
                                {editing
                                    ? 'Atualize as informações e questões da pesquisa.'
                                    : 'Configure uma nova pesquisa de satisfação via WhatsApp.'}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-5 py-4">
                            {/* Survey meta */}
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="name">Nome da pesquisa</Label>
                                    <Input
                                        id="name"
                                        value={formData.name}
                                        onChange={(e) => setFormData((d) => ({ ...d, name: e.target.value }))}
                                        placeholder="Ex: Pesquisa de Satisfação"
                                        maxLength={255}
                                    />
                                    {formErrors.name && <p className="text-sm text-destructive">{formErrors.name}</p>}
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="description">Descrição <span className="text-ink/35">(opcional)</span></Label>
                                    <Textarea
                                        id="description"
                                        value={formData.description}
                                        onChange={(e) => setFormData((d) => ({ ...d, description: e.target.value }))}
                                        placeholder="Breve descrição interna"
                                        rows={2}
                                        maxLength={500}
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="thank_you_message">Mensagem de agradecimento</Label>
                                    <Input
                                        id="thank_you_message"
                                        value={formData.thank_you_message}
                                        onChange={(e) => setFormData((d) => ({ ...d, thank_you_message: e.target.value }))}
                                        placeholder="Obrigado pela sua avaliação! 🙏"
                                        maxLength={255}
                                    />
                                    <p className="text-xs text-ink/40">Enviada ao cliente após a última resposta.</p>
                                </div>

                                <div className="flex items-center gap-3 rounded-lg border border-accent/10 bg-ink/[0.025] px-3 py-2.5">
                                    <Switch
                                        id="dialog-active"
                                        checked={formData.is_active}
                                        onCheckedChange={(v) => setFormData((d) => ({ ...d, is_active: v }))}
                                    />
                                    <div>
                                        <Label htmlFor="dialog-active" className="cursor-pointer text-sm">Pesquisa ativa</Label>
                                        <p className="text-xs text-ink/40">Somente pesquisas ativas podem ser enviadas.</p>
                                    </div>
                                </div>
                            </div>

                            {/* Questions builder */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label>Questões</Label>
                                    <span className="text-xs text-ink/35">{dialogQs.length} / 20</span>
                                </div>

                                {dialogQs.length === 0 && (
                                    <p className="py-3 text-center text-xs text-ink/40">Adicione pelo menos uma questão.</p>
                                )}

                                {dialogQs.map((q, i) => (
                                    <QuestionEditor
                                        key={i}
                                        question={q}
                                        index={i}
                                        onChange={(updated) =>
                                            setDialogQs((prev) =>
                                                prev.map((old, idx) => (idx === i ? updated : old)),
                                            )
                                        }
                                        onRemove={() =>
                                            setDialogQs((prev) => prev.filter((_, idx) => idx !== i))
                                        }
                                    />
                                ))}

                                {dialogQs.length < 20 && (
                                    <button
                                        type="button"
                                        onClick={() => setDialogQs((prev) => [...prev, newQuestion(prev.length)])}
                                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-accent/25 py-3 text-sm text-accent/70 transition-colors hover:border-accent/50 hover:bg-accent/5 hover:text-accent"
                                    >
                                        <Plus className="h-4 w-4" />
                                        Adicionar questão
                                    </button>
                                )}
                            </div>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={formProcessing || !isDialogValid}>
                                {editing ? 'Salvar alterações' : 'Criar pesquisa'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ══ Response Detail Dialog ══ */}
            <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Respostas do contato</DialogTitle>
                        {detailData && (
                            <DialogDescription asChild>
                                <div className="flex flex-col gap-0.5 pt-0.5">
                                    <span className="font-medium text-ink/70">
                                        {detailData.contact_wa_id && detailData.contact_name === detailData.contact_wa_id
                                            ? formatClientPhone(detailData.contact_wa_id)
                                            : detailData.contact_name}
                                    </span>
                                    {detailData.contact_wa_id && detailData.contact_name !== detailData.contact_wa_id && (
                                        <span className="text-xs text-ink/40">
                                            {formatClientPhone(detailData.contact_wa_id)}
                                        </span>
                                    )}
                                    <span className="text-xs text-ink/35">
                                        {new Date(detailData.completed_at).toLocaleDateString('pt-BR', {
                                            day: '2-digit', month: 'long', year: 'numeric',
                                            hour: '2-digit', minute: '2-digit',
                                        })}
                                    </span>
                                </div>
                            </DialogDescription>
                        )}
                    </DialogHeader>

                    {detailLoading && (
                        <div className="flex items-center justify-center py-10">
                            <Loader2 className="h-5 w-5 animate-spin text-ink/35" />
                        </div>
                    )}

                    {detailData && (
                        <div className="space-y-3 pt-1">
                            {detailData.answers.map((a, i) => (
                                <div key={i} className="rounded-lg border border-accent/10 bg-ink/[0.02] p-3">
                                    <p className="text-xs font-medium text-ink/45">{a.question_text}</p>
                                    <p className="mt-1.5 font-medium text-ink/85">{a.option_label}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </AuthenticatedLayout>
    );
}
