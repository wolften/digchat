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
import { Head, router, useForm } from '@inertiajs/react';
import axios from 'axios';
import {
    AlertTriangle,
    CheckCircle2,
    Copy,
    Loader2,
    Pencil,
    Plus,
    RefreshCw,
    Send,
    Trash2,
} from 'lucide-react';
import { FormEvent, useState } from 'react';
import { toast } from 'sonner';

type ChannelMeta = {
    phone_number_id?: string;
    api_version?: string;
    waba_id?: string;
    has_token?: boolean;
    has_app_secret?: boolean;
    has_webhook_secret?: boolean;
    webhook_base_url?: string;
};

type Channel = {
    id: number;
    type: 'whatsapp' | 'telegram';
    name: string;
    is_active: boolean;
    webhook_url: string;
    meta: ChannelMeta;
};

type Props = {
    channels: Channel[];
};

type FormData = {
    type: 'whatsapp' | 'telegram';
    name: string;
    is_active: boolean;
    config: {
        access_token?: string;
        phone_number_id?: string;
        api_version?: string;
        verify_token?: string;
        app_secret?: string;
        waba_id?: string;
        bot_token?: string;
        webhook_secret?: string;
        webhook_base_url?: string;
    };
};

const emptyForm = (): FormData => ({
    type: 'whatsapp',
    name: '',
    is_active: true,
    config: { api_version: 'v21.0' },
});

