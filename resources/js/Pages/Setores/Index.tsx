import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/Components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/Components/ui/dropdown-menu';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { Switch } from '@/Components/ui/switch';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router, useForm } from '@inertiajs/react';
import { GripVertical, MoreVertical, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { DragEvent, FormEvent, useEffect, useState } from 'react';

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

function initials(name: string): string {
    return name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => p[0])
        .join('')
        .toUpperCase();
}

export default function SetoresIndex({ sectors: initialSectors, attendants }: Props) {
    const [sectors, setSectors] = useState<Sector[]>(initialSectors);
    const [dragOverId, setDragOverId] = useState<number | null>(null);
    const [search, setSearch] = useState('');
    const [sectorDialog, setSectorDialog] = useState(false);
    const [editing, setEditing] = useState<Sector | null>(null);

    useEffect(() => {
        setSectors(initialSectors);
    }, [initialSectors]);

    const form = useForm({ name: '', description: '', is_active: true });

    const filtered = attendants.filter((a) =>
        a.name.toLowerCase().includes(search.toLowerCase()),
    );

    /* ── drag from sidebar ── */
    const onDragStart = (e: DragEvent, userId: number) => {
        e.dataTransfer.setData('userId', String(userId));
        e.dataTransfer.effectAllowed = 'copy';
    };

    const onDragOver = (e: DragEvent, sectorId: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        setDragOverId(sectorId);
    };

    const onDragLeave = () => setDragOverId(null);

    const onDrop = (e: DragEvent, sector: Sector) => {
        e.preventDefault();
        setDragOverId(null);
        const userId = parseInt(e.dataTransfer.getData('userId'));
        if (!userId) return;
        if (sector.users.some((u) => u.id === userId)) return;
        syncUsers(sector, [...sector.users.map((u) => u.id), userId]);
    };

    /* ── sync helpers ── */
    const syncUsers = (sector: Sector, newIds: number[]) => {
        const snapshot = sector;
        setSectors((prev) =>
            prev.map((s) =>
                s.id === sector.id
                    ? { ...s, users: attendants.filter((a) => newIds.includes(a.id)) }
                    : s,
            ),
        );
        router.post(
            route('setores.users.sync', sector.id),
            { user_ids: newIds },
            {
                preserveScroll: true,
                onError: () =>
                    setSectors((prev) =>
                        prev.map((s) => (s.id === snapshot.id ? snapshot : s)),
                    ),
            },
        );
    };

    const removeUser = (sector: Sector, userId: number) => {
        syncUsers(
            sector,
            sector.users.filter((u) => u.id !== userId).map((u) => u.id),
        );
    };

    /* ── sector CRUD ── */
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
        const opts = {
            preserveScroll: true,
            onSuccess: () => {
                setSectorDialog(false);
                form.reset();
            },
        };
        editing
            ? form.put(route('setores.update', editing.id), opts)
            : form.post(route('setores.store'), opts);
    };

    const destroy = (sector: Sector) => {
        if (!confirm(`Excluir o setor "${sector.name}"?`)) return;
        router.delete(route('setores.destroy', sector.id), { preserveScroll: true });
    };

    return (
        <AuthenticatedLayout>
            <Head title="Setores" />

            <div className="flex h-full flex-col">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-ink/[0.08] px-6 py-4">
                    <div>
                        <h1 className="font-manrope text-xl font-bold">Setores</h1>
                        <p className="text-sm text-ink/60">
                            Gerencie os usuários da sua empresa por setores
                        </p>
                    </div>
                    <Button onClick={openCreate}>
                        <Plus className="mr-1.5 h-4 w-4" />
                        Cadastrar
                    </Button>
                </div>

                {/* Main area */}
                <div className="flex flex-1 gap-5 overflow-hidden p-6">
                    {/* Sector cards */}
                    <div className="flex-1 overflow-y-auto pr-1">
                        {sectors.length === 0 ? (
                            <div className="flex h-48 items-center justify-center rounded-xl border-2 border-dashed border-ink/20 text-sm text-ink/40">
                                Nenhum setor cadastrado — clique em "+ Cadastrar" para começar.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                                {sectors.map((sector) => (
                                    <div
                                        key={sector.id}
                                        onDragOver={(e) => onDragOver(e, sector.id)}
                                        onDragLeave={onDragLeave}
                                        onDrop={(e) => onDrop(e, sector)}
                                        className={[
                                            'rounded-xl border bg-card transition-all',
                                            dragOverId === sector.id
                                                ? 'border-accent/50 ring-2 ring-accent/20 bg-accent/[0.03]'
                                                : 'border-ink/[0.08]',
                                        ].join(' ')}
                                    >
                                        {/* Card header */}
                                        <div className="flex items-start justify-between p-4 pb-3">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-manrope truncate font-semibold leading-tight">
                                                        {sector.name}
                                                    </h3>
                                                    {!sector.is_active && (
                                                        <span className="shrink-0 rounded-full bg-ink/10 px-1.5 py-0.5 text-[10px] text-ink/50">
                                                            Inativo
                                                        </span>
                                                    )}
                                                </div>
                                                {sector.description && (
                                                    <p className="mt-0.5 truncate text-xs text-ink/50">
                                                        {sector.description}
                                                    </p>
                                                )}
                                            </div>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="ml-2 h-7 w-7 shrink-0"
                                                    >
                                                        <MoreVertical className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem
                                                        onClick={() => openEdit(sector)}
                                                    >
                                                        <Pencil className="mr-2 h-4 w-4" />
                                                        Editar
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        className="text-red-500 focus:text-red-500"
                                                        onClick={() => destroy(sector)}
                                                    >
                                                        <Trash2 className="mr-2 h-4 w-4" />
                                                        Excluir
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>

                                        <div className="mx-4 border-t border-ink/[0.06]" />

                                        {/* Members */}
                                        <div className="p-4 pt-3">
                                            {sector.users.length === 0 ? (
                                                <p
                                                    className={[
                                                        'rounded-lg border-2 border-dashed py-4 text-center text-xs transition-colors',
                                                        dragOverId === sector.id
                                                            ? 'border-accent/40 text-accent/60'
                                                            : 'border-ink/10 text-ink/35',
                                                    ].join(' ')}
                                                >
                                                    Arraste atendentes aqui
                                                </p>
                                            ) : (
                                                <div className="space-y-1">
                                                    {sector.users.map((user) => (
                                                        <div
                                                            key={user.id}
                                                            className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-ink/[0.04]"
                                                        >
                                                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-accent/35 bg-accent/15 font-manrope text-[10px] font-bold text-accent">
                                                                {initials(user.name)}
                                                            </div>
                                                            <span className="flex-1 truncate text-sm text-ink/80">
                                                                {user.name}
                                                            </span>
                                                            <button
                                                                onClick={() =>
                                                                    removeUser(sector, user.id)
                                                                }
                                                                title="Remover do setor"
                                                                className="hidden h-5 w-5 items-center justify-center rounded text-ink/30 transition-colors hover:bg-ink/10 hover:text-red-400 group-hover:flex"
                                                            >
                                                                <X className="h-3 w-3" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Attendants sidebar */}
                    <div className="w-64 shrink-0 overflow-y-auto rounded-xl border border-ink/[0.08] bg-card p-4">
                        <div className="relative mb-3">
                            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/40" />
                            <Input
                                placeholder="Pesquisar atendentes"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="h-8 pl-8 text-sm"
                            />
                        </div>

                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/40">
                            Todos
                        </p>

                        <div className="space-y-0.5">
                            {filtered.length === 0 ? (
                                <p className="py-6 text-center text-xs text-ink/40">
                                    Nenhum resultado
                                </p>
                            ) : (
                                filtered.map((att) => (
                                    <div
                                        key={att.id}
                                        draggable
                                        onDragStart={(e) => onDragStart(e, att.id)}
                                        className="flex cursor-grab items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-ink/[0.04] active:cursor-grabbing"
                                    >
                                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-accent/35 bg-accent/15 font-manrope text-[10px] font-bold text-accent">
                                            {initials(att.name)}
                                        </div>
                                        <span className="flex-1 truncate text-sm text-ink/80">
                                            {att.name}
                                        </span>
                                        <GripVertical className="h-3.5 w-3.5 shrink-0 text-ink/25" />
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Dialog: criar / editar */}
            <Dialog open={sectorDialog} onOpenChange={setSectorDialog}>
                <DialogContent>
                    <form onSubmit={submitSector}>
                        <DialogHeader>
                            <DialogTitle>{editing ? 'Editar setor' : 'Novo setor'}</DialogTitle>
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
                                <Label htmlFor="sector-desc">Descrição</Label>
                                <Input
                                    id="sector-desc"
                                    value={form.data.description}
                                    onChange={(e) =>
                                        form.setData('description', e.target.value)
                                    }
                                    placeholder="Opcional"
                                />
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
        </AuthenticatedLayout>
    );
}
