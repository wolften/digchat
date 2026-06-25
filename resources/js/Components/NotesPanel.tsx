import axios from 'axios';
import { Loader2, Save, StickyNote, X } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Props {
    contactId: number;
    initialNotes: string | null;
    onClose: () => void;
}

export default function NotesPanel({ contactId, initialNotes, onClose }: Props) {
    const [notes, setNotes] = useState(initialNotes ?? '');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState(false);

    useEffect(() => {
        setNotes(initialNotes ?? '');
        setSaved(false);
        setError(false);
    }, [contactId, initialNotes]);

    const save = async () => {
        setSaving(true);
        setSaved(false);
        setError(false);
        try {
            await axios.patch(route('contacts.notes.update', contactId), { notes });
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch {
            setError(true);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex w-72 shrink-0 flex-col border-l border-ink/[0.08] bg-canvas">
            <div className="flex min-h-12 items-center justify-between border-b border-ink/[0.08] px-3">
                <div className="flex items-center gap-2">
                    <StickyNote className="h-4 w-4 text-ink/50" />
                    <span className="text-sm font-semibold text-ink/80">Anotações</span>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="rounded p-1 text-ink/40 transition-colors hover:bg-ink/[0.06] hover:text-ink/70"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>

            <div className="flex flex-1 flex-col gap-2 p-3">
                <textarea
                    value={notes}
                    onChange={(e) => { setNotes(e.target.value); setSaved(false); setError(false); }}
                    placeholder="Escreva anotações sobre este cliente&#10;(visíveis para todos os atendentes)..."
                    className="scrollbar-thin min-h-[200px] flex-1 resize-none rounded-lg border border-ink/[0.10] bg-transparent p-2.5 text-sm text-ink outline-none placeholder:text-ink/35 focus:border-accent/40 focus:ring-1 focus:ring-accent/25"
                />

                <button
                    type="button"
                    onClick={save}
                    disabled={saving}
                    className="flex items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-black transition-opacity disabled:opacity-60 hover:opacity-90"
                >
                    {saving ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                        <Save className="h-3.5 w-3.5" />
                    )}
                    {saving ? 'Salvando…' : 'Salvar anotação'}
                </button>

                {saved && (
                    <p className="text-center text-xs text-emerald-500">Anotação salva com sucesso.</p>
                )}
                {error && (
                    <p className="text-center text-xs text-red-400">Erro ao salvar. Tente novamente.</p>
                )}
            </div>
        </div>
    );
}
