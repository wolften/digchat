import { Button } from '@/Components/ui/button';
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
import { Textarea } from '@/Components/ui/textarea';
import { useTheme } from '@/hooks/useTheme';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router } from '@inertiajs/react';
import dagre from '@dagrejs/dagre';
import { ArrowLeft, LayoutGrid, Plus, Save, Trash2, X } from 'lucide-react';
import { createContext, memo, useCallback, useContext, useRef, useState } from 'react';
import ReactFlow, {
    addEdge,
    Background,
    Controls,
    Handle,
    MiniMap,
    Position,
    useEdgesState,
    useNodesState,
    type Connection,
    type Edge,
    type Node,
    type NodeProps,
    type ReactFlowInstance,
} from 'reactflow';
import 'reactflow/dist/style.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FlowNodeType = 'start' | 'message' | 'question' | 'ixc_action' | 'business_hours_check' | 'handoff' | 'end';

interface QuestionOption {
    id: string;
    label: string;
}

interface FlowNodeData {
    message?: string;
    options?: QuestionOption[];
    action?: 'invoice_second_copy' | 'trust_unlock';
    confirm_message?: string;
    document_message?: string;
    hours_scope?: 'global' | 'conversation' | 'sector';
    sector_id?: number | null;
    sector_name?: string;
    max_retries?: number;
    retry_message?: string;
    fallback_sector_id?: number | null;
    fallback_message?: string;
}

interface Sector {
    id: number;
    name: string;
}

interface FlowDefinition {
    nodes: Node<FlowNodeData>[];
    edges: Edge[];
}

interface FlowData {
    id: number;
    name: string;
    description: string | null;
    definition: FlowDefinition | null;
    is_active: boolean;
    is_default: boolean;
}

interface Props {
    flow: FlowData | null;
    sectors: Sector[];
}

// ---------------------------------------------------------------------------
// Theme context (shared with memo'd node components)
// ---------------------------------------------------------------------------

const DarkCtx = createContext(true);

// ---------------------------------------------------------------------------
// Colour palettes per theme
// ---------------------------------------------------------------------------

interface NodeColors {
    bg: string;
    border: string;
    selectedBorder: string;
    shadow: string;
    headerBg: string;
    headerText: string;
    bodyText: string;
    mutedText: string;
    optionBg: string;
    optionText: string;
    optionMuted: string;
    handleColor: string;
}

const PALETTE: Record<'light' | 'dark', Record<FlowNodeType, NodeColors>> = {
    light: {
        start:    { bg: '#f0fdf4', border: '#86efac', selectedBorder: '#16a34a', shadow: '#16a34a22', headerBg: '#16a34a', headerText: '#fff', bodyText: '#166534', mutedText: '#86efac', optionBg: '', optionText: '', optionMuted: '', handleColor: '#16a34a' },
        message:  { bg: '#eff6ff', border: '#93c5fd', selectedBorder: '#2563eb', shadow: '#2563eb22', headerBg: '#2563eb', headerText: '#fff', bodyText: '#1e3a8a', mutedText: '#93c5fd', optionBg: '', optionText: '', optionMuted: '', handleColor: '#2563eb' },
        question: { bg: '#faf5ff', border: '#c4b5fd', selectedBorder: '#7c3aed', shadow: '#7c3aed22', headerBg: '#7c3aed', headerText: '#fff', bodyText: '#4c1d95', mutedText: '#c4b5fd', optionBg: '#ede9fe', optionText: '#5b21b6', optionMuted: '#a78bfa', handleColor: '#7c3aed' },
        ixc_action: { bg: '#ecfeff', border: '#67e8f9', selectedBorder: '#0891b2', shadow: '#0891b222', headerBg: '#0891b2', headerText: '#fff', bodyText: '#164e63', mutedText: '#67e8f9', optionBg: '#cffafe', optionText: '#155e75', optionMuted: '#22d3ee', handleColor: '#0891b2' },
        business_hours_check: { bg: '#fef2f2', border: '#fca5a5', selectedBorder: '#dc2626', shadow: '#dc262622', headerBg: '#dc2626', headerText: '#fff', bodyText: '#991b1b', mutedText: '#fca5a5', optionBg: '#fee2e2', optionText: '#b91c1c', optionMuted: '#f87171', handleColor: '#dc2626' },
        handoff:  { bg: '#fffbeb', border: '#fcd34d', selectedBorder: '#d97706', shadow: '#d9770622', headerBg: '#d97706', headerText: '#fff', bodyText: '#78350f', mutedText: '#fcd34d', optionBg: '', optionText: '', optionMuted: '', handleColor: '#d97706' },
        end:      { bg: '#f8fafc', border: '#cbd5e1', selectedBorder: '#64748b', shadow: '#64748b22', headerBg: '#64748b', headerText: '#fff', bodyText: '#475569', mutedText: '#94a3b8', optionBg: '', optionText: '', optionMuted: '', handleColor: '#64748b' },
    },
    dark: {
        start:    { bg: '#052e16', border: '#166534', selectedBorder: '#4ade80', shadow: '#4ade8033', headerBg: '#15803d', headerText: '#dcfce7', bodyText: '#86efac', mutedText: '#166534', optionBg: '', optionText: '', optionMuted: '', handleColor: '#4ade80' },
        message:  { bg: '#0c1a3a', border: '#1e40af', selectedBorder: '#60a5fa', shadow: '#60a5fa33', headerBg: '#1d4ed8', headerText: '#dbeafe', bodyText: '#93c5fd', mutedText: '#1e40af', optionBg: '', optionText: '', optionMuted: '', handleColor: '#60a5fa' },
        question: { bg: '#1e0a3c', border: '#5b21b6', selectedBorder: '#a78bfa', shadow: '#a78bfa33', headerBg: '#6d28d9', headerText: '#ede9fe', bodyText: '#c4b5fd', mutedText: '#5b21b6', optionBg: '#2e1065', optionText: '#ddd6fe', optionMuted: '#7c3aed', handleColor: '#a78bfa' },
        ixc_action: { bg: '#062832', border: '#155e75', selectedBorder: '#22d3ee', shadow: '#22d3ee33', headerBg: '#0e7490', headerText: '#cffafe', bodyText: '#67e8f9', mutedText: '#155e75', optionBg: '#164e63', optionText: '#cffafe', optionMuted: '#0891b2', handleColor: '#22d3ee' },
        business_hours_check: { bg: '#1c0a0a', border: '#991b1b', selectedBorder: '#f87171', shadow: '#f8717133', headerBg: '#b91c1c', headerText: '#fee2e2', bodyText: '#fca5a5', mutedText: '#991b1b', optionBg: '#450a0a', optionText: '#fecaca', optionMuted: '#ef4444', handleColor: '#f87171' },
        handoff:  { bg: '#1c1000', border: '#92400e', selectedBorder: '#fbbf24', shadow: '#fbbf2433', headerBg: '#b45309', headerText: '#fef3c7', bodyText: '#fcd34d', mutedText: '#92400e', optionBg: '', optionText: '', optionMuted: '', handleColor: '#fbbf24' },
        end:      { bg: '#1e293b', border: '#334155', selectedBorder: '#94a3b8', shadow: '#94a3b833', headerBg: '#334155', headerText: '#e2e8f0', bodyText: '#94a3b8', mutedText: '#334155', optionBg: '', optionText: '', optionMuted: '', handleColor: '#94a3b8' },
    },
};

