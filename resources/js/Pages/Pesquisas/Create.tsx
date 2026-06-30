import { newQuestion, Question, QuestionEditor } from '@/Components/QuestionEditor';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { Switch } from '@/Components/ui/switch';
import { Textarea } from '@/Components/ui/textarea';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router } from '@inertiajs/react';
import { ArrowLeft, Plus } from 'lucide-react';
import { FormEvent, useState } from 'react';

export default function PesquisasCreate() {
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        is_active: false,
        thank_you_message: 'Obrigado pela sua avaliação! 🙏',
    });
    const [questions, setQuestions] = useState<Question[]>([newQuestion(0)]);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [processing, setProcessing] = useState(false);

    const isValid =
        formData.name.trim() !== '' &&
        questions.length > 0 &&
        questions.every(
            (q) =>
                q.text.trim() !== '' &&
                q.options.length > 0 &&
                q.options.every((o) => o.label.trim() !== ''),
        );

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        setProcessing(true);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const payload: any = { ...formData, questions };
        router.post(
            route('pesquisas.store'),
            payload,
            {
                onError: (e) => {
                    setErrors(e);
                    setProcessing(false);
                },
                onFinish: () => setProcessing(false),
            },
        );
    };

    return (
        <AuthenticatedLayout>
            <Head title="Nova Pesquisa" />

            <div className="flex-1 overflow-y-auto scrollbar-thin space-y-6 p-6">
                <div className="flex items-center gap-3">
                    <Link href={route('pesquisas.index')}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="font-manrope text-xl font-bold">Nova Pesquisa</h1>
                        <p className="text-sm text-ink/60">
                            Configure uma pesquisa de satisfação via WhatsApp.
                        </p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-4 rounded-xl border border-accent/10 p-5">
                        <h2 className="text-sm font-semibold text-ink/70">Informações gerais</h2>

                        <div className="space-y-1.5">
                            <Label htmlFor="name">Nome da pesquisa</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData((d) => ({ ...d, name: e.target.value }))}
                                placeholder="Ex: Pesquisa de Satisfação"
                                maxLength={255}
                            />
                            {errors.name && (
                                <p className="text-sm text-destructive">{errors.name}</p>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="description">
                                Descrição{' '}
                                <span className="text-ink/35">(opcional)</span>
                            </Label>
                            <Textarea
                                id="description"
                                value={formData.description}
                                onChange={(e) =>
                                    setFormData((d) => ({ ...d, description: e.target.value }))
                                }
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
                                onChange={(e) =>
                                    setFormData((d) => ({
                                        ...d,
                                        thank_you_message: e.target.value,
                                    }))
                                }
                                placeholder="Obrigado pela sua avaliação! 🙏"
                                maxLength={255}
                            />
                            <p className="text-xs text-ink/40">
                                Enviada ao cliente após a última resposta.
                            </p>
                        </div>

                        <div className="flex items-center gap-3 rounded-lg border border-accent/10 bg-ink/[0.025] px-3 py-2.5">
                            <Switch
                                id="is_active"
                                checked={formData.is_active}
                                onCheckedChange={(v) =>
                                    setFormData((d) => ({ ...d, is_active: v }))
                                }
                            />
                            <div>
                                <Label htmlFor="is_active" className="cursor-pointer text-sm">
                                    Pesquisa ativa
                                </Label>
                                <p className="text-xs text-ink/40">
                                    Somente pesquisas ativas podem ser enviadas.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-semibold text-ink/70">Questões</h2>
                            <span className="text-xs text-ink/35">{questions.length} / 20</span>
                        </div>

                        {questions.length === 0 && (
                            <p className="py-3 text-center text-xs text-ink/40">
                                Adicione pelo menos uma questão.
                            </p>
                        )}

                        {questions.map((q, i) => (
                            <QuestionEditor
                                key={i}
                                question={q}
                                index={i}
                                onChange={(updated) =>
                                    setQuestions((prev) =>
                                        prev.map((old, idx) => (idx === i ? updated : old)),
                                    )
                                }
                                onRemove={() =>
                                    setQuestions((prev) => prev.filter((_, idx) => idx !== i))
                                }
                            />
                        ))}

                        {questions.length < 20 && (
                            <button
                                type="button"
                                onClick={() =>
                                    setQuestions((prev) => [...prev, newQuestion(prev.length)])
                                }
                                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-accent/25 py-3 text-sm text-accent/70 transition-colors hover:border-accent/50 hover:bg-accent/5 hover:text-accent"
                            >
                                <Plus className="h-4 w-4" />
                                Adicionar questão
                            </button>
                        )}
                    </div>

                    <div className="flex justify-end gap-2 border-t border-accent/10 pt-2">
                        <Link href={route('pesquisas.index')}>
                            <Button type="button" variant="outline">
                                Cancelar
                            </Button>
                        </Link>
                        <Button type="submit" disabled={processing || !isValid}>
                            {processing ? 'Criando…' : 'Criar pesquisa'}
                        </Button>
                    </div>
                </form>
            </div>
        </AuthenticatedLayout>
    );
}
