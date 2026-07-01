import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/Components/ui/card';
import { useColorTheme } from '@/hooks/useColorTheme';
import { COLOR_THEME_OPTIONS } from '@/lib/colorThemes';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

const LIGHT_CHECK_IDS = new Set(['yellow', 'graphite', 'amber', 'lime']);

export default function UpdateAppearanceForm({
    className = '',
}: {
    className?: string;
}) {
    const { colorTheme, setColorTheme } = useColorTheme();
    const selectedLabel =
        COLOR_THEME_OPTIONS.find((option) => option.id === colorTheme)?.label ??
        'Verde';

    return (
        <Card className={className}>
            <CardHeader className="gap-1 p-5 pb-3 sm:p-6 sm:pb-4">
                <CardTitle className="text-base">Cor do tema</CardTitle>
                <CardDescription className="text-xs">
                    Salva automaticamente na sua conta.
                </CardDescription>
            </CardHeader>

            <CardContent className="p-5 pt-0 sm:p-6 sm:pt-0">
                <div
                    className="flex flex-wrap gap-2"
                    role="radiogroup"
                    aria-label="Cor do tema"
                >
                    {COLOR_THEME_OPTIONS.map((option) => {
                        const selected = colorTheme === option.id;

                        return (
                            <button
                                key={option.id}
                                type="button"
                                role="radio"
                                aria-checked={selected}
                                title={option.label}
                                onClick={() => setColorTheme(option.id)}
                                className={cn(
                                    'relative flex size-9 items-center justify-center rounded-full transition-all',
                                    'ring-1 ring-black/10 dark:ring-white/10',
                                    'hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
                                    selected &&
                                        'scale-105 ring-2 ring-accent ring-offset-2 ring-offset-canvas',
                                )}
                                style={{ backgroundColor: option.swatch }}
                            >
                                {selected && (
                                    <Check
                                        className={cn(
                                            'size-3.5 drop-shadow-sm',
                                            LIGHT_CHECK_IDS.has(option.id)
                                                ? 'text-black/80'
                                                : 'text-white',
                                        )}
                                        strokeWidth={3}
                                    />
                                )}
                            </button>
                        );
                    })}
                </div>

                <p className="mt-3 text-xs text-ink/45">
                    Selecionado:{' '}
                    <span className="font-medium text-ink/70">
                        {selectedLabel}
                    </span>
                </p>
            </CardContent>
        </Card>
    );
}