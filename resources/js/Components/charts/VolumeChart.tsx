import { useState } from 'react';

export interface VolumeDataPoint {
    label: string;
    count: number;
}

interface VolumeChartProps {
    data: VolumeDataPoint[];
    emptyLabel?: string;
}

export function VolumeChart({ data, emptyLabel = 'Sem dados no período.' }: VolumeChartProps) {
    const [hovered, setHovered] = useState<number | null>(null);

    if (data.length === 0) {
        return (
            <div className="flex h-24 items-center justify-center text-sm text-muted-foreground sm:h-28">
                {emptyLabel}
            </div>
        );
    }

    const max = Math.max(...data.map((d) => d.count), 1);
    const total = data.length;
    const showEvery = total <= 7 ? 1 : total <= 14 ? 2 : total <= 24 ? 3 : 5;

    return (
        <div className="select-none space-y-1">
            <div className="flex h-24 items-end gap-px sm:h-28">
                {data.map((d, i) => {
                    const pct = d.count > 0 ? Math.max((d.count / max) * 100, 4) : 1;
                    const isHovered = hovered === i;
                    return (
                        <div
                            key={i}
                            className="relative flex h-full flex-1 cursor-default flex-col items-center justify-end"
                            onMouseEnter={() => setHovered(i)}
                            onMouseLeave={() => setHovered(null)}
                        >
                            {isHovered && d.count > 0 && (
                                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-[11px] font-semibold text-popover-foreground shadow-lg">
                                    {d.count} {d.count === 1 ? 'conversa' : 'conversas'}
                                </div>
                            )}
                            <div
                                className={`w-full rounded-t-[3px] transition-colors duration-100 ${
                                    isHovered ? 'bg-accent' : 'bg-accent/55'
                                } ${d.count === 0 ? 'opacity-20' : ''}`}
                                style={{ height: `${pct}%` }}
                            />
                        </div>
                    );
                })}
            </div>
            <div className="flex gap-px">
                {data.map((d, i) => (
                    <div key={i} className="flex-1 overflow-hidden text-center">
                        {i % showEvery === 0 ? (
                            <span
                                className={`block truncate text-[9px] leading-tight transition-colors ${
                                    hovered === i ? 'font-medium text-foreground' : 'text-muted-foreground'
                                }`}
                            >
                                {d.label}
                            </span>
                        ) : null}
                    </div>
                ))}
            </div>
        </div>
    );
}