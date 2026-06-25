import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import {
    Dialog,
    DialogContent,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/Components/ui/tabs';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm, usePage } from '@inertiajs/react';
import axios from 'axios';
import { AlertTriangle, Building2, CheckCircle2, Eye, EyeOff, ImageIcon, Loader2, MessageCircle, MessageSquare, Pencil, PlugZap, Plus, Save, Settings2, Trash2, Upload, Wifi } from 'lucide-react';
import { ChangeEvent, FormEvent, useRef, useState } from 'react';
import { toast } from 'sonner';

interface Survey {
    id: number;
    name: string;
}

interface IntegrationConfig {
    id: number;
    type: string;
    name: string;
    base_url: string;
    is_active: boolean;
}

interface Props {
    settings: Record<string, string | null>;
    surveys: Survey[];
    integrations: IntegrationConfig[];
}

interface WhatsAppHealthResult {
    status: 'ok' | 'warning' | 'error';
    title: string;
    message: string;
    details?: Record<string, string | number | Array<string | number> | null | undefined>;
}

function SecretInput({
    id,
    value,
    onChange,
    placeholder,
}: {
    id: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
}) {
    const [show, setShow] = useState(false);

    return (
        <div className="relative">
            <Input
                id={id}
                type={show ? 'text' : 'password'}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder ?? '••••••••'}
                className="pr-10 font-mono text-sm"
                autoComplete="off"
            />
            <button
                type="button"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink/40 hover:text-ink"
                onClick={() => setShow((s) => !s)}
                tabIndex={-1}
            >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
        </div>
    );
}

