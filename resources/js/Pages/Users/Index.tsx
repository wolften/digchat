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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/Components/ui/select';
import { Switch } from '@/Components/ui/switch';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Paginated, User, UserRole } from '@/types';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { FormEvent, useState } from 'react';

const ROLE_LABELS: Record<UserRole, string> = {
    admin: 'Administrador',
    gestor: 'Gestor',
    atendente: 'Atendente',
};

interface Props {
    users: Paginated<User>;
    roles: UserRole[];
    filters: { search: string };
}

export default function UsersIndex({ users, roles, filters }: Props) {
    const currentUser = usePage().props.auth.user;
    const isAdmin = currentUser.role === 'admin';
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<User | null>(null);
    const [search, setSearch] = useState(filters.search ?? '');

    const form = useForm({
        name: '',
        email: '',
        role: 'atendente' as UserRole,
        is_active: true,
        password: '',
        password_confirmation: '',
    });

    const openCreate = () => {
        setEditing(null);
        form.reset();
        form.clearErrors();
        setDialogOpen(true);
    };

    const openEdit = (user: User) => {
        setEditing(user);
        form.clearErrors();
        form.setData({
            name: user.name,
            email: user.email,
            role: user.role,
            is_active: user.is_active,
            password: '',
            password_confirmation: '',
        });
        setDialogOpen(true);
    };

    const submit = (e: FormEvent) => {
        e.preventDefault();
        const options = {
            preserveScroll: true,
            onSuccess: () => {
                setDialogOpen(false);
                form.reset();
            },
        };

        if (editing) {
            form.put(route('users.update', editing.id), options);
        } else {
            form.post(route('users.store'), options);
        }
    };

    const destroy = (user: User) => {
        if (confirm(`Remover o usuário "${user.name}"?`)) {
            router.delete(route('users.destroy', user.id), {
                preserveScroll: true,
            });
        }
    };

    const runSearch = (e: FormEvent) => {
        e.preventDefault();
        router.get(route('users.index'), { search }, { preserveState: true, replace: true });
    };

    const availableRoles = isAdmin ? roles : roles.filter((r) => r !== 'admin');

    return (
        <AuthenticatedLayout>
            <Head title="Usuários" />

            <div className="space-y-4 p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="font-manrope text-xl font-bold">Usuários</h1>
                        <p className="text-sm text-ink/60">
                            Gerencie atendentes, gestores e administradores do sistema.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <form onSubmit={runSearch} className="flex gap-2">
                            <Input
                                placeholder="Buscar por nome ou e-mail..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-64"
                            />
                            <Button type="submit" variant="outline">
                                Buscar
                            </Button>
                        </form>
                        <Button onClick={openCreate}>
                            <Plus className="mr-1.5 h-4 w-4" />
                            Novo usuário
                        </Button>
                    </div>
                </div>

                <Card className="overflow-hidden">
                    <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-ink/[0.08] bg-ink/[0.03] text-xs font-semibold uppercase tracking-wide text-ink/50">
                                <th className="px-4 py-3 text-left">Nome</th>
                                <th className="px-4 py-3 text-left">E-mail</th>
                                <th className="px-4 py-3 text-left">Papel</th>
                                <th className="px-4 py-3 text-left">Status</th>
                                <th className="px-4 py-3" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-ink/[0.08]">
                            {users.data.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="py-8 text-center text-ink/45">
                                        Nenhum usuário encontrado.
                                    </td>
                                </tr>
                            )}
                            {users.data.map((user) => (
                                <tr key={user.id} className="hover:bg-accent/[0.04]">
                                    <td className="px-4 py-3 font-medium">{user.name}</td>
                                    <td className="px-4 py-3 text-ink/60">{user.email}</td>
                                    <td className="px-4 py-3">
                                        <Badge
                                            variant={user.role === 'admin' ? 'default' : 'secondary'}
                                        >
                                            {ROLE_LABELS[user.role]}
                                        </Badge>
                                    </td>
                                    <td className="px-4 py-3">
                                        {user.is_active ? (
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
                                                onClick={() => openEdit(user)}
                                            >
                                                <Pencil />
                                            </Button>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                onClick={() => destroy(user)}
                                                disabled={user.id === currentUser.id}
                                            >
                                                <Trash2 />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    </div>
                </Card>

                {users.last_page > 1 && (
                    <div className="flex items-center justify-between text-sm text-ink/50">
                        <span>
                            {users.from}–{users.to} de {users.total}
                        </span>
                        <div className="flex gap-1">
                            {users.links.map((link, i) => (
                                <Button
                                    key={i}
                                    size="sm"
                                    variant={link.active ? 'default' : 'outline'}
                                    disabled={!link.url}
                                    onClick={() =>
                                        link.url &&
                                        router.get(link.url, undefined, { preserveState: true })
                                    }
                                    dangerouslySetInnerHTML={{ __html: link.label }}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent>
                    <form onSubmit={submit}>
                        <DialogHeader>
                            <DialogTitle>
                                {editing ? 'Editar usuário' : 'Novo usuário'}
                            </DialogTitle>
                            <DialogDescription>
                                {editing
                                    ? 'Atualize os dados do usuário. Deixe a senha em branco para mantê-la.'
                                    : 'Cadastre um novo atendente, gestor ou administrador.'}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="name">Nome</Label>
                                <Input
                                    id="name"
                                    value={form.data.name}
                                    onChange={(e) => form.setData('name', e.target.value)}
                                />
                                {form.errors.name && (
                                    <p className="text-xs text-red-500">{form.errors.name}</p>
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="email">E-mail</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={form.data.email}
                                    onChange={(e) => form.setData('email', e.target.value)}
                                />
                                {form.errors.email && (
                                    <p className="text-xs text-red-500">{form.errors.email}</p>
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <Label>Papel</Label>
                                <Select
                                    value={form.data.role}
                                    onValueChange={(v) => form.setData('role', v as UserRole)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableRoles.map((r) => (
                                            <SelectItem key={r} value={r}>
                                                {ROLE_LABELS[r]}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {form.errors.role && (
                                    <p className="text-xs text-red-500">{form.errors.role}</p>
                                )}
                            </div>

                            <div className="flex items-center gap-3">
                                <Switch
                                    id="is_active"
                                    checked={form.data.is_active}
                                    onCheckedChange={(v) => form.setData('is_active', v)}
                                />
                                <Label htmlFor="is_active">Usuário ativo</Label>
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="password">Senha</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    autoComplete="new-password"
                                    value={form.data.password}
                                    onChange={(e) => form.setData('password', e.target.value)}
                                />
                                {form.errors.password && (
                                    <p className="text-xs text-red-500">{form.errors.password}</p>
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="password_confirmation">Confirmar senha</Label>
                                <Input
                                    id="password_confirmation"
                                    type="password"
                                    autoComplete="new-password"
                                    value={form.data.password_confirmation}
                                    onChange={(e) =>
                                        form.setData('password_confirmation', e.target.value)
                                    }
                                />
                            </div>
                        </div>

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setDialogOpen(false)}
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
