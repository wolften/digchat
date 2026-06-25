import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Card } from '@/Components/ui/card';
import { Switch } from '@/Components/ui/switch';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router } from '@inertiajs/react';
import { GitBranch, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { useState } from 'react';

interface Flow {
    id: number;
    name: string;
    description: string | null;
    is_active: boolean;
    is_default: boolean;
    created_at: string;
}

interface Props {
    flows: Flow[];
}

export default function FlowsIndex({ flows }: Props) {
    const [deletingId, setDeletingId] = useState<number | null>(null);

    const handleToggleActive = (flow: Flow) => {
        router.patch(route('flows.activate', flow.id), { is_active: !flow.is_active });
    };

    const handleSetDefault = (flow: Flow) => {
        if (flow.is_default) return;
        router.patch(route('flows.activate', flow.id), { is_default: true, is_active: true });
    };

    const handleDelete = (flow: Flow) => {
        if (!confirm(`Excluir o fluxo "${flow.name}"? Conversas em andamento nesse fluxo serão enviadas para a fila.`)) return;
        setDeletingId(flow.id);
        router.delete(route('flows.destroy', flow.id), {
            onFinish: () => setDeletingId(null),
        });
    };

    return (
        <AuthenticatedLayout>
            <Head title="Fluxos de Atendimento" />

            <div className="space-y-4 p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="font-manrope text-xl font-bold">Fluxos de Atendimento</h1>
                        <p className="text-sm text-ink/60">
                            Configure o fluxo automático do bot antes de encaminhar para um atendente.
                        </p>
                    </div>
                    <Link href={route('flows.create')}>
                        <Button>
                            <Plus className="mr-1.5 h-4 w-4" />
                            Novo fluxo
                        </Button>
                    </Link>
                </div>

                {flows.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-ink/20 py-16 text-center">
                        <GitBranch className="mb-3 h-10 w-10 text-ink/20" />
                        <p className="font-medium text-ink/50">Nenhum fluxo criado ainda</p>
                        <p className="mt-1 text-sm text-ink/35">
                            Crie um fluxo para automatizar o primeiro contato com seus clientes.
                        </p>
                        <Link href={route('flows.create')} className="mt-4">
                            <Button variant="outline" size="sm">
                                <Plus className="mr-1.5 h-3.5 w-3.5" />
                                Criar primeiro fluxo
                            </Button>
                        </Link>
                    </div>
                ) : (
                    <Card className="overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-ink/[0.08] bg-ink/[0.03] text-xs font-semibold uppercase tracking-wide text-ink/50">
                                    <th className="px-4 py-3 text-left">Fluxo</th>
                                    <th className="px-4 py-3 text-center">Ativo</th>
                                    <th className="px-4 py-3 text-center">Padrão</th>
                                    <th className="px-4 py-3" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-ink/[0.06]">
                                {flows.map((flow) => (
                                    <tr key={flow.id} className="hover:bg-accent/[0.04]">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <p className="font-medium">{flow.name}</p>
                                                {flow.is_default && (
                                                    <Badge variant="outline" className="border-accent/40 text-accent text-[10px]">
                                                        padrão
                                                    </Badge>
                                                )}
                                            </div>
                                            {flow.description && (
                                                <p className="mt-0.5 truncate text-xs text-ink/50 max-w-xs">
                                                    {flow.description}
                                                </p>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex justify-center">
                                                <Switch
                                                    checked={flow.is_active}
                                                    onCheckedChange={() => handleToggleActive(flow)}
                                                />
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <button
                                                type="button"
                                                title={flow.is_default ? 'Fluxo padrão' : 'Definir como padrão'}
                                                onClick={() => handleSetDefault(flow)}
                                                className={`flex mx-auto items-center justify-center rounded-lg p-1.5 transition ${
                                                    flow.is_default
                                                        ? 'text-amber-500'
                                                        : 'text-ink/20 hover:text-ink/50'
                                                }`}
                                            >
                                                <Star className={`h-4 w-4 ${flow.is_default ? 'fill-amber-500' : ''}`} />
                                            </button>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-end gap-1">
                                                <Link href={route('flows.edit', flow.id)}>
                                                    <Button variant="ghost" size="icon">
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                </Link>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    disabled={deletingId === flow.id}
                                                    onClick={() => handleDelete(flow)}
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
