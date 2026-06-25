import axios from 'axios';
import { Loader2, StickyNote, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface Props {
    contactId: number;
    initialNotes: string | null;
    onClose: () => void;
}

export default function NotesPanel({ contactId, initialNotes, onClose }: Props) {
    const [notes, setNotes] = useState(initialNotes ?? '');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastSavedRef = useRef(initialNotes ?? '');

    const save = useCallback(
        async (value: string) => {
            if (value === lastSavedRef.current) return;
            setSaving(true);
            setSaved(false);
            try {
                await axios.patch(route('contacts.notes.update', contactId), { notes: value });
                lastSavedRef.current = value;
                setSaved(true);
                setTimeout(() => setSaved(false), 2500);
            } catch {
                // silent — user can retry by typing again
            } finally {
                setSaving(false);
            }
        },
        [contactId],
    );

    const handleChange = (value: string) => {
        setNotes(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => save(value), 1500);
    };

    useEffect(() => {
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, []);

    return (
        <div className="flex w-72 shrink-0 flex-col border-l border-ink/[0.08] bg-canvas">
            <div className="flex min-h-12 items-center justify-between border-b border-ink/[0.08] px-3">
                <div className="flex items-center gap-2">
                    <StickyNote className="h-4 w-4 text-ink/50" />
                    <span className="text-sm font-semibold text-ink/80">Anotações</span>
                </div>
                <div className="flex items-center gap-2">
                    {saving && (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-ink/35" />
                    )}
                    {saved && !saving && (
                        <span className="text-xs text-emerald-500">Salvo</span>
                    )}
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded p-1 text-ink/40 transition-colors hover:bg-ink/[0.06] hover:text-ink/70"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            </div>

            <div className="flex flex-1 flex-col gap-2 p-3">
                <textarea
                    value={notes}
                    onChange={(e) => handleChange(e.target.value)}
                    placeholder="Escreva anotações sobre este cliente&#10;(visíveis para todos os atendentes)..."
                    className="scrollbar-thin min-h-[200px] flex-1 resize-none rounded-lg border border-ink/[0.10] bg-transparent p-2.5 text-sm text-ink outline-none placeholder:text-ink/35 focus:border-accent/40 focus:ring-1 focus:ring-accent/25"
                />
                <p className="text-[11px] text-ink/35">
                    Salvo automaticamente. Visível para todos os atendentes.
                </p>
            </div>
        </div>
    );
}
