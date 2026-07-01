import { cn } from '@/lib/utils';

export interface BarChartItem {
    key: string;
    label: React.ReactNode;
    value: number;
    barClassName?: string;
}

interface HorizontalBarChartProps {
    items: BarChartItem[];
    emptyLabel?: string;
    valueClassName?: string;
}

export function HorizontalBarChart({
    items,
    emptyLabel = 'Sem dados no período.',
    valueClassName,
}: HorizontalBarChartProps) {
    if (items.length === 0) {
        return (
            <p className="py-4 text-center text-sm text-muted-foreground">{emptyLabel}</p>
        );
    }

    const max = Math.max(...items.map((i) => i.value), 1);

    return (
        <div className="space-y-3">
            {items.map((item) => (
                <div key={item.key} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="flex min-w-0 items-center gap-1.5 truncate font-medium">
                            {item.label}
                        </span>
                        <span className={cn('shrink-0 tabular-nums text-muted-foreground', valueClassName)}>
                            {item.value}
                        </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-ink/[0.08]">
                        <div
                            className={cn(
                                'h-full rounded-full bg-accent transition-all duration-500',
                                item.barClassName,
                            )}
                            style={{ width: `${Math.round((item.value / max) * 100)}%` }}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
}