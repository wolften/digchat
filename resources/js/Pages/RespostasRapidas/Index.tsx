import { Button } from '@/Components/ui/button';
import { Card } from '@/Components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/Components/ui/dialog';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { Switch } from '@/Components/ui/switch';
import { Textarea } from '@/Components/ui/textarea';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router, useForm } from '@inertiajs/react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

interface QuickReply {
    id: number;
    trigger: string;
    title: string;
    content: string;
    is_active: boolean;
}

interface Props {
    replies: QuickReply[];
}

export default function RespostasRapidas({ replies }: Props) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<QuickReply | null>(null);

    const form = useForm({
        trigger: '',
        title: '',
        content: '',
        is_active: true,
    });

    const openCreate = () => {
        form.reset();
        form.setData({ trigger: '', title: '', content: '', is_active: true });
        setEditing(null);
        setDialogOpen(true);
    };

    const openEdit = (r: QuickReply) => {
        form.setData({ trigger: r.trigger, title: r.title, content: r.content, is_active: r.is_active });
        setEditing(r);
        setDialogOpen(true);
    };

    const handleSubmit = () => {
        if (editing) {
            form.put(route('respostas-rapidas.update', editing.id), {
                onSuccess: () => setDialogOpen(false),
            });
        } else {
            form.post(route('respostas-rapidas.store'), {
                onSuccess: () => setDialogOpen(false),
            });
        }
    };

    const handleDelete = (r: QuickReply) => {
        if (!confirm(`Excluir /${r.trigger}?`)) return;
        router.delete(route('respostas-rapidas.destroy', r.id));
    };

    return (
        <AuthenticatedLayout>
            <Head title="Respostas Rápidas" />

            <div className="space-y-4 p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="font-manrope text-xl font-bold">Respostas Rápidas</h1>
                        <p className="text-sm text-ink/60">
                            Atalhos de barra (/comando) que expandem para mensagens pré-escritas.
                        </p>
                    </div>
                    <Button onClick={openCreate}>
                        <Plus className="mr-1.5 h-4 w-4" />
                        Nova resposta
                    </Button>
                </div>

                <Card className="overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-ink/[0.08] bg-ink/[0.03] text-xs font-semibold uppercase tracking-wide text-ink/50">
                                <th className="px-4 py-3 text-left">Gatilho</th>
                                <th className="px-4 py-3 text-left">Título</th>
                                <th className="hidden px-4 py-3 text-left md:table-cell">Conteúdo</th>
                                <th className="px-4 py-3 text-center">Ativa</th>
                                <th className="px-4 py-3" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-ink/[0.06]">
                            {replies.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-ink/40">
                                        Nenhuma resposta rápida cadastrada.
                                    </td>
                                </tr>
                            )}
                            {replies.map((r) => (
                                <tr key={r.id} className="hover:bg-accent/[0.04]">
                                    <td className="px-4 py-3 font-mono text-sm font-semibold text-accent">
                                        /{r.trigger}
                                    </td>
                                    <td className="px-4 py-3 font-medium">{r.title}</td>
                                    <td className="hidden max-w-xs px-4 py-3 text-ink/60 md:table-cell">
                                        <span className="block truncate">{r.content}</span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span
                                            className={`inline-block h-2 w-2 rounded-full ${r.is_active ? 'bg-green-500' : 'bg-ink/20'}`}
                                        />
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-end gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => openEdit(r)}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleDelete(r)}
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
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>
                            {editing ? 'Editar resposta rápida' : 'Nova resposta rápida'}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="trigger">
                                Gatilho{' '}
                                <span className="text-xs font-normal text-ink/50">
                                    (apenas letras minúsculas, números e _)
                                </span>
                            </Label>
                            <div className="flex items-center gap-1.5">
                                <span className="text-sm font-semibold text-ink/50">/</span>
                                <Input
                                    id="trigger"
                                    value={form.data.trigger}
                                    onChange={(e) =>
                                        form.setData('trigger', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))
                                    }
                                    placeholder="ola"
                                    className="font-mono"
                                />
                            </div>
                            {form.errors.trigger && (
                                <p className="text-xs text-red-500">{form.errors.trigger}</p>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="title">Título</Label>
                            <Input
                                id="title"
                                value={form.data.title}
                                onChange={(e) => form.setData('title', e.target.value)}
                                placeholder="Saudação inicial"
                            />
                            {form.errors.title && (
                                <p className="text-xs text-red-500">{form.errors.title}</p>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="content">Mensagem</Label>
                            <Textarea
                                id="content"
                                value={form.data.content}
                                onChange={(e) => form.setData('content', e.target.value)}
                                placeholder="Olá! Seja bem-vindo à FIBRON. Como posso ajudar?"
                                rows={4}
                            />
                            {form.errors.content && (
                                <p className="text-xs text-red-500">{form.errors.content}</p>
                            )}
                        </div>

                        <div className="flex items-center gap-3">
                            <Switch
                                id="is_active"
                                checked={form.data.is_active}
                                onCheckedChange={(v) => form.setData('is_active', v)}
                            />
                            <Label htmlFor="is_active">Ativa</Label>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={handleSubmit} disabled={form.processing}>
                            {editing ? 'Salvar' : 'Criar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AuthenticatedLayout>
    );
}
