import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Plus, Star, X } from 'lucide-react';

export interface Option {
    id: string;
    label: string;
}

export interface Question {
    id?: number;
    text: string;
    position: number;
    options: Option[];
    is_rating?: boolean;
    [key: string]: unknown;
}

const RATING_OPTIONS: Option[] = [
    { id: '1', label: '1' },
    { id: '2', label: '2' },
    { id: '3', label: '3' },
    { id: '4', label: '4' },
    { id: '5', label: '5' },
];

export function slugify(text: string): string {
    return (
        text
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^\w]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .substring(0, 50) || 'opcao'
    );
}

export function newOption(): Option {
    return { id: '', label: '' };
}

export function newQuestion(position: number): Question {
    return { text: '', position, options: [newOption(), newOption()] };
}

interface Props {
    question: Question;
    index: number;
    onChange: (q: Question) => void;
    onRemove: () => void;
}

export function QuestionEditor({ question, index, onChange, onRemove }: Props) {
    const updateOption = (i: number, partial: Partial<Option>) => {
        const opts = question.options.map((o, idx) => {
            if (idx !== i) return o;
            const updated = { ...o, ...partial };
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
                <button
                    type="button"
                    title={question.is_rating ? 'Pergunta de nota (CSAT) — clique para desativar' : 'Marcar como pergunta de nota (CSAT 1–5)'}
                    onClick={() => {
                        const next = !question.is_rating;
                        onChange({ ...question, is_rating: next, options: next ? RATING_OPTIONS : question.options });
                    }}
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded transition-colors ${
                        question.is_rating
                            ? 'text-amber-500 hover:text-amber-600'
                            : 'text-ink/25 hover:text-amber-400'
                    }`}
                >
                    <Star className={`h-3.5 w-3.5 ${question.is_rating ? 'fill-amber-500' : ''}`} />
                </button>
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
                <div className="flex items-center gap-2">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-ink/35">
                        Opções de resposta
                    </p>
                    {question.is_rating && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:bg-amber-900/20 dark:text-amber-400">
                            <Star className="h-2.5 w-2.5 fill-amber-500" /> CSAT 1–5
                        </span>
                    )}
                </div>
                {question.is_rating ? (
                    <div className="flex gap-1.5">
                        {RATING_OPTIONS.map((opt) => (
                            <div
                                key={opt.id}
                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-sm font-semibold text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400"
                            >
                                {opt.label}
                            </div>
                        ))}
                    </div>
                ) : (
                    <>
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
                                            id:
                                                opt.id === slugify(opt.label) || opt.id === ''
                                                    ? slugify(label)
                                                    : opt.id,
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
                    </>
                )}
            </div>
        </div>
    );
}
