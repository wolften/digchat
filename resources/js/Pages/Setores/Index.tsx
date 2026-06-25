import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Card } from '@/Components/ui/card';
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
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router, useForm } from '@inertiajs/react';
import { Pencil, Plus, Trash2, Users } from 'lucide-react';
import { FormEvent, useState } from 'react';

interface Attendant {
    id: number;
    name: string;
}

interface Sector {
    id: number;
    name: string;
    description: string | null;
    is_active: boolean;
    users: Attendant[];
}

interface Props {
    sectors: Sector[];
    attendants: Attendant[];
}

export default function SetoresIndex({ sectors, attendants }: Props) {
    const [sectorDialog, setSectorDialog] = useState(false);
    const [usersDialog, setUsersDialog] = useState(false);
    const [editing, setEditing] = useState<Sector | null>(null);
    const [managingUsers, setManagingUsers] = useState<Sector | null>(null);
    const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);

    const form = useForm({
        name: '',
        description: '',
        is_active: true,
    });

    const openCreate = () => {
        setEditing(null);
        form.reset();
        form.clearErrors();
        setSectorDialog(true);
    };

    const openEdit = (sector: Sector) => {
        setEditing(sector);
        form.clearErrors();
        form.setData({
            name: sector.name,
            description: sector.description ?? '',
            is_active: sector.is_active,
        });
        setSectorDialog(true);
    };

    const submitSector = (e: FormEvent) => {
        e.preventDefault();
        const options = {
            preserveScroll: true,
            onSuccess: () => {
                setSectorDialog(false);
                form.reset();
            },
        };
        if (editing) {
            form.put(route('setores.update', editing.id), options);
        } else {
            form.post(route('setores.store'), options);
        }
    };

    const destroy = (sector: Sector) => {
        if (confirm(`Excluir o setor "${sector.name}"?`)) {
            router.delete(route('setores.destroy', sector.id), {
                preserveScroll: true,
            });
        }
    };

    const openManageUsers = (sector: Sector) => {
        setManagingUsers(sector);
        setSelectedUserIds(sector.users.map((u) => u.id));
        setUsersDialog(true);
    };

    const toggleUser = (userId: number) => {
        setSelectedUserIds((prev) =>
            prev.includes(userId)
                ? prev.filter((id) => id !== userId)
                : [...prev, userId],
        );
    };

    const submitUsers = () => {
        if (!managingUsers) return;
        router.post(
            route('setores.users.sync', managingUsers.id),
            { user_ids: selectedUserIds },
            {
                preserveScroll: true,
                onSuccess: () => setUsersDialog(false),
            },
        );
    };

    return (
        <AuthenticatedLayout>
            <Head title="Setores" />

            <div className="space-y-4 p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="font-manrope text-xl font-bold">Setores</h1>
                        <p className="text-sm text-ink/60">
                            Organize os atendentes em setores de atendimento.
                        </p>
                    </div>
                    <Button onClick={openCreate}>
                        <Plus className="mr-1.5 h-4 w-4" />
                        Novo setor
                    </Button>
                </div>

                <Card className="overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-ink/[0.08] bg-ink/[0.03] text-xs font-semibold uppercase tracking-wide text-ink/50">
                                <th className="px-4 py-3 text-left">Nome</th>
                                <th className="px-4 py-3 text-left">Descrição</th>
                                <th className="px-4 py-3 text-left">Atendentes</th>
                                <th className="px-4 py-3 text-left">Status</th>
                                <th className="px-4 py-3" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-ink/[0.08]">
                            {sectors.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="py-8 text-center text-ink/45">
                                        Nenhum setor cadastrado.
                                    </td>
                                </tr>
                            )}
                            {sectors.map((sector) => (
                                <tr key={sector.id} className="hover:bg-accent/[0.04]">
                                    <td className="px-4 py-3 font-medium">{sector.name}</td>
                                    <td className="px-4 py-3 text-ink/50">
                                        {sector.description ?? '—'}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-wrap gap-1">
                                            {sector.users.length === 0 ? (
                                                <span className="text-xs text-ink/45">Nenhum</span>
                                            ) : (
                                                sector.users.map((u) => (
                                                    <span
                                                        key={u.id}
                                                        className="rounded-full border border-accent/20 bg-accent/10 px-2 py-0.5 text-xs text-accent"
                                                    >
                                                        {u.name}
                                                    </span>
                                                ))
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        {sector.is_active ? (
                                            <Badge variant="outline">Ativo</Badge>
                                        ) : (
                                            <Badge variant="destructive">Inativo</Badge>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                title="Gerenciar atendentes"
                                                onClick={() => openManageUsers(sector)}
                                            >
                                                <Users />
                                            </Button>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                onClick={() => openEdit(sector)}
                                            >
                                                <Pencil />
                                            </Button>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                onClick={() => destroy(sector)}
                                            >
                                                <Trash2 />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Card>
            </div>

            {/* Dialog: criar / editar setor */}
            <Dialog open={sectorDialog} onOpenChange={setSectorDialog}>
                <DialogContent>
                    <form onSubmit={submitSector}>
                        <DialogHeader>
                            <DialogTitle>
                                {editing ? 'Editar setor' : 'Novo setor'}
                            </DialogTitle>
                            <DialogDescription>
                                {editing
                                    ? 'Atualize as informações do setor.'
                                    : 'Crie um novo setor de atendimento.'}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="sector-name">Nome</Label>
                                <Input
                                    id="sector-name"
                                    value={form.data.name}
                                    onChange={(e) => form.setData('name', e.target.value)}
                                    placeholder="Ex: Suporte, Financeiro, Vendas"
                                />
                                {form.errors.name && (
                                    <p className="text-xs text-red-500">{form.errors.name}</p>
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="sector-description">Descrição</Label>
                                <Input
                                    id="sector-description"
                                    value={form.data.description}
                                    onChange={(e) => form.setData('description', e.target.value)}
                                    placeholder="Opcional"
                                />
                                {form.errors.description && (
                                    <p className="text-xs text-red-500">{form.errors.description}</p>
                                )}
                            </div>

                            <div className="flex items-center gap-3">
                                <Switch
                                    id="sector-active"
                                    checked={form.data.is_active}
                                    onCheckedChange={(v) => form.setData('is_active', v)}
                                />
                                <Label htmlFor="sector-active">Setor ativo</Label>
                            </div>
                        </div>

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setSectorDialog(false)}
                            >
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={form.processing}>
                                Salvar
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Dialog: gerenciar atendentes */}
            <Dialog open={usersDialog} onOpenChange={setUsersDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Atendentes — {managingUsers?.name}</DialogTitle>
                        <DialogDescription>
                            Selecione os atendentes que fazem parte deste setor.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="max-h-64 overflow-y-auto py-2">
                        {attendants.length === 0 ? (
                            <p className="text-sm text-ink/45">Nenhum atendente cadastrado.</p>
                        ) : (
                            <div className="space-y-2">
                                {attendants.map((att) => (
                                    <label
                                        key={att.id}
                                        className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-ink/78 hover:bg-ink/[0.06]"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedUserIds.includes(att.id)}
                                            onChange={() => toggleUser(att.id)}
                                            className="h-4 w-4 rounded border-ink/[0.18] bg-ink/[0.04] text-accent focus:ring-accent/30"
                                        />
                                        <span className="text-sm">{att.name}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setUsersDialog(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={submitUsers}>Salvar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AuthenticatedLayout>
    );
}
