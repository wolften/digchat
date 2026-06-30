import { Dialog, DialogContent, DialogTitle } from '@/Components/ui/dialog';

const TIPO_SERVICO_LABEL: Record<string, string> = {
    I:    'Internet',
    T:    'Telefonia',
    S:    'Serviços',
    M:    'Mercadoria',
    SVA:  'SVA',
    TV:   'TV/Streaming',
    MVNO: 'MVNO/Telefonia Móvel',
};
import { Input } from '@/Components/ui/input';
import axios from 'axios';
import {
    ArrowDownToLine,
    ArrowUpFromLine,
    BarChart3,
    Building2,
    ChevronRight,
    ClipboardList,
    Eye,
    EyeOff,
    FileText,
    Headphones,
    KeyRound,
    Loader2,
    Monitor,
    Network,
    Phone,
    QrCode,
    Receipt,
    RefreshCw,
    Search,
    Send,
    Smartphone,
    Sparkles,
    Unlink,
    Wifi,
    WifiOff,
    X,
    Zap,
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
    valor: string | null;
    velocidade_down: string | null;
    velocidade_up: string | null;
    data_ativacao: string | null;
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
    data_emissao: string | null;
    referencia: string;
    competencia: string | null;
    nosso_numero: string;
    parcela: string;
    valor_juros: string | null;
    valor_multa: string | null;
    valor_desconto: string | null;
    baixa_data: string | null;
    status: string;
}

interface ServicoAdicional {
    id: string;
    nome: string;
    tipo: string;
    status: string;
    valor: string | null;
}

interface CentralAssinante {
    login: string | null;
    senha: string | null;
}

interface Comodato {
    id: string;
    id_produto: string | null;
    descricao: string;
    qtde: number;
    qtde_devolvida: number;
    unidade: string | null;
    valor_unitario: string | null;
    valor_total: string | null;
    id_patrimonio: string | null;
    patrimonio: string;
    numero_serie: string | null;
    mac: string | null;
    data: string | null;
}

interface LinhaSip {
    id: string;
    numero: string | null;
    descricao: string | null;
    ativo: boolean;
    context: string | null;
    ipaddr: string | null;
    limite_chamada: string | null;
    created_at: string | null;
    data_cancelamento: string | null;
}

interface LinhaMvno {
    id: string;
    status_linha: string;
    telefone: string | null;
    simcard: string | null;
    esim: boolean;
    portabilidade: boolean;
    status_portabilidade: string | null;
    numero_temporario: string | null;
    operadora_origem: string | null;
    created_at: string | null;
}

interface Ticket {
    id: string;
    titulo: string;
    status: string;
    protocolo: string;
    data_criacao: string | null;
}

interface OrdemServico {
    id: string;
    assunto: string;
    status: string;
    mensagem: string;
    mensagem_resposta: string;
    data_abertura: string | null;
    data_previsao: string | null;
    data_fechamento: string | null;
    tecnico: string;
}

interface ContractDetails {
    connection: ConnectionData | null;
    invoices: Invoice[];
    comodatos: Comodato[];
    servicos: ServicoAdicional[];
    linhas_sip: LinhaSip[];
    linhas_mvno: LinhaMvno[];
    central_assinante: CentralAssinante | null;
    ordens: OrdemServico[];
    tickets: Ticket[];
}

interface ConsumoItem {
    data: string;
    consumo: number;
    upload: number;
}

interface Props {
    contact: IxcContact;
    conversationId: number;
    onClose: () => void;
    onLinked: (ixcCustomerId: string, ixcCustomerName: string) => void;
    onUnlinked: () => void;
}