const HANDLE_LABELS: Record<string, string> = {
    open:    'Aberto',
    closed:  'Fechado',
    success: 'Sucesso',
    failure: 'Falha',
};

function edgeLabel(edge: Edge, nodes: Node<FlowNodeData>[]): string {
    const src = nodes.find(n => n.id === edge.source);
    const tgt = nodes.find(n => n.id === edge.target);
    const srcType = src?.type as FlowNodeType | undefined;
    const tgtType = tgt?.type as FlowNodeType | undefined;
    const srcLabel = srcType ? NODE_LABELS[srcType] : edge.source;
    const tgtLabel = tgtType ? NODE_LABELS[tgtType] : edge.target;

    let handle = '';
    if (edge.sourceHandle) {
        if (HANDLE_LABELS[edge.sourceHandle]) {
            handle = ` · ${HANDLE_LABELS[edge.sourceHandle]}`;
        } else {
            const opt = src?.data?.options?.find(o => o.id === edge.sourceHandle);
            if (opt?.label) handle = ` · ${opt.label}`;
        }
    }

    return `${srcLabel}${handle} → ${tgtLabel}`;
}

const NODE_LABELS: Record<FlowNodeType, string> = {
    start:    'Início',
    message:  'Mensagem',
    question: 'Pergunta',
    ixc_action: 'Ação IXC',
    business_hours_check: 'Horário de atendimento',
    handoff:  'Atendente',
    end:      'Encerrar',
};

const IXC_ACTION_LABELS: Record<NonNullable<FlowNodeData['action']>, string> = {
    invoice_second_copy: 'Segunda via',
    trust_unlock: 'Desbloqueio',
};

