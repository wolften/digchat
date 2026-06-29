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
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router, useForm } from '@inertiajs/react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

interface Tag {
    id: number;
    name: string;
    color: string;
    is_active: boolean;
}

interface Props {
    tags: Tag[];
}

const COLOR_OPTIONS = [
    { value: 'blue',   label: 'Azul',     swatch: 'bg-blue-400' },
    { value: 'green',  label: 'Verde',    swatch: 'bg-green-500' },
    { value: 'amber',  label: 'Amarelo',  swatch: 'bg-amber-400' },
    { value: 'red',    label: 'Vermelho', swatch: 'bg-red-500' },
    { value: 'purple', label: 'Roxo',     swatch: 'bg-purple-500' },
    { value: 'teal',   label: 'Teal',     swatch: 'bg-teal-400' },
    { value: 'coral',  label: 'Coral',    swatch: 'bg-orange-400' },
    { value: 'pink',   label: 'Rosa',     swatch: 'bg-pink-400' },
] as const;

const TAG_BADGE_CLASSES: Record<string, string> = {
    blue:   'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/40',
    green:  'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800/40',
    amber:  'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800/40',
    red:    'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800/40',
    purple: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800/40',
    teal:   'bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-800/40',
    coral:  'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800/40',
    pink:   'bg-pink-100 text-pink-800 border-pink-200 dark:bg-pink-900/30 dark:text-pink-300 dark:border-pink-800/40',
};

export default function EtiquetasIndex({ tags }: Props) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<Tag | null>(null);

    const form = useForm({
        name: '',
        color: 'blue',
        is_active: true,
    });

    const openCreate = () => {
        form.reset();
        form.setData({ name: '', color: 'blue', is_active: true });
        setEditing(null);
        setDialogOpen(true);
    };

    const openEdit = (t: Tag) => {
        form.setData({ name: t.name, color: t.color, is_active: t.is_active });
        setEditing(t);
        setDialogOpen(true);
    };

    const handleSubmit = () => {
        if (editing) {
            form.put(route('tags.update', editing.id), {
                onSuccess: () => setDialogOpen(false),
            });
        } else {
            form.post(route('tags.store'), {
                onSuccess: () => setDialogOpen(false),
            });
        }
    };

    const handleDelete = (t: Tag) => {
        if (!confirm(`Excluir etiqueta "${t.name}"?`)) return;
        router.delete(route('tags.destroy', t.id));
    };

    return (
        <AuthenticatedLayout>
            <Head title="Etiquetas" />

            <div className="space-y-4 p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="font-manrope text-xl font-bold">Etiquetas</h1>
                        <p className="text-sm text-ink/60">
                            Classifique conversas com etiquetas coloridas para filtrar e organizar atendimentos.
                        </p>
                    </div>
                    <Button onClick={openCreate}>
                        <Plus className="mr-1.5 h-4 w-4" />
                        Nova etiqueta
                    </Button>
                </div>

                <Card className="overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-ink/[0.08] bg-ink/[0.03] text-xs font-semibold uppercase tracking-wide text-ink/50">
                                <th className="px-4 py-3 text-left">Etiqueta</th>
                                <th className="px-4 py-3 text-left">Cor</th>
                                <th className="px-4 py-3 text-center">Ativa</th>
                                <th className="px-4 py-3" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-ink/[0.06]">
                            {tags.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-4 py-8 text-center text-sm text-ink/40">
                                        Nenhuma etiqueta cadastrada.
                                    </td>
                                </tr>
                            )}
                            {tags.map((t) => (
                                <tr key={t.id} className="hover:bg-accent/[0.04]">
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${TAG_BADGE_CLASSES[t.color] ?? TAG_BADGE_CLASSES.blue}`}>
                                            {t.name}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-ink/60">
                                        {COLOR_OPTIONS.find((c) => c.value === t.color)?.label ?? t.color}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={`inline-block h-2 w-2 rounded-full ${t.is_active ? 'bg-green-500' : 'bg-ink/20'}`} />
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-end gap-1">
                                            <Button variant="ghost" size="icon" onClick={() => openEdit(t)}>
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleDelete(t)}
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
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editing ? 'Editar etiqueta' : 'Nova etiqueta'}</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="name">Nome</Label>
                            <Input
                                id="name"
                                value={form.data.name}
                                onChange={(e) => form.setData('name', e.target.value)}
                                placeholder="Suporte técnico"
                                maxLength={50}
                            />
                            {form.errors.name && (
                                <p className="text-xs text-red-500">{form.errors.name}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label>Cor</Label>
                            <div className="flex flex-wrap gap-2">
                                {COLOR_OPTIONS.map((c) => (
                                    <button
                                        key={c.value}
                                        type="button"
                                        title={c.label}
                                        onClick={() => form.setData('color', c.value)}
                                        className={`h-8 w-8 rounded-full transition-all ${c.swatch} ${
                                            form.data.color === c.value
                                                ? 'ring-2 ring-offset-2 ring-ink/30 scale-110'
                                                : 'opacity-70 hover:opacity-100 hover:scale-105'
                                        }`}
                                    />
                                ))}
                            </div>
                            {form.data.name && (
                                <div className="pt-1">
                                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${TAG_BADGE_CLASSES[form.data.color] ?? TAG_BADGE_CLASSES.blue}`}>
                                        {form.data.name}
                                    </span>
                                </div>
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