const IXC_DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** IXC date-only fields (Y-m-d) must not go through `new Date(string)` — JS treats them as UTC midnight. */
function parseIxcDate(dt: string): Date | null {
    const dateOnly = dt.match(IXC_DATE_ONLY_RE);
    if (dateOnly) {
        const [, y, m, d] = dateOnly;
        return new Date(Number(y), Number(m) - 1, Number(d));
    }

    const parsed = new Date(dt);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(dt: string | null): string {
    if (!dt) return '—';
    const parsed = parseIxcDate(dt);
    if (!parsed) return dt;

    return parsed.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function formatDateShort(dt: string | null): string {
    if (!dt) return '—';
    const parsed = parseIxcDate(dt);
    if (!parsed) return dt;

    return parsed.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function formatBrPhone(raw: string | null): string {
    if (!raw) return '—';
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 11) return `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
    if (digits.length === 10) return `(${digits.slice(0,2)}) ${digits.slice(2,6)}-${digits.slice(6)}`;
    return raw;
}

function isOverdue(dataVencimento: string | null): boolean {
    if (!dataVencimento) return false;
    const due = parseIxcDate(dataVencimento);
    if (!due) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return due < today;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between gap-4">
            <dt className="shrink-0 text-ink/40">{label}</dt>
            <dd className="text-right text-ink/70">{value}</dd>
        </div>
    );
}

function fmtBytes(b: number): string {
    if (b >= 1_073_741_824) return (b / 1_073_741_824).toFixed(1) + ' GB';
    if (b >= 1_048_576) return Math.round(b / 1_048_576) + ' MB';
    if (b >= 1024) return Math.round(b / 1024) + ' KB';
    return b + ' B';
}

function fmtAxisBytes(b: number): string {
    if (b >= 1_073_741_824) return (b / 1_073_741_824).toFixed(b >= 10_737_418_240 ? 0 : 1) + 'G';
    if (b >= 1_048_576) return Math.round(b / 1_048_576) + 'M';
    if (b >= 1024) return Math.round(b / 1024) + 'K';
    return String(b);
}

const CONSUMO_CHART_HEIGHT = 156;

function ConsumoChart({ data, loading }: { data: ConsumoItem[]; loading: boolean }) {
    const [hovered, setHovered] = useState<number | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState(0);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const update = () => setContainerWidth(el.getBoundingClientRect().width);
        update();

        const ro = new ResizeObserver(() => update());
        ro.observe(el);
        return () => ro.disconnect();
    }, [data.length, loading]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8 text-ink/30">
                <Loader2 className="h-4 w-4 animate-spin" />
            </div>
        );
    }

    if (!data.length) {
        return <p className="text-xs text-ink/40">Sem dados de consumo.</p>;
    }

    const PL    = 42;
    const PR    = 8;
    const PT    = 8;
    const CH    = 78;
    const PB    = 22;
    const VB_H  = PT + CH + PB;
    const TIP_W = 108;
    const TIP_H = 48;

    const vbW = Math.max(
        containerWidth > 0 ? containerWidth * (VB_H / CONSUMO_CHART_HEIGHT) : 360,
        PL + PR + data.length * 6,
    );
    const plotW = vbW - PL - PR;
    const slotW = plotW / data.length;
    const barW  = Math.max(4, Math.min(12, slotW * 0.62));
    const step  = Math.max(1, Math.ceil(data.length / 6));

    const maxTotal = Math.max(...data.map((d) => d.consumo + d.upload), 1);

    const tip = hovered !== null ? data[hovered] : null;
    const tipSlotX = hovered !== null ? PL + hovered * slotW : 0;
    const tipBarX  = tipSlotX + (slotW - barW) / 2;
    const tipX = hovered !== null
        ? Math.max(PL, Math.min(vbW - PR - TIP_W, tipBarX + barW / 2 - TIP_W / 2))
        : 0;
    const tipTotalH = tip ? ((tip.consumo + tip.upload) / maxTotal) * CH : 0;
    const tipY = Math.max(PT, PT + CH - tipTotalH - TIP_H - 6);

    return (
        <div>
            <div
                ref={containerRef}
                className="w-full"
                style={{ height: CONSUMO_CHART_HEIGHT }}
            >
                <svg
                    viewBox={`0 0 ${vbW} ${VB_H}`}
                    width="100%"
                    height={CONSUMO_CHART_HEIGHT}
                    className="block"
                >
                    {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
                        const y = PT + CH - frac * CH;
                        return (
                            <g key={frac}>
                                <line
                                    x1={PL} y1={y} x2={vbW - PR} y2={y}
                                    stroke="currentColor"
                                    strokeOpacity={frac === 0 ? 0.12 : 0.05}
                                    strokeWidth={0.8}
                                />
                                <text
                                    x={PL - 6} y={y + 4}
                                    fontSize={9} textAnchor="end"
                                    fill="currentColor" fillOpacity={0.4}
                                >
                                    {frac === 0 ? '0' : fmtAxisBytes(frac * maxTotal)}
                                </text>
                            </g>
                        );
                    })}

                    {data.map((d, i) => {
                        const slotX      = PL + i * slotW;
                        const x          = slotX + (slotW - barW) / 2;
                        const dlH        = (d.consumo / maxTotal) * CH;
                        const ulH        = (d.upload / maxTotal) * CH;
                        const isHov      = hovered === i;
                        const showLabel  = i === 0 || i === data.length - 1 || i % step === 0;

                        return (
                            <g
                                key={d.data}
                                onMouseEnter={() => setHovered(i)}
                                onMouseLeave={() => setHovered(null)}
                                style={{ cursor: 'default' }}
                            >
                                <rect
                                    x={slotX} y={PT}
                                    width={slotW} height={CH}
                                    fill="transparent"
                                />

                                {dlH > 0 && (
                                    <rect
                                        x={x} y={PT + CH - dlH}
                                        width={barW} height={dlH}
                                        rx={2}
                                        fill="#0ea5e9"
                                        fillOpacity={isHov ? 1 : 0.8}
                                    />
                                )}
                                {ulH > 0 && (
                                    <rect
                                        x={x} y={PT + CH - dlH - ulH}
                                        width={barW} height={ulH}
                                        rx={2}
                                        fill="#8b5cf6"
                                        fillOpacity={isHov ? 1 : 0.8}
                                    />
                                )}
                                {showLabel && (
                                    <text
                                        x={slotX + slotW / 2} y={PT + CH + 14}
                                        fontSize={8} textAnchor="middle"
                                        fill="currentColor" fillOpacity={isHov ? 0.75 : 0.45}
                                    >
                                        {d.data.slice(8, 10)}/{d.data.slice(5, 7)}
                                    </text>
                                )}
                            </g>
                        );
                    })}

                    {tip && (
                        <g style={{ pointerEvents: 'none' }}>
                            <rect
                                x={tipX} y={tipY}
                                width={TIP_W} height={TIP_H}
                                rx={4}
                                fill="#0f172a" fillOpacity={0.9}
                            />
                            <text x={tipX + 8} y={tipY + 13} fontSize={8} fill="white" fillOpacity={0.55}>
                                {tip.data.slice(8, 10)}/{tip.data.slice(5, 7)}/{tip.data.slice(0, 4)}
                            </text>
                            <text x={tipX + 8} y={tipY + 28} fontSize={9} fill="#38bdf8">
                                ↓ {fmtBytes(tip.consumo)}
                            </text>
                            <text x={tipX + 8} y={tipY + 41} fontSize={9} fill="#a78bfa">
                                ↑ {fmtBytes(tip.upload)}
                            </text>
                        </g>
                    )}
                </svg>
            </div>

            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: 'rgba(14,165,233,0.8)' }} />
                    <span className="text-xs text-ink/45">Download</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: 'rgba(139,92,246,0.8)' }} />
                    <span className="text-xs text-ink/45">Upload</span>
                </div>
                <span className="text-xs text-ink/35 sm:ml-auto">
                    Total: {fmtBytes(data.reduce((s, d) => s + d.consumo, 0))} ↓ · {fmtBytes(data.reduce((s, d) => s + d.upload, 0))} ↑
                </span>
            </div>
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
    const [showSenhaCentral, setShowSenhaCentral]     = useState(false);
    const [activeTab, setActiveTab]                   = useState<'conexao' | 'servicos' | 'equipamentos' | 'financeiro' | 'os' | 'atendimentos'>('conexao');
    const [sendingBoleto, setSendingBoleto]           = useState<string | null>(null);
    const [boletoFeedback, setBoletoFeedback]         = useState<{ id: string; ok: boolean; msg: string } | null>(null);
    const [sendingPix, setSendingPix]                 = useState<string | null>(null);
    const [pixFeedback, setPixFeedback]               = useState<{ id: string; ok: boolean; msg: string } | null>(null);
    const [consumo, setConsumo]                       = useState<ConsumoItem[]>([]);
    const [loadingConsumo, setLoadingConsumo]         = useState(false);

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
        setShowSenhaCentral(false);
        setActiveTab('conexao');
        setLoadingDetails(true);
        setConsumo([]);
        setLoadingConsumo(true);
        axios
            .get(route('ixc.contracts.details', { contact: contact.id, contractId: c.id }))
            .then((res) => setDetails(res.data))
            .catch(() => setDetails({ connection: null, invoices: [], comodatos: [], servicos: [], linhas_sip: [], linhas_mvno: [], central_assinante: null, ordens: [], tickets: [] }))
            .finally(() => setLoadingDetails(false));
        axios
            .get(route('ixc.contracts.consumo', { contact: contact.id, contractId: c.id }))
            .then((res) => setConsumo(res.data))
            .catch(() => setConsumo([]))
            .finally(() => setLoadingConsumo(false));
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
                ixc_document:      result.cnpj_cpf,
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
            <div className="flex h-full w-72 shrink-0 flex-col border-l border-ink/[0.08]">
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
                <DialogContent aria-describedby={undefined} className="max-w-5xl gap-0 overflow-hidden p-0">
                    {/* Status accent stripe */}
                    <div
                        className={`h-1 w-full ${
                            selectedContract?.online
                                ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                                : 'bg-gradient-to-r from-ink/20 to-ink/10'
                        }`}
                    />

                    {/* Header */}
                    <div className="px-5 pb-4 pt-4 pr-14">
                        <div className="flex items-center gap-3">
                            <div
                                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                                    selectedContract?.online
                                        ? 'bg-emerald-100 dark:bg-emerald-950/50'
                                        : 'bg-ink/[0.07]'
                                }`}
                            >
                                <Building2
                                    className={`h-4 w-4 ${
                                        selectedContract?.online
                                            ? 'text-emerald-600 dark:text-emerald-400'
                                            : 'text-ink/40'
                                    }`}
                                />
                            </div>
                            <div className="min-w-0">
                                <DialogTitle className="text-base font-semibold leading-tight text-ink/90">
                                    Contrato #{selectedContract?.id}
                                </DialogTitle>
                                <div className="mt-1.5 flex items-center gap-2">
                                    <span
                                        className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                            selectedContract?.online
                                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                                                : 'bg-ink/[0.08] text-ink/50'
                                        }`}
                                    >
                                        <span
                                            className={`h-1.5 w-1.5 rounded-full ${
                                                selectedContract?.online
                                                    ? 'animate-pulse bg-emerald-500'
                                                    : 'bg-ink/30'
                                            }`}
                                        />
                                        {selectedContract?.online ? 'Online' : 'Offline'}
                                    </span>
                                    {selectedContract?.login && (
                                        <span className="truncate font-mono text-[11px] text-ink/35">
                                            {selectedContract.login}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-ink/[0.08]">
                        {(
                            [
                                { key: 'conexao',      label: 'Conexão',    icon: Network       },
                                { key: 'servicos',     label: 'Serviços',   icon: Sparkles      },
                                { key: 'equipamentos', label: 'Equip.',     icon: Monitor       },
                                { key: 'financeiro',   label: 'Financ.',    icon: Receipt       },
                                { key: 'os',           label: 'OS',         icon: ClipboardList },
                                { key: 'atendimentos', label: 'Atend.',     icon: Headphones    },
                            ] as const
                        ).map(({ key, label, icon: Icon }) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => setActiveTab(key)}
                                className={`flex flex-1 items-center justify-center gap-1.5 border-b-2 px-3 py-3 text-xs font-medium transition-colors ${
                                    activeTab === key
                                        ? 'border-accent text-accent'
                                        : 'border-transparent text-ink/40 hover:text-ink/70'
                                }`}
                            >
                                <Icon className="h-3.5 w-3.5" />
                                {label}
                            </button>
                        ))}
                    </div>

                    {loadingDetails ? (
                        <div className="flex items-center justify-center py-16 text-ink/30">
                            <Loader2 className="h-5 w-5 animate-spin" />
                        </div>
                    ) : (
                        <div className="scrollbar-thin h-[65vh] overflow-y-auto">
                            <div className="space-y-5 p-5">

                                {/* ── Tab: Conexão ── */}
                                {activeTab === 'conexao' && (
                                    <>
                                        {/* Card do plano */}
                                        {(selectedContract?.plano || selectedContract?.valor || selectedContract?.velocidade_down || selectedContract?.data_ativacao) && (
                                            <section>
                                                <h3 className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.1em] text-ink/30">
                                                    <Zap className="h-3 w-3" />
                                                    Plano
                                                </h3>
                                                <dl className="overflow-hidden rounded-xl border border-ink/[0.08]">
                                                    {selectedContract.plano && (
                                                        <div className="flex items-center justify-between px-4 py-2.5 text-xs">
                                                            <dt className="text-ink/40">Plano</dt>
                                                            <dd className="font-medium text-ink/75">{selectedContract.plano}</dd>
                                                        </div>
                                                    )}
                                                    {selectedContract.valor && (
                                                        <div className="flex items-center justify-between border-t border-ink/[0.06] px-4 py-2.5 text-xs">
                                                            <dt className="text-ink/40">Valor mensal</dt>
                                                            <dd className="font-semibold text-ink/75">{selectedContract.valor}</dd>
                                                        </div>
                                                    )}
                                                    {(selectedContract.velocidade_down || selectedContract.velocidade_up) && (
                                                        <div className="flex items-center justify-between border-t border-ink/[0.06] px-4 py-2.5 text-xs">
                                                            <dt className="text-ink/40">Velocidade</dt>
                                                            <dd className="flex items-center gap-2 font-medium text-ink/70">
                                                                {selectedContract.velocidade_down && (
                                                                    <span className="flex items-center gap-1">
                                                                        <ArrowDownToLine className="h-3 w-3 text-sky-500" />
                                                                        {selectedContract.velocidade_down}
                                                                    </span>
                                                                )}
                                                                {selectedContract.velocidade_up && (
                                                                    <span className="flex items-center gap-1">
                                                                        <ArrowUpFromLine className="h-3 w-3 text-violet-500" />
                                                                        {selectedContract.velocidade_up}
                                                                    </span>
                                                                )}
                                                            </dd>
                                                        </div>
                                                    )}
                                                    {selectedContract.data_ativacao && (
                                                        <div className="flex items-center justify-between border-t border-ink/[0.06] px-4 py-2.5 text-xs">
                                                            <dt className="text-ink/40">Ativo desde</dt>
                                                            <dd className="font-medium text-ink/70">{formatDateShort(selectedContract.data_ativacao)}</dd>
                                                        </div>
                                                    )}
                                                </dl>
                                            </section>
                                        )}

                                        <section>
                                            <h3 className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.1em] text-ink/30">
                                                <Network className="h-3 w-3" />
                                                Dados da conexão
                                            </h3>
                                            {details?.connection ? (
                                                <div className="overflow-hidden rounded-xl border border-ink/[0.08]">
                                                    <div
                                                        className={`flex items-center gap-2 border-b px-4 py-2.5 text-xs font-medium ${
                                                            details.connection.online
                                                                ? 'border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-400'
                                                                : 'border-ink/[0.06] bg-ink/[0.02] text-ink/45'
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
                                                    <dl className="divide-y divide-ink/[0.05]">
                                                        {details.connection.login && (
                                                            <div className="flex items-center justify-between px-4 py-2.5 text-xs odd:bg-ink/[0.01]">
                                                                <dt className="text-ink/40">Usuário PPPoE</dt>
                                                                <dd className="font-mono font-medium text-ink/75">{details.connection.login}</dd>
                                                            </div>
                                                        )}
                                                        {details.connection.senha && (
                                                            <div className="flex items-center justify-between px-4 py-2.5 text-xs odd:bg-ink/[0.01]">
                                                                <dt className="text-ink/40">Senha PPPoE</dt>
                                                                <dd className="flex items-center gap-1.5">
                                                                    <span className="font-mono font-medium text-ink/75">
                                                                        {showSenha ? details.connection.senha : '••••••••'}
                                                                    </span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setShowSenha((v) => !v)}
                                                                        className="rounded p-0.5 text-ink/30 transition-colors hover:bg-ink/[0.06] hover:text-ink/60"
                                                                    >
                                                                        {showSenha ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                                                    </button>
                                                                </dd>
                                                            </div>
                                                        )}
                                                        {details.connection.ip && (
                                                            <div className="flex items-center justify-between px-4 py-2.5 text-xs odd:bg-ink/[0.01]">
                                                                <dt className="text-ink/40">IP</dt>
                                                                <dd className="rounded bg-ink/[0.05] px-1.5 py-0.5 font-mono text-[11px] font-medium text-ink/70">{details.connection.ip}</dd>
                                                            </div>
                                                        )}
                                                        {details.connection.concentrador && (
                                                            <div className="flex items-center justify-between px-4 py-2.5 text-xs odd:bg-ink/[0.01]">
                                                                <dt className="text-ink/40">Concentrador</dt>
                                                                <dd className="font-medium text-ink/70">{details.connection.concentrador}</dd>
                                                            </div>
                                                        )}
                                                        {!details.connection.online && details.connection.fim && (
                                                            <div className="flex items-center justify-between px-4 py-2.5 text-xs odd:bg-ink/[0.01]">
                                                                <dt className="text-ink/40">Desconectado em</dt>
                                                                <dd className="font-medium text-ink/70">{formatDate(details.connection.fim)}</dd>
                                                            </div>
                                                        )}
                                                    </dl>
                                                    {(details.connection.download || details.connection.upload) && (
                                                        <div className="space-y-2 border-t border-ink/[0.06] bg-ink/[0.01] p-3">
                                                            <p className="text-[10px] text-ink/30">
                                                                Consumo da sessão{details.connection.inicio ? ` · desde ${formatDate(details.connection.inicio)}` : ''}
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

                                        {/* ── Consumo Diário ── */}
                                        <section>
                                            <h3 className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.1em] text-ink/30">
                                                <BarChart3 className="h-3 w-3" />
                                                Consumo diário (últimos 31 dias)
                                            </h3>
                                            <div className="overflow-hidden rounded-xl border border-ink/[0.08] px-3 py-4">
                                                <ConsumoChart data={consumo} loading={loadingConsumo} />
                                            </div>
                                        </section>

                                    </>
                                )}

                                {/* ── Tab: Serviços ── */}
                                {activeTab === 'servicos' && (
                                    <>
                                        <section>
                                            <h3 className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.1em] text-ink/30">
                                                <Sparkles className="h-3 w-3" />
                                                Serviços adicionais
                                            </h3>
                                            {!details || (details.servicos ?? []).length === 0 ? (
                                                <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-ink/[0.10] py-6 text-center">
                                                    <Sparkles className="h-5 w-5 text-ink/20" />
                                                    <p className="text-xs text-ink/35">Nenhum serviço adicional.</p>
                                                </div>
                                            ) : (
                                                <ul className="space-y-1.5">
                                                    {(details.servicos ?? []).map((s) => (
                                                        <li
                                                            key={s.id}
                                                            className="flex items-center gap-3 rounded-xl border border-ink/[0.08] px-4 py-2.5"
                                                        >
                                                            <span
                                                                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                                                                    s.status === 'A' ? 'bg-emerald-500' : 'bg-ink/20'
                                                                }`}
                                                            />
                                                            <div className="min-w-0 flex-1">
                                                                <p className="truncate text-xs font-medium text-ink/75">
                                                                    {s.nome || 'Serviço'}
                                                                </p>
                                                                {s.tipo && (
                                                                    <p className="text-[10px] text-ink/35">{TIPO_SERVICO_LABEL[s.tipo] ?? s.tipo}</p>
                                                                )}
                                                            </div>
                                                            {s.valor && (
                                                                <span className="shrink-0 text-xs font-semibold text-ink/50">{s.valor}</span>
                                                            )}
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </section>

                                        {(details?.linhas_mvno ?? []).length > 0 && (
                                            <section>
                                                <h3 className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.1em] text-ink/30">
                                                    <Smartphone className="h-3 w-3" />
                                                    Linhas MVNO
                                                </h3>
                                                <ul className="space-y-3">
                                                    {(details!.linhas_mvno).map((l) => {
                                                        const ativa = l.status_linha === 'A';
                                                        return (
                                                            <li key={l.id} className="overflow-hidden rounded-xl border border-ink/[0.08]">
                                                                {/* Accent stripe */}
                                                                <div className={`h-0.5 w-full ${ativa ? 'bg-emerald-400' : 'bg-ink/10'}`} />

                                                                {/* Phone number + status + date */}
                                                                <div className="flex items-start justify-between gap-3 px-4 pt-3.5 pb-3">
                                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${ativa ? 'bg-emerald-500/10' : 'bg-ink/[0.05]'}`}>
                                                                            <Smartphone className={`h-4 w-4 ${ativa ? 'text-emerald-600 dark:text-emerald-400' : 'text-ink/30'}`} />
                                                                        </div>
                                                                        <div className="min-w-0">
                                                                            <p className="font-mono text-[15px] font-bold tracking-tight text-ink/85">
                                                                                {formatBrPhone(l.telefone)}
                                                                            </p>
                                                                            {l.created_at && (
                                                                                <p className="mt-0.5 text-[10px] text-ink/35">
                                                                                    Ativado em {formatDateShort(l.created_at)}
                                                                                </p>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <span className={`shrink-0 mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${ativa ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-400' : 'bg-ink/[0.07] text-ink/40'}`}>
                                                                        <span className={`h-1.5 w-1.5 rounded-full ${ativa ? 'bg-emerald-500' : 'bg-ink/25'}`} />
                                                                        {ativa ? 'Ativa' : 'Inativa'}
                                                                    </span>
                                                                </div>

                                                                {/* Attribute pills */}
                                                                <div className="flex flex-wrap gap-1.5 border-t border-ink/[0.06] px-4 py-2.5">
                                                                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${l.esim ? 'bg-violet-500/10 text-violet-700 dark:text-violet-400' : 'bg-ink/[0.06] text-ink/45'}`}>
                                                                        {l.esim ? 'eSIM' : 'SIM Físico'}
                                                                    </span>
                                                                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${l.portabilidade ? 'bg-sky-500/10 text-sky-700 dark:text-sky-400' : 'bg-ink/[0.06] text-ink/45'}`}>
                                                                        {l.portabilidade
                                                                            ? `Portabilidade${l.operadora_origem ? ` · ${l.operadora_origem}` : ''}`
                                                                            : 'Sem portabilidade'}
                                                                    </span>
                                                                    {l.numero_temporario && (
                                                                        <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                                                                            Temp. {l.numero_temporario}
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                {/* SIM card number */}
                                                                {l.simcard && (
                                                                    <div className="flex items-center gap-3 border-t border-ink/[0.06] bg-ink/[0.015] px-4 py-2">
                                                                        <span className="shrink-0 text-[9px] font-bold uppercase tracking-widest text-ink/25">SIM</span>
                                                                        <span className="min-w-0 truncate font-mono text-[11px] text-ink/45">{l.simcard}</span>
                                                                    </div>
                                                                )}
                                                            </li>
                                                        );
                                                    })}
                                                </ul>
                                            </section>
                                        )}

                                        {(details?.linhas_sip ?? []).length > 0 && (
                                            <section>
                                                <h3 className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.1em] text-ink/30">
                                                    <Phone className="h-3 w-3" />
                                                    Linhas SIP
                                                </h3>
                                                <ul className="space-y-3">
                                                    {(details!.linhas_sip).map((s) => {
                                                        const cancelado = Boolean(s.data_cancelamento && s.data_cancelamento !== '0000-00-00');
                                                        const ativo = s.ativo && !cancelado;
                                                        return (
                                                            <li key={s.id} className="overflow-hidden rounded-xl border border-ink/[0.08]">
                                                                {/* Accent stripe */}
                                                                <div className={`h-0.5 w-full ${ativo ? 'bg-sky-400' : 'bg-ink/10'}`} />

                                                                {/* Header */}
                                                                <div className="flex items-start justify-between gap-3 px-4 pt-3.5 pb-3">
                                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${ativo ? 'bg-sky-500/10' : 'bg-ink/[0.05]'}`}>
                                                                            <Phone className={`h-4 w-4 ${ativo ? 'text-sky-600 dark:text-sky-400' : 'text-ink/30'}`} />
                                                                        </div>
                                                                        <div className="min-w-0">
                                                                            <p className="font-mono text-[15px] font-bold tracking-tight text-ink/85">
                                                                                {formatBrPhone(s.numero)}
                                                                            </p>
                                                                            {s.created_at && (
                                                                                <p className="mt-0.5 text-[10px] text-ink/35">
                                                                                    Ativado em {formatDateShort(s.created_at)}
                                                                                </p>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <span className={`shrink-0 mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${ativo ? 'bg-sky-500/12 text-sky-700 dark:text-sky-400' : 'bg-ink/[0.07] text-ink/40'}`}>
                                                                        <span className={`h-1.5 w-1.5 rounded-full ${ativo ? 'bg-sky-500' : 'bg-ink/25'}`} />
                                                                        {cancelado ? 'Cancelado' : ativo ? 'Ativo' : 'Inativo'}
                                                                    </span>
                                                                </div>

                                                                {/* Description */}
                                                                {s.descricao && (
                                                                    <div className="border-t border-ink/[0.06] px-4 py-2">
                                                                        <p className="truncate text-[11px] text-ink/55">{s.descricao}</p>
                                                                    </div>
                                                                )}

                                                                {/* Details grid */}
                                                                <div className={`grid divide-x divide-ink/[0.06] border-t border-ink/[0.06] bg-ink/[0.015] ${[s.ipaddr, s.context, s.limite_chamada].filter(Boolean).length === 3 ? 'grid-cols-3' : [s.ipaddr, s.context, s.limite_chamada].filter(Boolean).length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                                                                    {s.ipaddr && (
                                                                        <div className="flex flex-col items-center py-2">
                                                                            <dt className="text-[9px] uppercase tracking-wider text-ink/30">IP</dt>
                                                                            <dd className="mt-0.5 font-mono text-[10px] font-medium text-ink/60">{s.ipaddr}</dd>
                                                                        </div>
                                                                    )}
                                                                    {s.context && (
                                                                        <div className="flex flex-col items-center py-2">
                                                                            <dt className="text-[9px] uppercase tracking-wider text-ink/30">Tipo</dt>
                                                                            <dd className="mt-0.5 text-[10px] font-medium text-ink/60">{s.context}</dd>
                                                                        </div>
                                                                    )}
                                                                    {s.limite_chamada && (
                                                                        <div className="flex flex-col items-center py-2">
                                                                            <dt className="text-[9px] uppercase tracking-wider text-ink/30">Limite</dt>
                                                                            <dd className="mt-0.5 text-[10px] font-medium text-ink/60">{s.limite_chamada} ch.</dd>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </li>
                                                        );
                                                    })}
                                                </ul>
                                            </section>
                                        )}

                                        {details?.central_assinante && (
                                            <section>
                                                <h3 className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.1em] text-ink/30">
                                                    <KeyRound className="h-3 w-3" />
                                                    Acesso à TV / Central do assinante
                                                </h3>
                                                <dl className="overflow-hidden rounded-xl border border-ink/[0.08]">
                                                    {details.central_assinante.login && (
                                                        <div className="flex items-center justify-between px-4 py-2.5 text-xs">
                                                            <dt className="text-ink/40">Login</dt>
                                                            <dd className="font-mono font-medium text-ink/75">{details.central_assinante.login}</dd>
                                                        </div>
                                                    )}
                                                    {details.central_assinante.senha && (
                                                        <div className="flex items-center justify-between border-t border-ink/[0.06] px-4 py-2.5 text-xs">
                                                            <dt className="text-ink/40">Senha</dt>
                                                            <dd className="flex items-center gap-1.5">
                                                                <span className="font-mono font-medium text-ink/75">
                                                                    {showSenhaCentral ? details.central_assinante.senha : '••••••••'}
                                                                </span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setShowSenhaCentral((v) => !v)}
                                                                    className="rounded p-0.5 text-ink/30 transition-colors hover:bg-ink/[0.06] hover:text-ink/60"
                                                                >
                                                                    {showSenhaCentral ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                                                </button>
                                                            </dd>
                                                        </div>
                                                    )}
                                                </dl>
                                            </section>
                                        )}

                                    </>
                                )}

                                {/* ── Tab: Equipamentos ── */}
                                {activeTab === 'equipamentos' && (
                                    <section>
                                        <h3 className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.1em] text-ink/30">
                                            <Monitor className="h-3 w-3" />
                                            Equipamentos em campo
                                        </h3>
                                        {!details || (details.comodatos ?? []).length === 0 ? (
                                            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-ink/[0.10] py-6 text-center">
                                                <Monitor className="h-5 w-5 text-ink/20" />
                                                <p className="text-xs text-ink/35">Nenhum equipamento em campo.</p>
                                            </div>
                                        ) : (
                                            <ul className="space-y-2">
                                                {(details.comodatos ?? []).map((c) => (
                                                    <li key={c.id} className="overflow-hidden rounded-xl border border-ink/[0.08]">
                                                        <div className="flex items-center gap-3 px-4 py-3">
                                                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink/[0.05]">
                                                                <Monitor className="h-3.5 w-3.5 text-ink/35" />
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <p className="truncate text-xs font-semibold text-ink/80">
                                                                    {c.descricao || 'Equipamento'}
                                                                </p>
                                                                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                                                    {c.id_produto && (
                                                                        <span className="rounded bg-ink/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-ink/40">Prod. #{c.id_produto}</span>
                                                                    )}
                                                                    {c.patrimonio && (
                                                                        <span className="rounded bg-ink/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-ink/40">Pat. {c.patrimonio}</span>
                                                                    )}
                                                                    {c.numero_serie && (
                                                                        <span className="rounded bg-ink/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-ink/40">S/N {c.numero_serie}</span>
                                                                    )}
                                                                    {c.mac && (
                                                                        <span className="rounded bg-ink/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-ink/40">{c.mac}</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            {c.data && (
                                                                <span className="shrink-0 text-[10px] text-ink/30">{formatDateShort(c.data)}</span>
                                                            )}
                                                        </div>
                                                        <dl className="grid grid-cols-3 divide-x divide-ink/[0.06] border-t border-ink/[0.06] bg-ink/[0.01]">
                                                            <div className="flex flex-col items-center py-2">
                                                                <dt className="text-[9px] uppercase tracking-wider text-ink/30">Qtde.</dt>
                                                                <dd className="text-xs font-semibold text-ink/70">{c.qtde} {c.unidade ?? ''}</dd>
                                                            </div>
                                                            <div className="flex flex-col items-center py-2">
                                                                <dt className="text-[9px] uppercase tracking-wider text-ink/30">Unit.</dt>
                                                                <dd className="text-xs font-semibold text-ink/70">{c.valor_unitario ? `R$ ${c.valor_unitario}` : '—'}</dd>
                                                            </div>
                                                            <div className="flex flex-col items-center py-2">
                                                                <dt className="text-[9px] uppercase tracking-wider text-ink/30">Total</dt>
                                                                <dd className="text-xs font-semibold text-ink/70">{c.valor_total ? `R$ ${c.valor_total}` : '—'}</dd>
                                                            </div>
                                                        </dl>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </section>
                                )}

                                {/* ── Tab: Financeiro ── */}
                                {activeTab === 'financeiro' && (
                                    <section>
                                        <h3 className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.1em] text-ink/30">
                                            <Receipt className="h-3 w-3" />
                                            Boletos em aberto
                                        </h3>
                                        {details && details.invoices.length === 0 ? (
                                            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-ink/[0.10] py-6 text-center">
                                                <Receipt className="h-5 w-5 text-ink/20" />
                                                <p className="text-xs text-ink/35">Nenhum boleto em aberto.</p>
                                            </div>
                                        ) : (
                                            <ul className="space-y-1.5">
                                                {(details?.invoices ?? []).map((inv) => {
                                                    const overdue      = isOverdue(inv.data_vencimento);
                                                    const isSendingBol = sendingBoleto === inv.id;
                                                    const isSendingPix = sendingPix === inv.id;
                                                    const anyBusy      = sendingBoleto !== null || sendingPix !== null;
                                                    const fbBol        = boletoFeedback?.id === inv.id ? boletoFeedback : null;
                                                    const fbPix        = pixFeedback?.id === inv.id ? pixFeedback : null;
                                                    return (
                                                        <li key={inv.id} className={`overflow-hidden rounded-xl border ${overdue ? 'border-red-200/70 dark:border-red-900/40' : 'border-ink/[0.08]'}`}>
                                                            {/* Accent bar */}
                                                            <div className={`h-1 w-full ${overdue ? 'bg-red-500' : 'bg-ink/[0.06]'}`} />

                                                            {/* Valor + vencimento */}
                                                            <div className="flex items-start justify-between gap-3 px-4 pt-3 pb-2.5">
                                                                <div className="min-w-0">
                                                                    <p className="text-lg font-bold leading-none text-ink/90">
                                                                        R$ {Number(inv.valor ?? 0).toFixed(2).replace('.', ',')}
                                                                    </p>
                                                                    {inv.referencia && (
                                                                        <p className="mt-1 truncate text-[11px] text-ink/45">{inv.referencia}</p>
                                                                    )}
                                                                    {(inv.valor_juros || inv.valor_multa) && (
                                                                        <p className="mt-1 text-[10px] font-medium text-red-500 dark:text-red-400">
                                                                            + {[inv.valor_juros && `Juros R$ ${inv.valor_juros}`, inv.valor_multa && `Multa R$ ${inv.valor_multa}`].filter(Boolean).join(' · ')}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                                <div className="shrink-0 text-right">
                                                                    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                                                        overdue
                                                                            ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                                                                            : 'bg-ink/[0.06] text-ink/50'
                                                                    }`}>
                                                                        {overdue ? 'Venceu' : 'Vence'} {formatDateShort(inv.data_vencimento)}
                                                                    </span>
                                                                    {inv.data_emissao && (
                                                                        <p className="mt-1 text-[10px] text-ink/30">Emitido {formatDateShort(inv.data_emissao)}</p>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Detalhes extras */}
                                                            {(inv.competencia || inv.nosso_numero || inv.parcela) && (
                                                                <div className="flex flex-wrap gap-x-4 gap-y-0.5 border-t border-ink/[0.05] bg-ink/[0.015] px-4 py-1.5">
                                                                    {inv.competencia && (
                                                                        <span className="text-[10px] text-ink/40">{inv.competencia}</span>
                                                                    )}
                                                                    {inv.parcela && (
                                                                        <span className="text-[10px] text-ink/40">Parcela {inv.parcela}</span>
                                                                    )}
                                                                    {inv.nosso_numero && (
                                                                        <span className="font-mono text-[10px] text-ink/30">{inv.nosso_numero}</span>
                                                                    )}
                                                                </div>
                                                            )}

                                                            {/* Botões */}
                                                            <div className="flex gap-2 border-t border-ink/[0.06] p-2">
                                                                <button
                                                                    type="button"
                                                                    disabled={anyBusy}
                                                                    onClick={() => handleSendPix(inv)}
                                                                    title="Enviar PIX + QR Code na conversa"
                                                                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-500/10 py-2 text-[11px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:text-emerald-400"
                                                                >
                                                                    {isSendingPix ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <QrCode className="h-3.5 w-3.5" />}
                                                                    Enviar PIX
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    disabled={anyBusy}
                                                                    onClick={() => handleSendBoleto(inv)}
                                                                    title="Enviar 2ª via na conversa"
                                                                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-500/10 py-2 text-[11px] font-semibold text-blue-700 transition-colors hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:text-blue-400"
                                                                >
                                                                    {isSendingBol ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                                                                    2ª via boleto
                                                                </button>
                                                            </div>

                                                            {(fbPix || fbBol) && (
                                                                <div className="border-t border-ink/[0.06] px-4 py-2">
                                                                    {fbPix && <p className={`text-[11px] ${fbPix.ok ? 'text-emerald-600' : 'text-red-500'}`}>{fbPix.msg}</p>}
                                                                    {fbBol && <p className={`text-[11px] ${fbBol.ok ? 'text-emerald-600' : 'text-red-500'}`}>{fbBol.msg}</p>}
                                                                </div>
                                                            )}
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        )}
                                    </section>
                                )}

                                {/* ── Tab: Atendimentos ── */}
                                {activeTab === 'atendimentos' && (
                                    <section>
                                        <h3 className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.1em] text-ink/30">
                                            <Headphones className="h-3 w-3" />
                                            Atendimentos
                                        </h3>
                                        {!details || (details.tickets ?? []).length === 0 ? (
                                            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-ink/[0.10] py-6 text-center">
                                                <Headphones className="h-5 w-5 text-ink/20" />
                                                <p className="text-xs text-ink/35">Nenhum atendimento encontrado.</p>
                                            </div>
                                        ) : (
                                            <ul className="space-y-2">
                                                {(details.tickets ?? []).map((tk) => {
                                                    const statusLabel: Record<string, string> = {
                                                        T:    'Em tratamento',
                                                        C:    'Cancelado',
                                                        F:    'Fechado',
                                                        EX:   'Em execução',
                                                        OSAB: 'OS aberta',
                                                        OSAG: 'OS aguardando',
                                                        OSEX: 'OS em execução',
                                                    };
                                                    const statusColor: Record<string, string> = {
                                                        T:    'bg-blue-500/15 text-blue-700 dark:text-blue-400',
                                                        C:    'bg-ink/[0.08] text-ink/40',
                                                        F:    'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
                                                        EX:   'bg-violet-500/15 text-violet-700 dark:text-violet-400',
                                                        OSAB: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
                                                        OSAG: 'bg-orange-500/15 text-orange-700 dark:text-orange-400',
                                                        OSEX: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
                                                    };
                                                    return (
                                                        <li key={tk.id} className="overflow-hidden rounded-xl border border-ink/[0.08]">
                                                            <div className="flex items-start justify-between gap-3 px-4 py-3">
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                                        <span className="font-mono text-[10px] text-ink/35">#{tk.id}</span>
                                                                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${statusColor[tk.status] ?? 'bg-ink/[0.08] text-ink/40'}`}>
                                                                            {statusLabel[tk.status] ?? tk.status}
                                                                        </span>
                                                                    </div>
                                                                    {tk.titulo && (
                                                                        <p className="mt-1 text-xs font-medium text-ink/75 leading-snug">
                                                                            {tk.titulo}
                                                                        </p>
                                                                    )}
                                                                    {tk.protocolo && (
                                                                        <p className="mt-1 font-mono text-[10px] text-ink/35">
                                                                            {tk.protocolo}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                                {tk.data_criacao && (
                                                                    <span className="shrink-0 text-[10px] text-ink/35">
                                                                        {formatDateShort(tk.data_criacao)}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        )}
                                    </section>
                                )}

                                {/* ── Tab: OS ── */}
                                {activeTab === 'os' && (
                                    <section>
                                        <h3 className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.1em] text-ink/30">
                                            <ClipboardList className="h-3 w-3" />
                                            Ordens de Serviço
                                        </h3>
                                        {!details || (details.ordens ?? []).length === 0 ? (
                                            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-ink/[0.10] py-6 text-center">
                                                <ClipboardList className="h-5 w-5 text-ink/20" />
                                                <p className="text-xs text-ink/35">Nenhuma OS encontrada.</p>
                                            </div>
                                        ) : (
                                            <ul className="space-y-2">
                                                {(details.ordens ?? []).map((os) => {
                                                    const statusLabel: Record<string, string> = {
                                                        A:   'Aberto',
                                                        F:   'Fechado',
                                                        AN:  'Anulado',
                                                        EN:  'Em andamento',
                                                        AS:  'Assumido',
                                                        AG:  'Aguardando',
                                                        EX:  'Em execução',
                                                        RAG: 'Reagendado',
                                                        DS:  'Deslocamento',
                                                    };
                                                    const statusColor: Record<string, string> = {
                                                        A:   'bg-amber-500/15 text-amber-700 dark:text-amber-400',
                                                        F:   'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
                                                        AN:  'bg-ink/[0.08] text-ink/40',
                                                        EN:  'bg-blue-500/15 text-blue-700 dark:text-blue-400',
                                                        AS:  'bg-violet-500/15 text-violet-700 dark:text-violet-400',
                                                        AG:  'bg-orange-500/15 text-orange-700 dark:text-orange-400',
                                                        EX:  'bg-blue-500/15 text-blue-700 dark:text-blue-400',
                                                        RAG: 'bg-orange-500/15 text-orange-700 dark:text-orange-400',
                                                        DS:  'bg-sky-500/15 text-sky-700 dark:text-sky-400',
                                                    };
                                                    return (
                                                        <li key={os.id} className="overflow-hidden rounded-xl border border-ink/[0.08]">
                                                            <div className="flex items-start justify-between gap-3 px-4 py-3">
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="font-mono text-[10px] text-ink/35">#{os.id}</span>
                                                                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${statusColor[os.status] ?? 'bg-ink/[0.08] text-ink/40'}`}>
                                                                            {statusLabel[os.status] ?? os.status}
                                                                        </span>
                                                                    </div>
                                                                    {os.assunto && (
                                                                        <p className="mt-1 text-xs font-semibold text-ink/80 leading-snug">
                                                                            {os.assunto}
                                                                        </p>
                                                                    )}
                                                                    {os.mensagem && (
                                                                        <div className="mt-1.5">
                                                                            <p className="text-[9px] font-semibold uppercase tracking-wider text-ink/30">Mensagem</p>
                                                                            <p className="mt-0.5 text-[11px] text-ink/60 leading-snug line-clamp-3">
                                                                                {os.mensagem}
                                                                            </p>
                                                                        </div>
                                                                    )}
                                                                    {os.mensagem_resposta && (
                                                                        <div className="mt-1.5">
                                                                            <p className="text-[9px] font-semibold uppercase tracking-wider text-ink/30">Resposta do Técnico</p>
                                                                            <p className="mt-0.5 text-[11px] text-ink/60 leading-snug line-clamp-2">
                                                                                {os.mensagem_resposta}
                                                                            </p>
                                                                        </div>
                                                                    )}
                                                                    {os.tecnico && (
                                                                        <p className="mt-1 text-[10px] text-ink/40">
                                                                            Técnico: {os.tecnico}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                                <div className="shrink-0 text-right">
                                                                    {os.data_abertura && (
                                                                        <p className="text-[10px] text-ink/35">{formatDateShort(os.data_abertura)}</p>
                                                                    )}
                                                                    {os.data_fechamento && os.status === 'F' && (
                                                                        <p className="mt-0.5 text-[10px] text-ink/30">Fechado {formatDateShort(os.data_fechamento)}</p>
                                                                    )}
                                                                    {os.data_previsao && os.status !== 'F' && (
                                                                        <p className="mt-0.5 text-[10px] text-ink/30">Prev. {formatDateShort(os.data_previsao)}</p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        )}
                                    </section>
                                )}

                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