// Estimated rendered dimensions per type (used by dagre layout)
const NODE_SIZES: Record<FlowNodeType, { w: number; h: number }> = {
    start:    { w: 180, h:  58 },
    message:  { w: 240, h:  90 },
    question: { w: 240, h: 130 },
    ixc_action: { w: 240, h: 108 },
    business_hours_check: { w: 240, h: 108 },
    handoff:  { w: 200, h:  68 },
    end:      { w: 180, h:  58 },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _nodeCounter = 0;
const newId = (prefix = 'n') => `${prefix}_${++_nodeCounter}_${Math.random().toString(36).slice(2, 6)}`;

const defaultData = (type: FlowNodeType): FlowNodeData => {
    if (type === 'question') return { message: '', options: [{ id: newId('opt'), label: '' }] };
    if (type === 'ixc_action') return { action: 'invoice_second_copy' };
    if (type === 'business_hours_check') return { hours_scope: 'conversation', sector_id: null, sector_name: '' };
    if (type === 'handoff') return { sector_id: null, sector_name: '' };
    return { message: '' };
};

const initialStartNode = (): Node<FlowNodeData> => ({
    id: newId('start'),
    type: 'start',
    position: { x: 60, y: 180 },
    data: {},
});

// ---------------------------------------------------------------------------
// Shared node shell
// ---------------------------------------------------------------------------

function useColors(type: FlowNodeType) {
    const dark = useContext(DarkCtx);
    return PALETTE[dark ? 'dark' : 'light'][type];
}

function nodeShell(c: NodeColors, selected: boolean): React.CSSProperties {
    return {
        background:   c.bg,
        border:       `2px solid ${selected ? c.selectedBorder : c.border}`,
        borderRadius: 10,
        minWidth:     180,
        boxShadow:    selected ? `0 0 0 3px ${c.shadow}` : '0 2px 8px rgba(0,0,0,.25)',
        fontFamily:   'inherit',
        overflow:     'hidden',
    };
}

function NodeHeader({ type, c }: { type: FlowNodeType; c: NodeColors }) {
    return (
        <div style={{
            background:     c.headerBg,
            color:          c.headerText,
            borderRadius:   '8px 8px 0 0',
            fontSize:       10,
            fontWeight:     700,
            letterSpacing:  '0.06em',
            padding:        '4px 10px',
            textTransform:  'uppercase',
        }}>
            {NODE_LABELS[type]}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Custom Nodes
// ---------------------------------------------------------------------------

const StartNode = memo(({ selected }: NodeProps) => {
    const c = useColors('start');
    return (
        <div style={nodeShell(c, selected ?? false)}>
            <NodeHeader type="start" c={c} />
            <div style={{ padding: '8px 10px', fontSize: 12, color: c.bodyText }}>
                Início do fluxo
            </div>
            <Handle type="source" position={Position.Right} style={{ background: c.handleColor, border: 'none' }} />
        </div>
    );
});
StartNode.displayName = 'StartNode';

const MessageNode = memo(({ data, selected }: NodeProps<FlowNodeData>) => {
    const c = useColors('message');
    return (
        <div style={nodeShell(c, selected ?? false)}>
            <NodeHeader type="message" c={c} />
            <Handle type="target" position={Position.Left} style={{ background: c.handleColor, border: 'none' }} />
            <div style={{ padding: '8px 10px', fontSize: 12, color: c.bodyText, maxWidth: 220, wordBreak: 'break-word' }}>
                {data.message
                    ? <span style={{ whiteSpace: 'pre-wrap' }}>{data.message.slice(0, 120)}{data.message.length > 120 ? '…' : ''}</span>
                    : <span style={{ color: c.mutedText, fontStyle: 'italic' }}>Sem texto</span>
                }
            </div>
            <Handle type="source" position={Position.Right} style={{ background: c.handleColor, border: 'none' }} />
        </div>
    );
});
MessageNode.displayName = 'MessageNode';

const QuestionNode = memo(({ data, selected }: NodeProps<FlowNodeData>) => {
    const c = useColors('question');
    const options = data.options ?? [];
    return (
        <div style={nodeShell(c, selected ?? false)}>
            <NodeHeader type="question" c={c} />
            <Handle type="target" position={Position.Left} style={{ background: c.handleColor, border: 'none' }} />
            <div style={{ padding: '8px 10px', fontSize: 12, color: c.bodyText }}>
                {data.message
                    ? <span style={{ whiteSpace: 'pre-wrap' }}>{data.message.slice(0, 100)}{data.message.length > 100 ? '…' : ''}</span>
                    : <span style={{ color: c.mutedText, fontStyle: 'italic' }}>Sem texto</span>
                }
            </div>
            <div style={{ padding: '0 10px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {options.map((opt, i) => (
                    <div
                        key={opt.id}
                        style={{
                            position:     'relative',
                            background:   c.optionBg,
                            border:       `1px solid ${c.border}`,
                            borderRadius: 6,
                            padding:      '3px 28px 3px 8px',
                            fontSize:     11,
                            color:        c.optionText || c.bodyText,
                            fontWeight:   500,
                        }}
                    >
                        {opt.label || <em style={{ color: c.optionMuted || c.mutedText }}>Opção {i + 1}</em>}
                        <Handle
                            type="source"
                            position={Position.Right}
                            id={opt.id}
                            style={{ background: c.handleColor, border: 'none', right: -8, top: '50%', transform: 'translateY(-50%)', position: 'absolute' }}
                        />
                    </div>
                ))}
                {options.length === 0 && (
                    <span style={{ fontSize: 11, color: c.mutedText, fontStyle: 'italic' }}>Sem opções</span>
                )}
            </div>
        </div>
    );
});
QuestionNode.displayName = 'QuestionNode';

const IxcActionNode = memo(({ data, selected }: NodeProps<FlowNodeData>) => {
    const c = useColors('ixc_action');
    const action = data.action ?? 'invoice_second_copy';

    return (
        <div style={nodeShell(c, selected ?? false)}>
            <NodeHeader type="ixc_action" c={c} />
            <Handle type="target" position={Position.Left} style={{ background: c.handleColor, border: 'none' }} />
            <div style={{ padding: '8px 10px', fontSize: 12, color: c.bodyText, maxWidth: 220 }}>
                <strong>{IXC_ACTION_LABELS[action]}</strong>
                <div style={{ marginTop: 4, color: c.mutedText, fontSize: 11 }}>
                    CPF/CNPJ, vínculo e contrato
                </div>
            </div>
            <div style={{ padding: '0 10px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {[
                    ['success', 'Sucesso'],
                    ['failure', 'Falha'],
                ].map(([id, label]) => (
                    <div
                        key={id}
                        style={{
                            position: 'relative',
                            background: c.optionBg,
                            border: `1px solid ${c.border}`,
                            borderRadius: 6,
                            padding: '3px 28px 3px 8px',
                            fontSize: 11,
                            color: c.optionText,
                            fontWeight: 500,
                        }}
                    >
                        {label}
                        <Handle
                            type="source"
                            position={Position.Right}
                            id={id}
                            style={{ background: c.handleColor, border: 'none', right: -8, top: '50%', transform: 'translateY(-50%)', position: 'absolute' }}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
});
IxcActionNode.displayName = 'IxcActionNode';

function hoursScopeLabel(data: FlowNodeData): string {
    const scope = data.hours_scope ?? (data.sector_id != null ? 'sector' : 'conversation');
    if (scope === 'global') return 'Padrão';
    if (scope === 'conversation') return 'Setor da conversa';
    return data.sector_name || 'Setor';
}

function hoursSelectValue(data: FlowNodeData): string {
    const scope = data.hours_scope ?? (data.sector_id != null ? 'sector' : 'conversation');
    if (scope === 'global') return '__global__';
    if (scope === 'conversation') return '__conversation__';
    return String(data.sector_id);
}

const BusinessHoursCheckNode = memo(({ data, selected }: NodeProps<FlowNodeData>) => {
    const c = useColors('business_hours_check');
    const label = hoursScopeLabel(data);

    return (
        <div style={nodeShell(c, selected ?? false)}>
            <NodeHeader type="business_hours_check" c={c} />
            <Handle type="target" position={Position.Left} style={{ background: c.handleColor, border: 'none' }} />
            <div style={{ padding: '8px 10px', fontSize: 12, color: c.bodyText, maxWidth: 220 }}>
                <strong>{label}</strong>
            </div>
            <div style={{ padding: '0 10px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {[
                    ['open', 'Aberto'],
                    ['closed', 'Fechado'],
                ].map(([id, label]) => (
                    <div
                        key={id}
                        style={{
                            position: 'relative',
                            background: c.optionBg,
                            border: `1px solid ${c.border}`,
                            borderRadius: 6,
                            padding: '3px 28px 3px 8px',
                            fontSize: 11,
                            color: c.optionText,
                            fontWeight: 500,
                        }}
                    >
                        {label}
                        <Handle
                            type="source"
                            position={Position.Right}
                            id={id}
                            style={{ background: c.handleColor, border: 'none', right: -8, top: '50%', transform: 'translateY(-50%)', position: 'absolute' }}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
});
BusinessHoursCheckNode.displayName = 'BusinessHoursCheckNode';

const HandoffNode = memo(({ data, selected }: NodeProps<FlowNodeData>) => {
    const c = useColors('handoff');
    return (
        <div style={nodeShell(c, selected ?? false)}>
            <NodeHeader type="handoff" c={c} />
            <Handle type="target" position={Position.Left} style={{ background: c.handleColor, border: 'none' }} />
            <div style={{ padding: '8px 10px', fontSize: 12, color: c.bodyText }}>
                {data.sector_name
                    ? <>Setor: <strong>{data.sector_name}</strong></>
                    : <span style={{ color: c.mutedText, fontStyle: 'italic' }}>Fila geral</span>
                }
            </div>
        </div>
    );
});
HandoffNode.displayName = 'HandoffNode';

const EndNode = memo(({ selected }: NodeProps) => {
    const c = useColors('end');
    return (
        <div style={nodeShell(c, selected ?? false)}>
            <NodeHeader type="end" c={c} />
            <Handle type="target" position={Position.Left} style={{ background: c.handleColor, border: 'none' }} />
            <div style={{ padding: '8px 10px', fontSize: 12, color: c.bodyText }}>
                Encerra a conversa
            </div>
        </div>
    );
});
EndNode.displayName = 'EndNode';

const nodeTypes = {
    start:    StartNode,
    message:  MessageNode,
    question: QuestionNode,
    ixc_action: IxcActionNode,
    business_hours_check: BusinessHoursCheckNode,
    handoff:  HandoffNode,
    end:      EndNode,
};

// ---------------------------------------------------------------------------
// Side panels
// ---------------------------------------------------------------------------

function EmptyPanel() {
    return (
        <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-ink/40">
            <p>Selecione um nó ou uma ligação para editá-la</p>
            <p className="text-xs text-ink/30">Clique na linha entre dois nós para remover a ligação</p>
        </div>
    );
}

interface EdgePanelProps {
    edge: Edge;
    nodes: Node<FlowNodeData>[];
    onDelete: (id: string) => void;
}

function EdgePanel({ edge, nodes, onDelete }: EdgePanelProps) {
    return (
        <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-ink/[0.08] px-4 py-3">
                <span className="text-sm font-semibold text-ink/70">Ligação</span>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-red-400 hover:text-red-600"
                    onClick={() => onDelete(edge.id)}
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </Button>
            </div>
            <div className="flex-1 space-y-4 p-4">
                <p className="text-sm font-medium text-ink/80">{edgeLabel(edge, nodes)}</p>
                <p className="text-xs text-ink/45">
                    Remove apenas a conexão entre os nós. Os nós permanecem no fluxo.
                </p>
                <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900/50 dark:hover:bg-red-950/40"
                    onClick={() => onDelete(edge.id)}
                >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Remover ligação
                </Button>
                <p className="text-[10px] text-ink/35">Atalho: Delete ou Backspace</p>
            </div>
        </div>
    );
}

interface ConfigPanelProps {
    node: Node<FlowNodeData>;
    sectors: Sector[];
    onChange: (id: string, data: FlowNodeData) => void;
    onDelete: (id: string) => void;
}

function ConfigPanel({ node, sectors, onChange, onDelete }: ConfigPanelProps) {
    const dark = useContext(DarkCtx);

    const type = node.type as FlowNodeType;
    const data = node.data;
    const pal  = PALETTE[dark ? 'dark' : 'light'][type];

    const set = (patch: Partial<FlowNodeData>) => onChange(node.id, { ...data, ...patch });

    const addOption = () =>
        set({ options: [...(data.options ?? []), { id: newId('opt'), label: '' }] });

    const removeOption = (optId: string) =>
        set({ options: (data.options ?? []).filter(o => o.id !== optId) });

    const updateOption = (optId: string, label: string) =>
        set({ options: (data.options ?? []).map(o => o.id === optId ? { ...o, label } : o) });

    return (
        <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-ink/[0.08] px-4 py-3">
                <span className="text-sm font-semibold" style={{ color: pal.selectedBorder }}>
                    {NODE_LABELS[type]}
                </span>
                {type !== 'start' && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-400 hover:text-red-600"
                        onClick={() => onDelete(node.id)}
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                )}
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-4">
                {type === 'start' && (
                    <p className="text-xs text-ink/50">
                        Ponto de entrada do fluxo. Conecte ao próximo nó abaixo.
                    </p>
                )}

                {type === 'message' && (
                    <div className="space-y-1.5">
                        <Label className="text-xs">Mensagem</Label>
                        <Textarea
                            value={data.message ?? ''}
                            onChange={e => set({ message: e.target.value })}
                            placeholder="Digite a mensagem que será enviada..."
                            rows={5}
                            className="resize-none text-sm"
                        />
                        <p className="text-[10px] text-ink/40">Use {'{{nome}}'} para o nome do cliente.</p>
                    </div>
                )}

                {type === 'question' && (
                    <>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Mensagem / pergunta</Label>
                            <Textarea
                                value={data.message ?? ''}
                                onChange={e => set({ message: e.target.value })}
                                placeholder="Ex: Com qual setor deseja falar?"
                                rows={3}
                                className="resize-none text-sm"
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs">Opções (botões)</Label>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-6 px-2 text-[11px]"
                                    onClick={addOption}
                                    disabled={(data.options?.length ?? 0) >= 10}
                                >
                                    <Plus className="mr-1 h-3 w-3" />
                                    Adicionar
                                </Button>
                            </div>
                            {(data.options ?? []).map((opt, i) => (
                                <div key={opt.id} className="flex items-center gap-1.5">
                                    <span className="w-4 shrink-0 text-center text-[10px] text-ink/40">{i + 1}</span>
                                    <Input
                                        value={opt.label}
                                        onChange={e => updateOption(opt.id, e.target.value)}
                                        placeholder={`Opção ${i + 1}`}
                                        className="h-7 text-xs"
                                        maxLength={24}
                                    />
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 shrink-0 text-ink/30 hover:text-red-500"
                                        onClick={() => removeOption(opt.id)}
                                        disabled={(data.options?.length ?? 0) <= 1}
                                    >
                                        <X className="h-3 w-3" />
                                    </Button>
                                </div>
                            ))}
                            <p className="text-[10px] text-ink/40">
                                ≤3 opções → botões; 4–10 → lista. Conecte cada alça a um nó.
                            </p>
                        </div>

                        <div className="space-y-3 rounded-md border border-ink/10 bg-ink/[0.02] p-3">
                            <p className="text-[11px] font-semibold text-ink/50 uppercase tracking-wide">Respostas inválidas</p>

                            <div className="space-y-1.5">
                                <Label className="text-xs">Tentativas antes do handoff</Label>
                                <Input
                                    type="number"
                                    min={1}
                                    max={10}
                                    value={data.max_retries ?? 3}
                                    onChange={e => set({ max_retries: Math.max(1, parseInt(e.target.value) || 3) })}
                                    className="h-7 text-xs"
                                />
                                <p className="text-[10px] text-ink/40">Inclui áudio, figurinha e texto fora das opções.</p>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs">
                                    Mensagem em cada erro{' '}
                                    <span className="text-ink/40">(opcional)</span>
                                </Label>
                                <Textarea
                                    value={data.retry_message ?? ''}
                                    onChange={e => set({ retry_message: e.target.value })}
                                    placeholder="Por favor, escolha uma das opções acima."
                                    rows={2}
                                    className="resize-none text-xs"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs">Setor ao esgotar tentativas</Label>
                                <Select
                                    value={data.fallback_sector_id != null ? String(data.fallback_sector_id) : '__none__'}
                                    onValueChange={val =>
                                        set({ fallback_sector_id: val === '__none__' ? null : Number(val) })
                                    }
                                >
                                    <SelectTrigger className="h-8 text-xs">
                                        <SelectValue placeholder="Fila geral (sem setor)" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__none__">Fila geral (sem setor)</SelectItem>
                                        {sectors.map(s => (
                                            <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs">
                                    Mensagem antes do handoff{' '}
                                    <span className="text-ink/40">(opcional)</span>
                                </Label>
                                <Textarea
                                    value={data.fallback_message ?? ''}
                                    onChange={e => set({ fallback_message: e.target.value })}
                                    placeholder="Vou te transferir para um de nossos atendentes..."
                                    rows={2}
                                    className="resize-none text-xs"
                                />
                            </div>
                        </div>
                    </>
                )}

                {type === 'ixc_action' && (
                    <>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Ação</Label>
                            <Select
                                value={data.action ?? 'invoice_second_copy'}
                                onValueChange={val => set({ action: val as FlowNodeData['action'] })}
                            >
                                <SelectTrigger className="h-8 text-sm">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="invoice_second_copy">Segunda via de boleto</SelectItem>
                                    <SelectItem value="trust_unlock">Desbloqueio de confiança</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs">Mensagem de confirmação</Label>
                            <Textarea
                                value={data.confirm_message ?? ''}
                                onChange={e => set({ confirm_message: e.target.value })}
                                placeholder="O CPF/CNPJ cadastrado continua sendo o documento deste atendimento?"
                                rows={3}
                                className="resize-none text-sm"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs">Mensagem para pedir documento</Label>
                            <Textarea
                                value={data.document_message ?? ''}
                                onChange={e => set({ document_message: e.target.value })}
                                placeholder="Informe o CPF ou CNPJ do titular para continuar."
                                rows={3}
                                className="resize-none text-sm"
                            />
                        </div>

                        <p className="text-[10px] text-ink/40">
                            Conecte as saídas Sucesso e Falha para continuar o fluxo.
                        </p>
                    </>
                )}

                {type === 'business_hours_check' && (
                    <>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Horário a verificar</Label>
                            <Select
                                value={hoursSelectValue(data)}
                                onValueChange={val => {
                                    if (val === '__global__') {
                                        set({ hours_scope: 'global', sector_id: null, sector_name: 'Padrão' });
                                    } else if (val === '__conversation__') {
                                        set({ hours_scope: 'conversation', sector_id: null, sector_name: '' });
                                    } else {
                                        const s = sectors.find(s => String(s.id) === val);
                                        set({ hours_scope: 'sector', sector_id: Number(val), sector_name: s?.name ?? '' });
                                    }
                                }}
                            >
                                <SelectTrigger className="h-8 text-sm">
                                    <SelectValue placeholder="Setor da conversa" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__conversation__">Setor da conversa</SelectItem>
                                    <SelectItem value="__global__">Padrão</SelectItem>
                                    {sectors.map(s => (
                                        <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <p className="text-[10px] text-ink/40">
                            Padrão usa a aba Padrão em Horários. Setor da conversa segue o setor atribuído ao atendimento.
                        </p>
                    </>
                )}

                {type === 'handoff' && (
                    <div className="space-y-1.5">
                        <Label className="text-xs">Setor de destino</Label>
                        <Select
                            value={data.sector_id != null ? String(data.sector_id) : '__none__'}
                            onValueChange={val => {
                                if (val === '__none__') {
                                    set({ sector_id: null, sector_name: '' });
                                } else {
                                    const s = sectors.find(s => String(s.id) === val);
                                    set({ sector_id: Number(val), sector_name: s?.name ?? '' });
                                }
                            }}
                        >
                            <SelectTrigger className="h-8 text-sm">
                                <SelectValue placeholder="Fila geral (sem setor)" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__none__">Fila geral (sem setor)</SelectItem>
                                {sectors.map(s => (
                                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-[10px] text-ink/40">
                            A conversa vai para a fila desse setor.
                        </p>
                    </div>
                )}

                {type === 'end' && (
                    <p className="text-xs text-ink/50">
                        A conversa é encerrada ao atingir este nó.
                    </p>
                )}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Palette button
// ---------------------------------------------------------------------------

function PaletteItem({ type, dark, onClick }: { type: FlowNodeType; dark: boolean; onClick: () => void }) {
    const c = PALETTE[dark ? 'dark' : 'light'][type];
    return (
        <button
            type="button"
            onClick={onClick}
            className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold transition hover:opacity-80 active:scale-95"
            style={{ border: `1.5px solid ${c.border}`, background: c.bg, color: c.selectedBorder }}
        >
            + {NODE_LABELS[type]}
        </button>
    );
}

// ---------------------------------------------------------------------------
// Main Editor
// ---------------------------------------------------------------------------

export default function FlowEditor({ flow, sectors }: Props) {
    const { theme } = useTheme();
    const dark = theme === 'dark';

    const [nodes, setNodes, onNodesChange] = useNodesState<FlowNodeData>(
        (flow?.definition?.nodes?.length ? flow.definition.nodes : [initialStartNode()]) as Node<FlowNodeData>[],
    );
    const [edges, setEdges, onEdgesChange] = useEdgesState(flow?.definition?.edges ?? []);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
    const [flowName, setFlowName]             = useState(flow?.name ?? 'Novo fluxo');
    const [isActive, setIsActive]             = useState(flow?.is_active ?? false);
    const [isDefault, setIsDefault]           = useState(flow?.is_default ?? false);
    const [saving, setSaving]                 = useState(false);
    const rfInstance   = useRef<ReactFlowInstance | null>(null);
    const canvasRef    = useRef<HTMLDivElement | null>(null);
    const addNodeOffset = useRef(0);

    const onConnect = useCallback(
        (connection: Connection) => setEdges(eds => addEdge({ ...connection, animated: false }, eds)),
        [setEdges],
    );

    const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
        setSelectedNodeId(node.id);
        setSelectedEdgeId(null);
    }, []);

    const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
        setSelectedEdgeId(edge.id);
        setSelectedNodeId(null);
    }, []);

    const onPaneClick = useCallback(() => {
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
    }, []);

    const deleteEdge = useCallback((edgeId: string) => {
        setEdges(eds => eds.filter(e => e.id !== edgeId));
        setSelectedEdgeId(null);
    }, [setEdges]);

    const onEdgesDelete = useCallback((deleted: Edge[]) => {
        if (deleted.some(e => e.id === selectedEdgeId)) {
            setSelectedEdgeId(null);
        }
    }, [selectedEdgeId]);

    const addNode = useCallback((type: FlowNodeType) => {
        const id = newId(type);
        const size = NODE_SIZES[type];
        let position = { x: 300, y: 160 };

        const selected = selectedNodeId ? nodes.find(n => n.id === selectedNodeId) : null;
        if (selected) {
            const selectedSize = NODE_SIZES[(selected.type as FlowNodeType) ?? 'message'];
            position = {
                x: selected.position.x + selectedSize.w + 60,
                y: selected.position.y,
            };
        } else {
            const instance = rfInstance.current;
            const canvas = canvasRef.current;

            if (instance && canvas) {
                const bounds = canvas.getBoundingClientRect();
                const center = instance.screenToFlowPosition({
                    x: bounds.left + bounds.width / 2,
                    y: bounds.top + bounds.height / 2,
                });
                const offset = addNodeOffset.current;
                position = {
                    x: center.x - size.w / 2 + (offset % 3) * 28,
                    y: center.y - size.h / 2 + Math.floor(offset / 3) * 28,
                };
                addNodeOffset.current += 1;
            } else if (nodes.length > 0) {
                const rightmost = nodes.reduce((best, n) =>
                    n.position.x > best.position.x ? n : best, nodes[0]);
                const rightSize = NODE_SIZES[(rightmost.type as FlowNodeType) ?? 'message'];
                position = {
                    x: rightmost.position.x + rightSize.w + 80,
                    y: rightmost.position.y,
                };
            }
        }

        setNodes(nds => [...nds, { id, type, position, data: defaultData(type) }]);
        setSelectedNodeId(id);
        setSelectedEdgeId(null);
    }, [nodes, selectedNodeId, setNodes]);

    const updateNodeData = (nodeId: string, data: FlowNodeData) => {
        setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data } : n));
        const node = nodes.find(n => n.id === nodeId);
        if (node?.type === 'question') {
            const valid = new Set((data.options ?? []).map(o => o.id));
            setEdges(eds => eds.filter(e =>
                e.source !== nodeId || e.sourceHandle == null || valid.has(e.sourceHandle),
            ));
        }
    };

    const deleteNode = (nodeId: string) => {
        setNodes(nds => nds.filter(n => n.id !== nodeId));
        setEdges(eds => eds.filter(e => e.source !== nodeId && e.target !== nodeId));
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
    };

    const autoLayout = useCallback(() => {
        if (nodes.length === 0) return;

        // 1. Detect back-edges (cycle-forming edges) via DFS so they are excluded
        //    from Dagre — ReactFlow still draws them as curved back-arrows.
        const visitState = new Map<string, 0 | 1 | 2>(); // 0=unvisited 1=visiting 2=done
        for (const n of nodes) visitState.set(n.id, 0);
        const backEdgeIds = new Set<string>();
        const dfs = (id: string) => {
            visitState.set(id, 1);
            for (const e of edges) {
                if (e.source !== id) continue;
                const s = visitState.get(e.target) ?? 0;
                if (s === 1) backEdgeIds.add(e.id);
                else if (s === 0) dfs(e.target);
            }
            visitState.set(id, 2);
        };
        for (const n of nodes) if (visitState.get(n.id) === 0) dfs(n.id);
        const forwardEdges = edges.filter(e => !backEdgeIds.has(e.id));

        // 2. Build option-sorted adjacency so question options stay in order top-to-bottom
        const optOrderMap = new Map<string, Map<string, number>>();
        for (const n of nodes) {
            if (n.type === 'question' && Array.isArray(n.data.options)) {
                const m = new Map<string, number>();
                (n.data.options as QuestionOption[]).forEach((o, i) => m.set(o.id, i));
                optOrderMap.set(n.id, m);
            }
            if (n.type === 'business_hours_check') {
                optOrderMap.set(n.id, new Map([['open', 0], ['closed', 1]]));
            }
        }
        const sortedAdj = new Map<string, string[]>();
        for (const n of nodes) {
            const om = optOrderMap.get(n.id);
            const out = forwardEdges
                .filter(e => e.source === n.id)
                .sort((a, b) => om
                    ? (om.get(a.sourceHandle ?? '') ?? 999) - (om.get(b.sourceHandle ?? '') ?? 999)
                    : 0);
            sortedAdj.set(n.id, out.map(e => e.target));
        }

        // 3. BFS from start so Dagre receives nodes in top-to-bottom traversal order
        //    (insertion order is used as initial rank hint by Dagre's crossing minimiser)
        const startId = nodes.find(n => n.type === 'start')?.id;
        const insertOrder: string[] = [];
        const enqueued = new Set<string>();
        const bfsQ: string[] = [];
        if (startId) { bfsQ.push(startId); enqueued.add(startId); }
        while (bfsQ.length > 0) {
            const id = bfsQ.shift()!;
            insertOrder.push(id);
            for (const c of sortedAdj.get(id) ?? []) {
                if (!enqueued.has(c)) { enqueued.add(c); bfsQ.push(c); }
            }
        }
        for (const n of nodes) if (!enqueued.has(n.id)) insertOrder.push(n.id);

        // Dynamic height: question nodes grow with option count
        const nodeHeight = (n: typeof nodes[number]) => {
            if (n.type === 'question') {
                const opts = Array.isArray(n.data.options) ? (n.data.options as QuestionOption[]).length : 1;
                return 88 + opts * 34;
            }
            return NODE_SIZES[(n.type as FlowNodeType) ?? 'message'].h;
        };

        // 4. Build and run Dagre on the acyclic subgraph
        const g = new dagre.graphlib.Graph();
        g.setDefaultEdgeLabel(() => ({}));
        g.setGraph({ rankdir: 'LR', nodesep: 60, ranksep: 80, marginx: 40, marginy: 40 });

        const nodeMap = new Map(nodes.map(n => [n.id, n]));
        for (const id of insertOrder) {
            const n = nodeMap.get(id);
            if (!n) continue;
            g.setNode(id, { width: NODE_SIZES[(n.type as FlowNodeType) ?? 'message'].w, height: nodeHeight(n) });
        }
        for (const e of forwardEdges) {
            if (g.hasNode(e.source) && g.hasNode(e.target)) g.setEdge(e.source, e.target);
        }

        dagre.layout(g);

        setNodes(nds => nds.map(n => {
            const pos = g.node(n.id);
            if (!pos) return n;
            const w = NODE_SIZES[(n.type as FlowNodeType) ?? 'message'].w;
            const h = nodeHeight(n);
            return { ...n, position: { x: pos.x - w / 2, y: pos.y - h / 2 } };
        }));

        setTimeout(() => rfInstance.current?.fitView({ padding: 0.15, duration: 400 }), 50);
    }, [nodes, edges, setNodes]);

    const handleSave = () => {
        setSaving(true);
        const definition = JSON.stringify({
            nodes: nodes.map(n => ({ id: n.id, type: n.type, position: n.position, data: n.data })),
            edges: edges.map(e => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle ?? null, targetHandle: e.targetHandle ?? null })),
        });
        const payload = {
            name:           flowName,
            description:    flow?.description ?? null,
            definition_raw: definition,
            is_active:      isActive,
            is_default:     isDefault,
        };
        if (flow) {
            router.put(route('flows.update', flow.id), payload, { preserveScroll: true, onFinish: () => setSaving(false) });
        } else {
            router.post(route('flows.store'), payload, { onFinish: () => setSaving(false) });
        }
    };

    const selectedNode = nodes.find(n => n.id === selectedNodeId) ?? null;
    const selectedEdge = edges.find(e => e.id === selectedEdgeId) ?? null;

    // Canvas colours that match the theme
    const canvasBg     = dark ? '#0d1117' : '#f1f5f9';
    const dotColor     = dark ? '#ffffff' : '#000000';
    const miniMapBg    = dark ? '#161b22' : '#e2e8f0';
    const miniMapMask  = dark ? '#0d1117cc' : '#f1f5f9cc';

    return (
        <AuthenticatedLayout>
            <Head title={flow ? `Editar: ${flow.name}` : 'Novo Fluxo'} />

            <DarkCtx.Provider value={dark}>
                <div className="flex h-full flex-col">

                    {/* ── Top bar ── */}
                    <div className="flex shrink-0 items-center gap-3 border-b border-ink/[0.08] px-4 py-2.5">
                        <Link href={route('flows.index')}>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                        </Link>

                        <Input
                            value={flowName}
                            onChange={e => setFlowName(e.target.value)}
                            className="h-8 max-w-xs text-sm font-semibold"
                            placeholder="Nome do fluxo"
                        />

                        <div className="ml-auto flex items-center gap-4">
                            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink/60">
                                <Switch
                                    checked={isDefault}
                                    onCheckedChange={v => { setIsDefault(v); if (v) setIsActive(true); }}
                                />
                                Padrão
                            </label>
                            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink/60">
                                <Switch checked={isActive} onCheckedChange={setIsActive} />
                                Ativo
                            </label>
                            <Button size="sm" onClick={handleSave} disabled={saving || !flowName.trim()}>
                                <Save className="mr-1.5 h-3.5 w-3.5" />
                                {saving ? 'Salvando…' : 'Salvar'}
                            </Button>
                        </div>
                    </div>

                    {/* ── Editor body ── */}
                    <div className="flex min-h-0 flex-1">

                        {/* Left palette */}
                        <div className="flex w-40 shrink-0 flex-col gap-2 border-r border-ink/[0.08] p-3">
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-ink/40">Nós</p>
                            {(['message', 'question', 'ixc_action', 'business_hours_check', 'handoff', 'end'] as FlowNodeType[]).map(type => (
                                <PaletteItem key={type} type={type} dark={dark} onClick={() => addNode(type)} />
                            ))}
                            <div className="mt-1 border-t border-ink/[0.08] pt-2">
                                <button
                                    type="button"
                                    onClick={autoLayout}
                                    className="flex w-full items-center gap-1.5 rounded-lg px-3 py-2 text-left text-xs font-semibold transition hover:opacity-80 active:scale-95 text-ink/60 border border-ink/[0.12] bg-transparent"
                                    title="Organizar nós automaticamente"
                                >
                                    <LayoutGrid className="h-3.5 w-3.5 shrink-0" />
                                    Organizar
                                </button>
                            </div>
                        </div>

                        {/* Canvas */}
                        <div ref={canvasRef} className="flow-editor-canvas min-w-0 flex-1" style={{ background: canvasBg }}>
                            <style>{`
                                .flow-editor-canvas .react-flow__edge.selected .react-flow__edge-path {
                                    stroke: ${dark ? '#60a5fa' : '#2563eb'};
                                    stroke-width: 2.5;
                                }
                            `}</style>
                            <ReactFlow
                                nodes={nodes.map(n => ({ ...n, deletable: false }))}
                                edges={edges}
                                onNodesChange={onNodesChange}
                                onEdgesChange={onEdgesChange}
                                onConnect={onConnect}
                                onNodeClick={onNodeClick}
                                onEdgeClick={onEdgeClick}
                                onPaneClick={onPaneClick}
                                onEdgesDelete={onEdgesDelete}
                                nodeTypes={nodeTypes}
                                onInit={instance => { rfInstance.current = instance; }}
                                fitView
                                edgesFocusable
                                deleteKeyCode={['Delete', 'Backspace']}
                                defaultEdgeOptions={{
                                    interactionWidth: 24,
                                    deletable: true,
                                    style: { strokeWidth: 1.5 },
                                }}
                                proOptions={{ hideAttribution: true }}
                            >
                                <Background
                                    gap={20}
                                    size={1}
                                    color={dotColor}
                                    style={{ opacity: dark ? 0.08 : 0.12 }}
                                />
                                <Controls
                                    style={{
                                        background: dark ? '#1e293b' : '#fff',
                                        border: dark ? '1px solid #334155' : '1px solid #e2e8f0',
                                        borderRadius: 8,
                                    }}
                                />
                                <MiniMap
                                    zoomable
                                    pannable
                                    style={{ height: 80, background: miniMapBg }}
                                    maskColor={miniMapMask}
                                />
                            </ReactFlow>
                        </div>

                        {/* Right config panel */}
                        <div className="w-72 shrink-0 border-l border-ink/[0.08]">
                            {selectedEdge ? (
                                <EdgePanel
                                    edge={selectedEdge}
                                    nodes={nodes}
                                    onDelete={deleteEdge}
                                />
                            ) : selectedNode ? (
                                <ConfigPanel
                                    node={selectedNode}
                                    sectors={sectors}
                                    onChange={updateNodeData}
                                    onDelete={deleteNode}
                                />
                            ) : (
                                <EmptyPanel />
                            )}
                        </div>
                    </div>
                </div>
            </DarkCtx.Provider>
        </AuthenticatedLayout>
    );
}
