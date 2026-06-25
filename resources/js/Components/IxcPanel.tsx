import { Dialog, DialogContent } from '@/Components/ui/dialog';
import { Input } from '@/Components/ui/input';
import axios from 'axios';
import {
    ArrowDownToLine,
    ArrowUpFromLine,
    Building2,
    ChevronRight,
    Eye,
    EyeOff,
    FileText,
    Loader2,
    Network,
    QrCode,
    Receipt,
    RefreshCw,
    Search,
    Send,
    Unlink,
    Wifi,
    WifiOff,
    X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface IxcContact {
    id: number | null;
    ixc_customer_id: string | null;
    ixc_customer_name: string | null;
}

interface IxcSearchResult {
    id: string;
    razao: string;
    fantasia: string;
    cnpj_cpf: string;
}

interface Contract {
    id: string;
    login: string;
    status_contrato: string;
    tipo: string;
    plano: string;
    online: boolean;
    ip: string | null;
    since: string | null;
}

interface ConnectionData {
    online: boolean;
    ip: string;
    concentrador: string;
    tipo_conexao: string;
    login: string;
    senha: string;
    inicio: string | null;
    fim: string | null;
    upload: string | null;
    download: string | null;
}

interface Invoice {
    id: string;
    valor: string | null;
    data_vencimento: string | null;
    baixa_data: string | null;
    status: string;
}

interface ContractDetails {
    connection: ConnectionData | null;
    invoices: Invoice[];
}

interface Props {
    contact: IxcContact;
    conversationId: number;
    onClose: () => void;
    onLinked: (ixcCustomerId: string, ixcCustomerName: string) => void;
    onUnlinked: () => void;
}

function formatDate(dt: string | null): string {
    if (!dt) return '—';
    try {
        return new Date(dt).toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return dt;
    }
}

function formatDateShort(dt: string | null): string {
    if (!dt) return '—';
    try {
        return new Date(dt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
    } catch {
        return dt;
    }
}

function isOverdue(dataVencimento: string | null): boolean {
    if (!dataVencimento) return false;
    try { return new Date(dataVencimento) < new Date(); } catch { return false; }
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between gap-4">
            <dt className="shrink-0 text-ink/40">{label}</dt>
            <dd className="text-right text-ink/70">{value}</dd>
        </div>
    );
}

export default function IxcPanel({ contact, conversationId, onClose, onLinked, onUnlinked }: Props) {
    const [query, setQuery]                       = useState('');
    const [searchResults, setSearchResults]       = useState<IxcSearchResult[]>([]);
    const [searching, setSearching]               = useState(false);
    const [contracts, setContracts]               = useState<Contract[]>([]);
    const [loadingContracts, setLoadingContracts] = useState(false);
    const [linking, setLinking]                   = useState(false);
    const [unlinking, setUnlinking]               = useState(false);
    const [contractsError, setContractsError]     = useState<string | null>(null);
    const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Modal
    const [detailsOpen, setDetailsOpen]               = useState(false);
    const [selectedContract, setSelectedContract]     = useState<Contract | null>(null);
    const [details, setDetails]                       = useState<ContractDetails | null>(null);
    const [loadingDetails, setLoadingDetails]         = useState(false);
    const [showSenha, setShowSenha]                   = useState(false);
    const [sendingBoleto, setSendingBoleto]           = useState<string | null>(null);
    const [boletoFeedback, setBoletoFeedback]         = useState<{ id: string; ok: boolean; msg: string } | null>(null);
    const [sendingPix, setSendingPix]                 = useState<string | null>(null);
    const [pixFeedback, setPixFeedback]               = useState<{ id: string; ok: boolean; msg: string } | null>(null);

    const isLinked = Boolean(contact.ixc_customer_id);

    const loadContracts = useCallback(() => {
        if (!contact.id || !contact.ixc_customer_id) return;
        setLoadingContracts(true);
        setContractsError(null);
        axios
            .get(route('ixc.contacts.contracts', contact.id))
            .then((res) => setContracts(res.data))
            .catch((err) => {
                setContractsError(err.response?.data?.error ?? 'Erro ao carregar contratos.');
            })
            .finally(() => setLoadingContracts(false));
    }, [contact.id, contact.ixc_customer_id]);

    useEffect(() => {
        if (isLinked) {
            loadContracts();
        } else {
            setContracts([]);
            setContractsError(null);
        }
    }, [isLinked, loadContracts]);

    const handleSendBoleto = (inv: Invoice) => {
        setSendingBoleto(inv.id);
        setBoletoFeedback(null);
        axios
            .post(route('ixc.conversations.send-boleto', conversationId), {
                invoice_id: inv.id,
                contract_id: selectedContract?.id ?? null,
                data_vencimento: inv.data_vencimento ?? null,
            })
            .then(() => setBoletoFeedback({ id: inv.id, ok: true, msg: 'Boleto enviado!' }))
            .catch((err) =>
                setBoletoFeedback({
                    id: inv.id,
                    ok: false,
                    msg: err.response?.data?.error ?? 'Erro ao enviar boleto.',
                }),
            )
            .finally(() => setSendingBoleto(null));
    };

    const handleSendPix = (inv: Invoice) => {
        setSendingPix(inv.id);
        setPixFeedback(null);
        axios
            .post(route('ixc.conversations.send-pix', conversationId), {
                invoice_id: inv.id,
                contract_id: selectedContract?.id ?? null,
                data_vencimento: inv.data_vencimento ?? null,
            })
            .then(() => setPixFeedback({ id: inv.id, ok: true, msg: 'PIX + QR Code enviados!' }))
            .catch((err) =>
                setPixFeedback({
                    id: inv.id,
                    ok: false,
                    msg: err.response?.data?.error ?? 'Erro ao enviar PIX.',
                }),
            )
            .finally(() => setSendingPix(null));
    };

    const openContractDetails = (c: Contract) => {
        setSelectedContract(c);
        setDetails(null);
        setDetailsOpen(true);
        setShowSenha(false);
        setLoadingDetails(true);
        axios
            .get(route('ixc.contracts.details', { contact: contact.id, contractId: c.id }))
            .then((res) => setDetails(res.data))
            .catch(() => setDetails({ connection: null, invoices: [] }))
            .finally(() => setLoadingDetails(false));
    };

    const handleSearch = (value: string) => {
        setQuery(value);
        if (searchTimer.current) clearTimeout(searchTimer.current);
        if (value.trim().length < 2) {
            setSearchResults([]);
            return;
        }
        searchTimer.current = setTimeout(() => {
            setSearching(true);
            axios
                .get(route('ixc.search'), { params: { q: value } })
                .then((res) => setSearchResults(res.data))
                .catch(() => setSearchResults([]))
                .finally(() => setSearching(false));
        }, 400);
    };

    const handleLink = (result: IxcSearchResult) => {
        if (!contact.id) return;
        setLinking(true);
        axios
            .post(route('ixc.contacts.link', contact.id), {
                ixc_customer_id:   result.id,
                ixc_customer_name: result.razao,
            })
            .then(() => {
                onLinked(result.id, result.razao);
                setQuery('');
                setSearchResults([]);
            })
            .catch(() => {})
            .finally(() => setLinking(false));
    };

    const handleUnlink = () => {
        if (!contact.id) return;
        setUnlinking(true);
        axios
            .delete(route('ixc.contacts.unlink', contact.id))
            .then(() => {
                onUnlinked();
                setContracts([]);
            })
            .catch(() => {})
            .finally(() => setUnlinking(false));
    };

    const initials = (name: string | null) =>
        (name ?? '?')
            .split(' ')
            .filter(Boolean)
            .slice(0, 2)
            .map((w) => w[0])
            .join('')
            .toUpperCase();

    return (
        <>
            <div className="flex h-full w-72 shrink-0 flex-col border-l border-ink/[0.08] bg-canvas">
                {/* Header */}
                <div className="flex h-16 items-center justify-between border-b border-ink/[0.08] px-4">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <p className="text-sm font-semibold text-ink/90 leading-none">Menu lateral</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="shrink-0 rounded-lg p-1.5 text-ink/40 transition-colors hover:bg-ink/[0.06] hover:text-ink/70"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>

                <div className="scrollbar-thin flex-1 overflow-y-auto">
                    {!isLinked ? (
                        /* ── Busca para vincular ── */
                        <div className="p-4 space-y-3">
                            <p className="text-xs text-ink/45 leading-relaxed">
                                Pesquise o cliente no IXC para vincular a esta conversa.
                            </p>
                            <div className="relative">
                                {searching ? (
                                    <Loader2 className="absolute left-3 top-2.5 h-3.5 w-3.5 animate-spin text-ink/35" />
                                ) : (
                                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-ink/35" />
                                )}
                                <Input
                                    placeholder="Nome do cliente..."
                                    value={query}
                                    onChange={(e) => handleSearch(e.target.value)}
                                    className="pl-9 text-sm"
                                />
                            </div>

                            {!searching && searchResults.length > 0 && (
                                <ul className="space-y-1.5">
                                    {searchResults.map((r) => (
                                        <li key={r.id}>
                                            <button
                                                type="button"
                                                disabled={linking}
                                                onClick={() => handleLink(r)}
                                                className="w-full rounded-xl border border-ink/[0.08] px-3 py-2.5 text-left transition-colors hover:border-accent/25 hover:bg-accent/[0.04] disabled:opacity-50"
                                            >
                                                <div className="truncate text-sm font-medium text-ink/85">{r.razao}</div>
                                                {r.fantasia && r.fantasia !== r.razao && (
                                                    <div className="truncate text-xs text-ink/45">{r.fantasia}</div>
                                                )}
                                                {r.cnpj_cpf && (
                                                    <div className="mt-0.5 font-mono text-[11px] text-ink/35">{r.cnpj_cpf}</div>
                                                )}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}

                            {!searching && query.trim().length >= 2 && searchResults.length === 0 && (
                                <p className="text-xs text-ink/40">Nenhum cliente encontrado.</p>
                            )}
                        </div>
                    ) : (
                        /* ── Cliente vinculado + contratos ── */
                        <div className="space-y-4 p-4">
                            {/* Card do cliente */}
                            <div className="rounded-xl border border-emerald-200/60 bg-emerald-50/50 p-3 dark:border-emerald-900/30 dark:bg-emerald-950/10">
                                <div className="flex items-center gap-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="truncate text-xs font-semibold text-ink/85">
                                            {contact.ixc_customer_name}
                                        </div>
                                        <div className="text-[10px] text-ink/40">ID #{contact.ixc_customer_id}</div>
                                    </div>
                                    <button
                                        type="button"
                                        disabled={unlinking}
                                        onClick={handleUnlink}
                                        title="Desvincular"
                                        className="shrink-0 rounded-lg p-1.5 text-ink/30 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50 dark:hover:bg-red-950/30"
                                    >
                                        {unlinking ? (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                            <Unlink className="h-3.5 w-3.5" />
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Contratos */}
                            <div>
                                <div className="mb-2.5 flex items-center justify-between">
                                    <span className="text-[11px] font-semibold uppercase tracking-widest text-ink/35">
                                        Contratos
                                    </span>
                                    <button
                                        type="button"
                                        onClick={loadContracts}
                                        disabled={loadingContracts}
                                        title="Atualizar"
                                        className="rounded-lg p-1 text-ink/35 transition-colors hover:bg-ink/[0.06] hover:text-accent disabled:opacity-40"
                                    >
                                        {loadingContracts ? (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                            <RefreshCw className="h-3.5 w-3.5" />
                                        )}
                                    </button>
                                </div>

                                {contractsError && (
                                    <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-950/20 dark:text-red-400">
                                        {contractsError}
                                    </p>
                                )}

                                {!loadingContracts && !contractsError && contracts.length === 0 && (
                                    <p className="text-xs text-ink/40">Nenhum contrato encontrado.</p>
                                )}

                                {loadingContracts && (
                                    <div className="space-y-2">
                                        {[1, 2].map((i) => (
                                            <div key={i} className="h-16 animate-pulse rounded-xl bg-ink/[0.04]" />
                                        ))}
                                    </div>
                                )}

                                {!loadingContracts && (
                                    <div className="space-y-2">
                                        {contracts.map((c) => (
                                            <button
                                                key={c.id}
                                                type="button"
                                                onClick={() => openContractDetails(c)}
                                                className="group w-full overflow-hidden rounded-xl border border-ink/[0.08] text-left transition-all hover:border-ink/[0.15] hover:shadow-sm"
                                            >
                                                {/* Colored top accent */}
                                                <div className={`h-0.5 w-full ${c.online ? 'bg-emerald-400' : 'bg-ink/10'}`} />

                                                <div className="p-3">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-xs font-semibold text-ink/80">
                                                                    #{c.id}
                                                                </span>
                                                                {c.login && (
                                                                    <span className="truncate font-mono text-[11px] text-ink/40">
                                                                        {c.login}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {c.plano && (
                                                                <div className="mt-0.5 truncate text-[11px] text-ink/45">{c.plano}</div>
                                                            )}
                                                        </div>
                                                        <div className="flex shrink-0 items-center gap-1.5">
                                                            <span
                                                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                                                    c.online
                                                                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                                                                        : 'bg-ink/[0.05] text-ink/40'
                                                                }`}
                                                            >
                                                                {c.online ? (
                                                                    <Wifi className="h-2.5 w-2.5" />
                                                                ) : (
                                                                    <WifiOff className="h-2.5 w-2.5" />
                                                                )}
                                                                {c.online ? 'Online' : 'Offline'}
                                                            </span>
                                                            <ChevronRight className="h-3.5 w-3.5 text-ink/25 transition-transform group-hover:translate-x-0.5" />
                                                        </div>
                                                    </div>

                                                    {c.online && c.ip && (
                                                        <div className="mt-2 flex items-center gap-1.5">
                                                            <span className="rounded bg-ink/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-ink/50">
                                                                {c.ip}
                                                            </span>
                                                            {c.since && (
                                                                <span className="text-[10px] text-ink/35">
                                                                    desde {formatDate(c.since)}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Modal de detalhes do contrato ── */}
            <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
                <DialogContent className="max-w-sm gap-0 overflow-hidden p-0">
                    {/* Header */}
                    <div className="border-b border-ink/[0.08] px-5 pb-4 pt-5 pr-12">
                        <div className="mb-2 flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-ink/40" />
                            <span className="text-base font-medium text-ink/90">
                                Contrato #{selectedContract?.id}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span
                                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                                    selectedContract?.online
                                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                                        : 'bg-ink/[0.06] text-ink/50'
                                }`}
                            >
                                <span
                                    className={`h-1.5 w-1.5 rounded-full ${selectedContract?.online ? 'bg-emerald-500' : 'bg-ink/30'}`}
                                />
                                {selectedContract?.online ? 'Online' : 'Offline'}
                            </span>
                            {selectedContract?.login && (
                                <span className="font-mono text-xs text-ink/40">
                                    {selectedContract.login}
                                </span>
                            )}
                        </div>
                    </div>

                    {loadingDetails ? (
                        <div className="flex items-center justify-center py-12 text-ink/30">
                            <Loader2 className="h-5 w-5 animate-spin" />
                        </div>
                    ) : (
                        <div className="max-h-[70vh] overflow-y-auto">
                            <div className="space-y-5 p-5">
                                {/* Conexão */}
                                <section>
                                    <h3 className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-ink/35">
                                        <Network className="h-3.5 w-3.5" />
                                        Dados da conexão
                                    </h3>
                                    {details?.connection ? (
                                        <div className="overflow-hidden rounded-xl border border-ink/[0.08]">
                                            {/* Status bar */}
                                            <div
                                                className={`flex items-center gap-2 border-b px-4 py-2.5 text-xs font-medium ${
                                                    details.connection.online
                                                        ? 'border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-400'
                                                        : 'border-ink/[0.06] bg-ink/[0.02] text-ink/50'
                                                }`}
                                            >
                                                {details.connection.online ? (
                                                    <Wifi className="h-3.5 w-3.5" />
                                                ) : (
                                                    <WifiOff className="h-3.5 w-3.5" />
                                                )}
                                                {details.connection.online && details.connection.inicio
                                                    ? `Conectado desde ${formatDate(details.connection.inicio)}`
                                                    : !details.connection.online && details.connection.inicio
                                                      ? `Última conexão ${formatDate(details.connection.inicio)}`
                                                      : details.connection.online
                                                        ? 'Online'
                                                        : 'Offline'}
                                            </div>

                                            {/* Data rows */}
                                            <div className="divide-y divide-ink/[0.05]">
                                                {details.connection.login && (
                                                    <div className="flex items-center justify-between px-4 py-2.5 text-xs">
                                                        <span className="text-ink/45">Usuário PPPoE</span>
                                                        <span className="font-mono font-medium text-ink/80">{details.connection.login}</span>
                                                    </div>
                                                )}
                                                {details.connection.senha && (
                                                    <div className="flex items-center justify-between px-4 py-2.5 text-xs">
                                                        <span className="text-ink/45">Senha PPPoE</span>
                                                        <span className="flex items-center gap-1.5">
                                                            <span className="font-mono font-medium text-ink/80">
                                                                {showSenha ? details.connection.senha : '••••••••'}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => setShowSenha((v) => !v)}
                                                                className="text-ink/30 hover:text-ink/60"
                                                            >
                                                                {showSenha ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                                            </button>
                                                        </span>
                                                    </div>
                                                )}
                                                {details.connection.ip && (
                                                    <div className="flex items-center justify-between px-4 py-2.5 text-xs">
                                                        <span className="text-ink/45">IP</span>
                                                        <span className="font-mono font-medium text-ink/80">{details.connection.ip}</span>
                                                    </div>
                                                )}
                                                {details.connection.concentrador && (
                                                    <div className="flex items-center justify-between px-4 py-2.5 text-xs">
                                                        <span className="text-ink/45">Concentrador</span>
                                                        <span className="font-medium text-ink/70">{details.connection.concentrador}</span>
                                                    </div>
                                                )}
                                                {!details.connection.online && details.connection.fim && (
                                                    <div className="flex items-center justify-between px-4 py-2.5 text-xs">
                                                        <span className="text-ink/45">Desconectado em</span>
                                                        <span className="font-medium text-ink/70">{formatDate(details.connection.fim)}</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Download / Upload */}
                                            {(details.connection.download || details.connection.upload) && (
                                                <div className="border-t border-ink/[0.06] bg-ink/[0.01] p-3 space-y-2">
                                                    <p className="text-[10px] text-ink/35">
                                                        Consumo da sessão
                                                        {details.connection.inicio
                                                            ? ` · desde ${formatDate(details.connection.inicio)}`
                                                            : ''}
                                                    </p>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {details.connection.download && (
                                                            <div className="flex items-center gap-2 rounded-lg bg-sky-100 px-3 py-2 dark:bg-sky-500/20">
                                                                <ArrowDownToLine className="h-3.5 w-3.5 shrink-0 text-sky-600 dark:text-sky-300" />
                                                                <div>
                                                                    <p className="text-xs font-semibold text-sky-800 dark:text-sky-200">{details.connection.download}</p>
                                                                    <p className="text-[10px] text-sky-600 dark:text-sky-400">Download</p>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {details.connection.upload && (
                                                            <div className="flex items-center gap-2 rounded-lg bg-violet-100 px-3 py-2 dark:bg-violet-500/20">
                                                                <ArrowUpFromLine className="h-3.5 w-3.5 shrink-0 text-violet-600 dark:text-violet-300" />
                                                                <div>
                                                                    <p className="text-xs font-semibold text-violet-800 dark:text-violet-200">{details.connection.upload}</p>
                                                                    <p className="text-[10px] text-violet-600 dark:text-violet-400">Upload</p>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-ink/40">Sem dados de conexão.</p>
                                    )}
                                </section>

                                {/* Boletos */}
                                <section>
                                    <h3 className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-ink/35">
                                        <Receipt className="h-3.5 w-3.5" />
                                        Boletos em aberto
                                    </h3>
                                    {details && details.invoices.length === 0 ? (
                                        <p className="text-xs text-ink/40">Nenhum boleto em aberto.</p>
                                    ) : (
                                        <ul className="space-y-1.5">
                                            {(details?.invoices ?? []).map((inv) => {
                                                const overdue      = isOverdue(inv.data_vencimento);
                                                const isSendingBol = sendingBoleto === inv.id;
                                                const isSendingPix = sendingPix === inv.id;
                                                const anyBusy      = sendingBoleto !== null || sendingPix !== null;
                                                const fbBol = boletoFeedback?.id === inv.id ? boletoFeedback : null;
                                                const fbPix = pixFeedback?.id === inv.id ? pixFeedback : null;
                                                return (
                                                    <li
                                                        key={inv.id}
                                                        className="overflow-hidden rounded-lg border border-ink/[0.08]"
                                                    >
                                                        {/* Amount + due date */}
                                                        <div className="flex items-center justify-between px-3 py-2">
                                                            <span className="text-sm font-semibold text-ink/85">
                                                                R${' '}
                                                                {Number(inv.valor ?? 0).toFixed(2).replace('.', ',')}
                                                            </span>
                                                            <span
                                                                className={`text-[11px] font-medium ${
                                                                    overdue
                                                                        ? 'text-red-500 dark:text-red-400'
                                                                        : 'text-ink/40'
                                                                }`}
                                                            >
                                                                {overdue ? 'Venceu' : 'Vence'}{' '}
                                                                {formatDateShort(inv.data_vencimento)}
                                                            </span>
                                                        </div>

                                                        {/* Action buttons */}
                                                        <div className="flex items-center gap-1.5 border-t border-ink/[0.06] px-3 py-1.5">
                                                            <button
                                                                type="button"
                                                                disabled={anyBusy}
                                                                onClick={() => handleSendPix(inv)}
                                                                title="Enviar PIX + QR Code na conversa"
                                                                className="flex items-center gap-1.5 rounded-md bg-emerald-500/[0.12] px-2.5 py-1 text-[11px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:text-emerald-400"
                                                            >
                                                                {isSendingPix ? (
                                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                                ) : (
                                                                    <QrCode className="h-3 w-3" />
                                                                )}
                                                                PIX
                                                            </button>
                                                            <button
                                                                type="button"
                                                                disabled={anyBusy}
                                                                onClick={() => handleSendBoleto(inv)}
                                                                title="Enviar 2ª via na conversa"
                                                                className="flex items-center gap-1.5 rounded-md bg-blue-500/[0.12] px-2.5 py-1 text-[11px] font-semibold text-blue-700 transition-colors hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:text-blue-400"
                                                            >
                                                                {isSendingBol ? (
                                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                                ) : (
                                                                    <FileText className="h-3 w-3" />
                                                                )}
                                                                2ª via
                                                            </button>
                                                        </div>

                                                        {/* Feedback */}
                                                        {(fbPix || fbBol) && (
                                                            <div className="border-t border-ink/[0.06] px-3 py-1.5">
                                                                {fbPix && (
                                                                    <p className={`text-[11px] ${fbPix.ok ? 'text-emerald-600' : 'text-red-500'}`}>
                                                                        {fbPix.msg}
                                                                    </p>
                                                                )}
                                                                {fbBol && (
                                                                    <p className={`text-[11px] ${fbBol.ok ? 'text-emerald-600' : 'text-red-500'}`}>
                                                                        {fbBol.msg}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        )}
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    )}
                                </section>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