export default function CanaisIndex({ channels }: Props) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
    const [testingId, setTestingId] = useState<number | null>(null);
    const [webhookId, setWebhookId] = useState<number | null>(null);

    const form = useForm<FormData>(emptyForm());

    function openCreate() {
        setEditingChannel(null);
        form.reset();
        form.clearErrors();
        form.setData(emptyForm());
        setDialogOpen(true);
    }

    function openEdit(ch: Channel) {
        setEditingChannel(ch);
        form.clearErrors();
        form.setData({
            type: ch.type,
            name: ch.name,
            is_active: ch.is_active,
            config: {
                api_version: ch.meta.api_version ?? 'v21.0',
                phone_number_id: ch.meta.phone_number_id ?? '',
                waba_id: ch.meta.waba_id ?? '',
                access_token: '',
                verify_token: '',
                app_secret: '',
                bot_token: '',
                webhook_secret: '',
                webhook_base_url: ch.meta.webhook_base_url ?? '',
            },
        });
        setDialogOpen(true);
    }

    function submit(e: FormEvent) {
        e.preventDefault();
        const opts = {
            preserveScroll: true,
            onSuccess: () => setDialogOpen(false),
        };
        if (editingChannel) {
            form.put(route('canais.update', editingChannel.id), opts);
        } else {
            form.post(route('canais.store'), opts);
        }
    }

    function destroy(ch: Channel) {
        if (confirm(`Remover o canal "${ch.name}"?`)) {
            router.delete(route('canais.destroy', ch.id), { preserveScroll: true });
        }
    }

    function testConnection(ch: Channel) {
        setTestingId(ch.id);
        axios
            .post<{ status: string; title: string; message: string }>(route('canais.test', ch.id))
            .then(({ data }) => {
                if (data.status === 'ok') {
                    toast.success(data.title, { description: data.message });
                } else {
                    toast.error(data.title, { description: data.message });
                }
            })
            .catch(() => toast.error('Falha ao testar conexão.'))
            .finally(() => setTestingId(null));
    }

    function registerWebhook(ch: Channel) {
        setWebhookId(ch.id);
        axios
            .post<{ status: string; message: string }>(route('canais.webhook', ch.id))
            .then(({ data }) => {
                if (data.status === 'ok') {
                    toast.success(data.message);
                } else {
                    toast.error(data.message);
                }
            })
            .catch(() => toast.error('Falha ao registrar webhook.'))
            .finally(() => setWebhookId(null));
    }

    function copyWebhook(url: string) {
        navigator.clipboard.writeText(url)
            .then(() => toast.success('URL copiada!'))
            .catch(() => {});
    }

    return (
        <AuthenticatedLayout>
            <Head title="Canais" />

            <div className="space-y-4 p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="font-manrope text-xl font-bold">Canais</h1>
                        <p className="text-sm text-ink/60">
                            Configure WhatsApp e Telegram para receber e enviar mensagens.
                        </p>
                    </div>
                    <Button onClick={openCreate}>
                        <Plus className="mr-1.5 h-4 w-4" />
                        Novo canal
                    </Button>
                </div>

                <Card className="overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-ink/[0.08] bg-ink/[0.03] text-xs font-semibold uppercase tracking-wide text-ink/50">
                                <th className="px-4 py-3 text-left">Nome</th>
                                <th className="px-4 py-3 text-left">Tipo</th>
                                <th className="px-4 py-3 text-left">Identificador</th>
                                <th className="px-4 py-3 text-left">Status</th>
                                <th className="px-4 py-3" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-ink/[0.08]">
                            {channels.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="py-8 text-center text-ink/45">
                                        Nenhum canal cadastrado.
                                    </td>
                                </tr>
                            )}
                            {channels.map((ch) => (
                                <tr key={ch.id} className="hover:bg-accent/[0.04]">
                                    <td className="px-4 py-3 font-medium">{ch.name}</td>
                                    <td className="px-4 py-3">
                                        <TypeBadge type={ch.type} />
                                    </td>
                                    <td className="px-4 py-3 font-mono text-xs text-ink/60">
                                        {ch.type === 'whatsapp'
                                            ? ch.meta.phone_number_id ?? '—'
                                            : ch.meta.has_token ? 'Token configurado' : '—'}
                                    </td>
                                    <td className="px-4 py-3">
                                        {ch.is_active ? (
                                            <Badge variant="outline">Ativo</Badge>
                                        ) : (
                                            <Badge variant="destructive">Inativo</Badge>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex justify-end gap-1">
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                onClick={() => testConnection(ch)}
                                                title="Testar conexão"
                                                disabled={testingId === ch.id}
                                            >
                                                {testingId === ch.id
                                                    ? <Loader2 className="h-4 w-4 animate-spin" />
                                                    : <RefreshCw className="h-4 w-4" />}
                                            </Button>
                                            {ch.type === 'telegram' && (
                                                <>
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        onClick={() => registerWebhook(ch)}
                                                        title="Registrar webhook"
                                                        disabled={webhookId === ch.id}
                                                    >
                                                        {webhookId === ch.id
                                                            ? <Loader2 className="h-4 w-4 animate-spin" />
                                                            : <Send className="h-4 w-4" />}
                                                    </Button>
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        onClick={() => copyWebhook(ch.webhook_url)}
                                                        title="Copiar URL do webhook"
                                                    >
                                                        <Copy className="h-4 w-4" />
                                                    </Button>
                                                </>
                                            )}
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                onClick={() => openEdit(ch)}
                                                title="Editar"
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                onClick={() => destroy(ch)}
                                                title="Remover"
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
                <DialogContent className="max-w-lg">
                    <form onSubmit={submit}>
                        <DialogHeader>
                            <DialogTitle>
                                {editingChannel ? 'Editar canal' : 'Novo canal'}
                            </DialogTitle>
                            <DialogDescription>
                                {editingChannel
                                    ? 'Atualize as configurações do canal. Deixe campos de token em branco para mantê-los.'
                                    : 'Configure um novo canal de atendimento WhatsApp ou Telegram.'}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label>Tipo</Label>
                                    <Select
                                        value={form.data.type}
                                        onValueChange={(v) =>
                                            form.setData((d) => ({
                                                ...d,
                                                type: v as 'whatsapp' | 'telegram',
                                                config: v === 'whatsapp' ? { api_version: 'v21.0' } : {},
                                            }))
                                        }
                                        disabled={!!editingChannel}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="whatsapp">WhatsApp</SelectItem>
                                            <SelectItem value="telegram">Telegram</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-1.5">
                                    <Label>Nome</Label>
                                    <Input
                                        value={form.data.name}
                                        onChange={(e) => form.setData('name', e.target.value)}
                                        placeholder="Ex.: WhatsApp Suporte"
                                    />
                                    {form.errors.name && (
                                        <p className="text-xs text-red-500">{form.errors.name}</p>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <Switch
                                    id="is_active"
                                    checked={form.data.is_active}
                                    onCheckedChange={(v) => form.setData('is_active', v)}
                                />
                                <Label htmlFor="is_active">Canal ativo</Label>
                            </div>

                            <hr className="border-ink/[0.08]" />

                            {form.data.type === 'whatsapp' ? (
                                <WhatsAppFields form={form} editing={!!editingChannel} />
                            ) : (
                                <TelegramFields form={form} editing={!!editingChannel} />
                            )}
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={form.processing}>
                                {form.processing && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                                Salvar
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </AuthenticatedLayout>
    );
}

const WhatsAppIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
);

const TelegramIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
);

function TypeBadge({ type }: { type: 'whatsapp' | 'telegram' }) {
    if (type === 'whatsapp') {
        return (
            <Badge variant="secondary" className="gap-1">
                <WhatsAppIcon className="h-3 w-3 text-green-600" />
                WhatsApp
            </Badge>
        );
    }
    return (
        <Badge variant="secondary" className="gap-1">
            <TelegramIcon className="h-3 w-3 text-blue-500" />
            Telegram
        </Badge>
    );
}

type FieldProps = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    form: any;
    editing: boolean;
};

function WhatsAppFields({ form, editing }: FieldProps) {
    const set = (key: string, value: string) =>
        form.setData('config', { ...form.data.config, [key]: value });

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <Label>Phone Number ID</Label>
                    <Input
                        value={form.data.config.phone_number_id ?? ''}
                        onChange={(e) => set('phone_number_id', e.target.value)}
                        placeholder="123456789012345"
                        className="font-mono text-sm"
                    />
                </div>
                <div className="space-y-1.5">
                    <Label>Versão da API</Label>
                    <Input
                        value={form.data.config.api_version ?? ''}
                        onChange={(e) => set('api_version', e.target.value)}
                        placeholder="v21.0"
                        className="font-mono text-sm"
                    />
                </div>
            </div>

            <div className="space-y-1.5">
                <Label>
                    Access Token{' '}
                    {editing && <span className="text-xs text-ink/45">(em branco = manter)</span>}
                </Label>
                <Input
                    type="password"
                    value={form.data.config.access_token ?? ''}
                    onChange={(e) => set('access_token', e.target.value)}
                    placeholder={editing ? '••••••••' : 'EAABwzLix...'}
                    autoComplete="new-password"
                />
                {form.errors['config.access_token'] && (
                    <p className="text-xs text-red-500">{form.errors['config.access_token']}</p>
                )}
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <Label>Verify Token</Label>
                    <Input
                        value={form.data.config.verify_token ?? ''}
                        onChange={(e) => set('verify_token', e.target.value)}
                        placeholder="meu_token_secreto"
                    />
                </div>
                <div className="space-y-1.5">
                    <Label>WABA ID <span className="text-xs text-ink/45">(opcional)</span></Label>
                    <Input
                        value={form.data.config.waba_id ?? ''}
                        onChange={(e) => set('waba_id', e.target.value)}
                        placeholder="123456789"
                        className="font-mono text-sm"
                    />
                </div>
            </div>

            <div className="space-y-1.5">
                <Label>
                    App Secret <span className="text-xs text-ink/45">(opcional)</span>
                    {editing && <span className="text-xs text-ink/45"> · em branco = manter</span>}
                </Label>
                <Input
                    type="password"
                    value={form.data.config.app_secret ?? ''}
                    onChange={(e) => set('app_secret', e.target.value)}
                    placeholder={editing ? '••••••••' : 'abc123...'}
                    autoComplete="new-password"
                />
            </div>

            <div className="rounded-lg bg-ink/[0.03] px-3 py-2.5 text-xs text-ink/50">
                <span className="font-medium">Webhook URL: </span>
                <span className="font-mono">{window.location.origin}/api/webhooks/whatsapp</span>
            </div>
        </div>
    );
}

function TelegramFields({ form, editing }: FieldProps) {
    const set = (key: string, value: string) =>
        form.setData('config', { ...form.data.config, [key]: value });

    return (
        <div className="space-y-3">
            <div className="space-y-1.5">
                <Label>
                    Bot Token{' '}
                    {editing && <span className="text-xs text-ink/45">(em branco = manter)</span>}
                </Label>
                <Input
                    type="password"
                    value={form.data.config.bot_token ?? ''}
                    onChange={(e) => set('bot_token', e.target.value)}
                    placeholder={editing ? '••••••••' : '123456:ABC-DEF...'}
                    autoComplete="new-password"
                />
                {form.errors['config.bot_token'] && (
                    <p className="text-xs text-red-500">{form.errors['config.bot_token']}</p>
                )}
            </div>

            <div className="space-y-1.5">
                <Label>
                    Webhook Secret{' '}
                    <span className="text-xs text-ink/45">(opcional, recomendado)</span>
                </Label>
                <Input
                    type="password"
                    value={form.data.config.webhook_secret ?? ''}
                    onChange={(e) => set('webhook_secret', e.target.value)}
                    placeholder={editing ? '••••••••' : 'string_aleatória_segura'}
                    autoComplete="new-password"
                />
            </div>

            <div className="space-y-1.5">
                <Label>
                    Webhook Base URL{' '}
                    <span className="text-xs text-ink/45">(opcional — dev/tunnel)</span>
                </Label>
                <Input
                    value={form.data.config.webhook_base_url ?? ''}
                    onChange={(e) => set('webhook_base_url', e.target.value)}
                    placeholder="https://xyz.trycloudflare.com"
                    className="font-mono text-sm"
                />
                {form.errors['config.webhook_base_url'] && (
                    <p className="text-xs text-red-500">{form.errors['config.webhook_base_url']}</p>
                )}
                <p className="text-xs text-ink/45">
                    Deixe em branco em produção. Preencha com a URL pública do seu tunnel (Cloudflare, ngrok…) em desenvolvimento local.
                </p>
            </div>

            <div className="rounded-lg bg-ink/[0.03] px-3 py-2.5 text-xs text-ink/50 space-y-1">
                <p>1. Crie um bot com o <strong>@BotFather</strong> e copie o token.</p>
                <p>2. Salve o canal — o webhook é registrado automaticamente.</p>
                <p>3. Use o botão <Send className="inline h-3 w-3" /> para registrar novamente se necessário.</p>
            </div>
        </div>
    );
}
