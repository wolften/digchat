import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Card } from '@/Components/ui/card';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router } from '@inertiajs/react';
import { BarChart3, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

interface Survey {
    id: number;
    name: string;
    description: string | null;
    is_active: boolean;
    questions_count: number;
    completed_responses_count: number;
    created_at: string;
}

interface Props {
    surveys: Survey[];
}

export default function PesquisasIndex({ surveys }: Props) {
    const [deletingId, setDeletingId] = useState<number | null>(null);

    const handleDelete = (survey: Survey) => {
        if (!confirm(`Excluir "${survey.name}"? Todas as respostas serão removidas.`)) return;
        setDeletingId(survey.id);
        router.delete(route('pesquisas.destroy', survey.id), {
            onFinish: () => setDeletingId(null),
        });
    };

    return (
        <AuthenticatedLayout>
            <Head title="Pesquisas de Satisfação" />

            <div className="space-y-4 p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="font-manrope text-xl font-bold">Pesquisas de Satisfação</h1>
                        <p className="text-sm text-ink/60">
                            Colete feedback dos clientes via WhatsApp após o atendimento.
                        </p>
                    </div>
                    <Link href={route('pesquisas.create')}>
                        <Button>
                            <Plus className="mr-1.5 h-4 w-4" />
                            Nova pesquisa
                        </Button>
                    </Link>
                </div>

                {surveys.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-ink/20 py-16 text-center">
                        <BarChart3 className="mb-3 h-10 w-10 text-ink/20" />
                        <p className="font-medium text-ink/50">Nenhuma pesquisa criada ainda</p>
                        <p className="mt-1 text-sm text-ink/35">
                            Crie uma pesquisa para coletar feedback dos seus clientes.
                        </p>
                        <Link href={route('pesquisas.create')} className="mt-4">
                            <Button variant="outline" size="sm">
                                <Plus className="mr-1.5 h-3.5 w-3.5" />
                                Criar primeira pesquisa
                            </Button>
                        </Link>
                    </div>
                ) : (
                    <Card className="overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-ink/[0.08] bg-ink/[0.03] text-xs font-semibold uppercase tracking-wide text-ink/50">
                                    <th className="px-4 py-3 text-left">Pesquisa</th>
                                    <th className="px-4 py-3 text-center">Questões</th>
                                    <th className="px-4 py-3 text-center">Respostas</th>
                                    <th className="px-4 py-3 text-center">Status</th>
                                    <th className="px-4 py-3" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-ink/[0.06]">
                                {surveys.map((survey) => (
                                    <tr key={survey.id} className="hover:bg-accent/[0.04]">
                                        <td className="px-4 py-3">
                                            <Link href={route('pesquisas.show', survey.id)} className="group">
                                                <p className="font-medium group-hover:text-accent transition-colors">
                                                    {survey.name}
                                                </p>
                                                {survey.description && (
                                                    <p className="mt-0.5 max-w-xs truncate text-xs text-ink/50">
                                                        {survey.description}
                                                    </p>
                                                )}
                                            </Link>
                                        </td>
                                        <td className="px-4 py-3 text-center text-ink/60">
                                            {survey.questions_count}
                                        </td>
                                        <td className="px-4 py-3 text-center text-ink/60">
                                            {survey.completed_responses_count}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {survey.is_active ? (
                                                <Badge className="text-[10px]">Ativa</Badge>
                                            ) : (
                                                <Badge variant="secondary" className="text-[10px]">
                                                    Inativa
                                                </Badge>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-end gap-1">
                                                <Link href={route('pesquisas.show', survey.id)}>
                                                    <Button variant="ghost" size="icon">
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                </Link>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    disabled={deletingId === survey.id}
                                                    onClick={() => handleDelete(survey)}
                                                    className="text-red-500 hover:text-red-600"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </Card>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