export default function ConfiguracoesIndex({ settings, surveys, integrations }: Props) {
    const { appIconUrl } = usePage().props;
    const [healthResult, setHealthResult] = useState<WhatsAppHealthResult | null>(null);
    const [healthChecking, setHealthChecking] = useState(false);

    /* ── WhatsApp form ── */
    const waForm = useForm({
        whatsapp_access_token:    settings.whatsapp_access_token    ?? '',
        whatsapp_phone_number_id: settings.whatsapp_phone_number_id ?? '',
        whatsapp_api_version:     settings.whatsapp_api_version     ?? '',
        whatsapp_verify_token:    settings.whatsapp_verify_token    ?? '',
        whatsapp_app_secret:      settings.whatsapp_app_secret      ?? '',
        whatsapp_waba_id:         settings.whatsapp_waba_id         ?? '',
    });

    const submitWa = (e: FormEvent) => {
        e.preventDefault();
        waForm.post(route('configuracoes.update'), { preserveScroll: true });
    };

    const testWhatsAppHealth = async () => {
        setHealthChecking(true);
        setHealthResult(null);

        try {
            const response = await axios.post<WhatsAppHealthResult>(route('configuracoes.whatsapp-health'), {
                whatsapp_access_token: waForm.data.whatsapp_access_token,
                whatsapp_phone_number_id: waForm.data.whatsapp_phone_number_id,
                whatsapp_api_version: waForm.data.whatsapp_api_version,
            });

            setHealthResult(response.data);

            if (response.data.status === 'ok') {
                toast.success(response.data.title);
            } else {
                toast.error(response.data.title);
            }
        } catch (error) {
            const message = axios.isAxiosError(error)
                ? (error.response?.data?.message ?? 'Não foi possível executar o teste de conexão.')
                : 'Não foi possível executar o teste de conexão.';

            setHealthResult({
                status: 'error',
                title: 'Teste não concluído',
                message,
            });
            toast.error(message);
        } finally {
            setHealthChecking(false);
        }
    };

    /* ── Sistema form ── */
    const transferNotificationEnabled = !['0', 'false', 'off'].includes(
        String(settings.notify_customer_on_transfer ?? '1').toLowerCase(),
    );
    const autoCloseInactiveEnabled = !['0', 'false', 'off'].includes(
        String(settings.auto_close_inactive_conversations_enabled ?? '0').toLowerCase(),
    );
    const autoCloseInactiveMinutes = Number.parseInt(
        String(settings.auto_close_inactive_conversations_minutes ?? '60'),
        10,
    ) || 60;
    const surveyOnCloseEnabled = !['0', 'false', 'off'].includes(
        String(settings.survey_on_close_enabled ?? '0').toLowerCase(),
    );
    const surveyOnCloseSurveyId = settings.survey_on_close_survey_id
        ? String(settings.survey_on_close_survey_id)
        : '';

    const surveyOnInactivityCloseEnabled = !['0', 'false', 'off'].includes(
        String(settings.survey_on_inactivity_close_enabled ?? '0').toLowerCase(),
    );

    const sysForm = useForm<{
        app_name: string;
        app_icon: File | null;
        notify_customer_on_transfer: boolean;
        auto_close_inactive_conversations_enabled: boolean;
        auto_close_inactive_conversations_minutes: number;
        survey_on_inactivity_close_enabled: boolean;
        survey_on_close_enabled: boolean;
        survey_on_close_survey_id: string;
    }>({
        app_name: settings.app_name ?? '',
        app_icon: null,
        notify_customer_on_transfer: transferNotificationEnabled,
        auto_close_inactive_conversations_enabled: autoCloseInactiveEnabled,
        auto_close_inactive_conversations_minutes: autoCloseInactiveMinutes,
        survey_on_inactivity_close_enabled: surveyOnInactivityCloseEnabled,
        survey_on_close_enabled: surveyOnCloseEnabled,
        survey_on_close_survey_id: surveyOnCloseSurveyId,
    });

    const [iconPreview, setIconPreview] = useState<string | null>(appIconUrl ?? null);
    const fileRef = useRef<HTMLInputElement>(null);

    /* ── Integrações ── */
    const [integrationDialog, setIntegrationDialog] = useState<{
        open: boolean;
        editing: IntegrationConfig | null;
    }>({ open: false, editing: null });
    const [testingId, setTestingId] = useState<number | null>(null);

    const integrationForm = useForm({
        type:      'ixc',
        name:      '',
        base_url:  '',
        token:     '',
        is_active: true as boolean,
    });

    const openNewIntegration = () => {
        integrationForm.reset();
        integrationForm.setData({ type: 'ixc', name: '', base_url: '', token: '', is_active: true });
        setIntegrationDialog({ open: true, editing: null });
    };

    const openEditIntegration = (cfg: IntegrationConfig) => {
        integrationForm.setData({ type: cfg.type, name: cfg.name, base_url: cfg.base_url, token: '', is_active: cfg.is_active });
        setIntegrationDialog({ open: true, editing: cfg });
    };

    const submitIntegration = (e: FormEvent) => {
        e.preventDefault();
        if (integrationDialog.editing) {
            integrationForm.put(route('integracoes.update', integrationDialog.editing.id), {
                preserveScroll: true,
                onSuccess: () => setIntegrationDialog({ open: false, editing: null }),
            });
        } else {
            integrationForm.post(route('integracoes.store'), {
                preserveScroll: true,
                onSuccess: () => setIntegrationDialog({ open: false, editing: null }),
            });
        }
    };

    const deleteIntegration = (cfg: IntegrationConfig) => {
        if (!confirm(`Remover a integração "${cfg.name}"?`)) return;
        integrationForm.delete(route('integracoes.destroy', cfg.id), { preserveScroll: true });
    };

    const testIntegration = async (cfg: IntegrationConfig) => {
        setTestingId(cfg.id);
        try {
            const res = await axios.post<{ ok: boolean; message: string }>(route('integracoes.test', cfg.id));
            if (res.data.ok) toast.success(res.data.message);
            else toast.error(res.data.message);
        } catch {
            toast.error('Erro ao testar conexão.');
        } finally {
            setTestingId(null);
        }
    };

    const handleIconChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] ?? null;
        sysForm.setData('app_icon', file);
        if (file) setIconPreview(URL.createObjectURL(file));
    };

    const submitSys = (e: FormEvent) => {
        e.preventDefault();
        sysForm.post(route('configuracoes.update-system'), {
            forceFormData: true,
            preserveScroll: true,
        });
    };

    return (
        <AuthenticatedLayout header={<h2>Configurações</h2>}>
            <Head title="Configurações" />

            <Tabs defaultValue="sistema" className="flex min-h-0 flex-1 flex-col overflow-hidden">

                {/* ── Tabs bar ── */}
                <div className="shrink-0 border-b border-accent/10 px-6 py-4">
                    <TabsList>
                        <TabsTrigger value="sistema" className="gap-1.5">
                            <Settings2 className="h-3.5 w-3.5" />
                            Sistema
                        </TabsTrigger>
                        <TabsTrigger value="integracoes" className="gap-1.5">
                            <PlugZap className="h-3.5 w-3.5" />
                            Integrações
                        </TabsTrigger>
                    </TabsList>
                </div>

                {/* ── Tab Sistema ── */}
                <TabsContent value="sistema" className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden">
                    <form onSubmit={submitSys} className="flex min-h-0 flex-1 flex-col">

                        <div className="scrollbar-thin flex-1 overflow-y-auto px-6 py-6">
                            <div className="space-y-5">
                                <div className="space-y-1.5">
                                    <Label htmlFor="app_name">Nome do sistema</Label>
                                    <Input
                                        id="app_name"
                                        value={sysForm.data.app_name}
                                        onChange={(e) => sysForm.setData('app_name', e.target.value)}
                                        placeholder="DigChat"
                                        maxLength={80}
                                    />
                                    <p className="text-xs text-ink/45">
                                        Aparece na sidebar e no título da aba do navegador.
                                    </p>
                                    {sysForm.errors.app_name && (
                                        <p className="text-sm text-red-300">{sysForm.errors.app_name}</p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label>Ícone do sistema</Label>
                                    <div className="flex items-center gap-4">
                                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-accent/25 bg-accent/10">
                                            {iconPreview ? (
                                                <img
                                                    src={iconPreview}
                                                    alt="Ícone"
                                                    className="h-9 w-9 rounded object-contain"
                                                />
                                            ) : (
                                                <ImageIcon className="h-6 w-6 text-ink/25" />
                                            )}
                                        </div>
                                        <div className="flex-1 space-y-1.5">
                                            <button
                                                type="button"
                                                onClick={() => fileRef.current?.click()}
                                                className="flex items-center gap-2 rounded-lg border border-ink/[0.12] bg-ink/[0.04] px-3 py-1.5 text-sm text-ink/70 transition hover:border-accent/35 hover:bg-accent/10 hover:text-ink"
                                            >
                                                <Upload className="h-3.5 w-3.5" />
                                                {iconPreview ? 'Trocar imagem' : 'Escolher imagem'}
                                            </button>
                                            <p className="text-xs text-ink/45">
                                                PNG, JPG, SVG ou WebP. Aparece na sidebar e como favicon.
                                            </p>
                                            {sysForm.errors.app_icon && (
                                                <p className="text-sm text-red-300">{sysForm.errors.app_icon}</p>
                                            )}
                                        </div>
                                    </div>
                                    <input
                                        ref={fileRef}
                                        type="file"
                                        accept="image/png,image/jpeg,image/svg+xml,image/webp"
                                        className="hidden"
                                        onChange={handleIconChange}
                                    />
                                </div>

                                <div className="flex items-start gap-3 rounded-lg border border-accent/10 bg-ink/[0.025] p-4">
                                    <Switch
                                        id="notify_customer_on_transfer"
                                        checked={sysForm.data.notify_customer_on_transfer}
                                        onCheckedChange={(checked) =>
                                            sysForm.setData('notify_customer_on_transfer', checked)
                                        }
                                    />
                                    <div className="space-y-1">
                                        <Label htmlFor="notify_customer_on_transfer">
                                            Avisar cliente ao transferir de setor
                                        </Label>
                                        <p className="text-xs text-ink/45">
                                            Envia uma mensagem no WhatsApp quando o atendimento é transferido para outro setor.
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-4 rounded-lg border border-accent/10 bg-ink/[0.025] p-4">
                                    <div className="flex items-start gap-3">
                                        <Switch
                                            id="auto_close_inactive_conversations_enabled"
                                            checked={sysForm.data.auto_close_inactive_conversations_enabled}
                                            onCheckedChange={(checked) =>
                                                sysForm.setData('auto_close_inactive_conversations_enabled', checked)
                                            }
                                        />
                                        <div className="space-y-1">
                                            <Label htmlFor="auto_close_inactive_conversations_enabled">
                                                Encerrar chamado por inatividade do cliente
                                            </Label>
                                            <p className="text-xs text-ink/45">
                                                Fecha automaticamente atendimentos abertos quando a última mensagem foi enviada pelo atendente e o cliente não respondeu dentro do prazo.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="grid gap-2 sm:max-w-xs">
                                        <Label htmlFor="auto_close_inactive_conversations_minutes">
                                            Tempo de inatividade em minutos
                                        </Label>
                                        <Input
                                            id="auto_close_inactive_conversations_minutes"
                                            type="number"
                                            min={1}
                                            max={10080}
                                            step={1}
                                            value={sysForm.data.auto_close_inactive_conversations_minutes}
                                            disabled={!sysForm.data.auto_close_inactive_conversations_enabled}
                                            onChange={(e) => {
                                                const value = e.target.valueAsNumber;
                                                sysForm.setData(
                                                    'auto_close_inactive_conversations_minutes',
                                                    Number.isFinite(value) ? value : 1,
                                                );
                                            }}
                                        />
                                        {sysForm.errors.auto_close_inactive_conversations_minutes && (
                                            <p className="text-sm text-red-300">
                                                {sysForm.errors.auto_close_inactive_conversations_minutes}
                                            </p>
                                        )}
                                    </div>

                                    <div className="flex items-start gap-3 border-t border-accent/10 pt-3">
                                        <Switch
                                            id="survey_on_inactivity_close_enabled"
                                            checked={sysForm.data.survey_on_inactivity_close_enabled}
                                            disabled={!sysForm.data.auto_close_inactive_conversations_enabled}
                                            onCheckedChange={(checked) =>
                                                sysForm.setData('survey_on_inactivity_close_enabled', checked)
                                            }
                                        />
                                        <div className="space-y-1">
                                            <Label htmlFor="survey_on_inactivity_close_enabled">
                                                Enviar pesquisa de satisfação ao encerrar por inatividade
                                            </Label>
                                            <p className="text-xs text-ink/45">
                                                Usa a mesma pesquisa configurada na seção abaixo. Só funciona se uma pesquisa estiver ativa e selecionada.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                               {/* ── Survey on close ── */}
                               <div className="space-y-4 rounded-lg border border-accent/10 bg-ink/[0.025] p-4">
                                   <div className="flex items-start gap-3">
                                       <Switch
                                           id="survey_on_close_enabled"
                                           checked={sysForm.data.survey_on_close_enabled}
                                           onCheckedChange={(checked) =>
                                               sysForm.setData('survey_on_close_enabled', checked)
                                           }
                                       />
                                       <div className="space-y-1">
                                           <Label htmlFor="survey_on_close_enabled" className="flex items-center gap-2">
                                               <MessageSquare className="h-3.5 w-3.5 text-accent" />
                                               Enviar pesquisa ao encerrar atendimento
                                           </Label>
                                           <p className="text-xs text-ink/45">
                                               Envia automaticamente um link de pesquisa de satisfação via WhatsApp quando um atendimento é encerrado.
                                           </p>
                                       </div>
                                   </div>

                                   <div className="grid gap-2 sm:max-w-sm">
                                       <Label htmlFor="survey_on_close_survey_id" className="text-xs">
                                           Pesquisa a enviar
                                       </Label>
                                       <Select
                                           value={sysForm.data.survey_on_close_survey_id || '_none'}
                                           disabled={!sysForm.data.survey_on_close_enabled}
                                           onValueChange={(v) =>
                                               sysForm.setData('survey_on_close_survey_id', v === '_none' ? '' : v)
                                           }
                                       >
                                           <SelectTrigger id="survey_on_close_survey_id" className="text-sm">
                                               <SelectValue placeholder="Selecione uma pesquisa ativa…" />
                                           </SelectTrigger>
                                           <SelectContent>
                                               <SelectItem value="_none">
                                                   <span className="text-ink/45">— Nenhuma —</span>
                                               </SelectItem>
                                               {surveys.map((s) => (
                                                   <SelectItem key={s.id} value={String(s.id)}>
                                                       {s.name}
                                                   </SelectItem>
                                               ))}
                                           </SelectContent>
                                       </Select>
                                       {surveys.length === 0 && (
                                           <p className="text-xs text-ink/40">
                                               Nenhuma pesquisa ativa. Crie uma em{' '}
                                               <a href={route('pesquisas.index')} className="text-accent underline-offset-2 hover:underline">
                                                   Pesquisas
                                               </a>.
                                           </p>
                                       )}
                                   </div>
                               </div>

                            </div>
                        </div>

                        <div className="shrink-0 border-t border-accent/10 px-6 py-4">
                            <div className="flex justify-end">
                                <Button type="submit" disabled={sysForm.processing}>
                                    <Save className="h-4 w-4" />
                                    Salvar configurações
                                </Button>
                            </div>
                        </div>

                    </form>
                </TabsContent>

                {/* ── Tab Integrações ── */}
                <TabsContent value="integracoes" className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden">
                    <div className="scrollbar-thin flex-1 overflow-y-auto px-6 py-6">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-sm font-semibold text-ink/80">Integrações externas</h3>
                                    <p className="mt-0.5 text-xs text-ink/45">Conecte sistemas ERP como o IXC Provedor.</p>
                                </div>
                                <Button size="sm" onClick={openNewIntegration}>
                                    <Plus className="h-3.5 w-3.5" />
                                    Nova integração
                                </Button>
                            </div>

                            {integrations.length === 0 ? (
                                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-ink/20 py-12 text-center">
                                    <PlugZap className="mb-3 h-8 w-8 text-ink/20" />
                                    <p className="text-sm text-ink/40">Nenhuma integração configurada ainda.</p>
                                    <Button size="sm" variant="outline" className="mt-4" onClick={openNewIntegration}>
                                        Adicionar IXC Provedor
                                    </Button>
                                </div>
                            ) : (
                                <ul className="space-y-2">
                                    {integrations.map((cfg) => (
                                        <li
                                            key={cfg.id}
                                            className="flex items-center gap-3 rounded-xl border border-ink/[0.08] bg-ink/[0.02] px-4 py-3"
                                        >
                                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                                                <Building2 className="h-4 w-4" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-medium text-ink/80">{cfg.name}</span>
                                                    <Badge variant={cfg.is_active ? 'default' : 'secondary'} className="text-[10px]">
                                                        {cfg.is_active ? 'Ativo' : 'Inativo'}
                                                    </Badge>
                                                    <span className="rounded bg-ink/[0.06] px-1.5 py-0.5 text-[10px] font-mono text-ink/50 uppercase">
                                                        {cfg.type}
                                                    </span>
                                                </div>
                                                <div className="mt-0.5 truncate text-xs text-ink/40">{cfg.base_url}</div>
                                            </div>
                                            <div className="flex shrink-0 items-center gap-1">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    disabled={testingId === cfg.id}
                                                    onClick={() => testIntegration(cfg)}
                                                    className="h-7 gap-1 px-2 text-xs"
                                                >
                                                    {testingId === cfg.id ? (
                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                    ) : (
                                                        <Wifi className="h-3 w-3" />
                                                    )}
                                                    Testar
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => openEditIntegration(cfg)}
                                                    className="h-7 w-7 p-0"
                                                >
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => deleteIntegration(cfg)}
                                                    className="h-7 w-7 p-0 text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                </TabsContent>

            </Tabs>

            {/* Dialog: criar / editar integração */}
            <Dialog
                open={integrationDialog.open}
                onOpenChange={(open) => setIntegrationDialog((s) => ({ ...s, open }))}
            >
                <DialogContent className="gap-5 p-5 sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {integrationDialog.editing ? 'Editar integração' : 'Nova integração'}
                        </DialogTitle>
                    </DialogHeader>

                    <form onSubmit={submitIntegration} className="space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="int_name">Nome</Label>
                            <Input
                                id="int_name"
                                value={integrationForm.data.name}
                                onChange={(e) => integrationForm.setData('name', e.target.value)}
                                placeholder="Ex: IXC Produção"
                            />
                            {integrationForm.errors.name && (
                                <p className="text-sm text-red-400">{integrationForm.errors.name}</p>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="int_base_url">URL base da API</Label>
                            <Input
                                id="int_base_url"
                                value={integrationForm.data.base_url}
                                onChange={(e) => integrationForm.setData('base_url', e.target.value)}
                                placeholder="https://erp.suaempresa.com.br"
                                className="font-mono text-sm"
                            />
                            {integrationForm.errors.base_url && (
                                <p className="text-sm text-red-400">{integrationForm.errors.base_url}</p>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="int_token">
                                Token da API
                                {integrationDialog.editing && (
                                    <span className="ml-1 text-xs font-normal text-ink/40">(deixe em branco para manter)</span>
                                )}
                            </Label>
                            <SecretInput
                                id="int_token"
                                value={integrationForm.data.token}
                                onChange={(v) => integrationForm.setData('token', v)}
                                placeholder={integrationDialog.editing ? '••••••••' : 'Cole o token gerado no IXC'}
                            />
                            <p className="text-xs text-ink/40">
                                Cole o token exatamente como aparece no painel do IXC — sem converter para base64 manualmente.
                            </p>
                            {integrationForm.errors.token && (
                                <p className="text-sm text-red-400">{integrationForm.errors.token}</p>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            <Switch
                                id="int_active"
                                checked={integrationForm.data.is_active}
                                onCheckedChange={(v) => integrationForm.setData('is_active', v)}
                            />
                            <Label htmlFor="int_active">Ativo</Label>
                        </div>

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIntegrationDialog({ open: false, editing: null })}
                            >
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={integrationForm.processing}>
                                {integrationForm.processing ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Save className="h-4 w-4" />
                                )}
                                {integrationDialog.editing ? 'Salvar' : 'Criar'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </AuthenticatedLayout>
    );
}
