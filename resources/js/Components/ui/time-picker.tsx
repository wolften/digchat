import * as React from 'react';
import { Button } from '@/Components/ui/button';
import { ScrollArea } from '@/Components/ui/scroll-area';
import { cn } from '@/lib/utils';

const HOURS = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, '0'));

interface TimePickerProps {
    value: string;
    onChange: (value: string) => void;
    className?: string;
}

function parseTime(value: string): { hour: string; minute: string } {
    const [hour = '09', minute = '00'] = value.split(':');
    return {
        hour: HOURS.includes(hour) ? hour : '09',
        minute: MINUTES.includes(minute) ? minute : '00',
    };
}

function TimeColumn({
    label,
    options,
    selected,
    onSelect,
}: {
    label: string;
    options: string[];
    selected: string;
    onSelect: (value: string) => void;
}) {
    const selectedRef = React.useRef<HTMLButtonElement>(null);

    React.useEffect(() => {
        selectedRef.current?.scrollIntoView({ block: 'center' });
    }, [selected]);

    return (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="w-full shrink-0 select-none p-2 text-center text-[0.8rem] font-normal text-ink/45">
                {label}
            </div>
            <ScrollArea className="scrollbar-thin min-h-0 flex-1">
                <div className="flex flex-col items-center gap-1 px-1 pb-1">
                    {options.map((option) => {
                        const isSelected = option === selected;

                        return (
                            <Button
                                key={option}
                                ref={isSelected ? selectedRef : undefined}
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => onSelect(option)}
                                className={cn(
                                    'size-9 font-normal tabular-nums',
                                    isSelected
                                        ? 'bg-accent text-canvas hover:bg-accent hover:text-canvas'
                                        : 'text-ink/70 hover:bg-accent/10 hover:text-accent',
                                )}
                            >
                                {option}
                            </Button>
                        );
                    })}
                </div>
            </ScrollArea>
        </div>
    );
}

function TimePicker({ value, onChange, className }: TimePickerProps) {
    const { hour, minute } = parseTime(value);

    return (
        <div className={cn('flex min-h-0 gap-1', className)}>
            <TimeColumn
                label="Hora"
                options={HOURS}
                selected={hour}
                onSelect={(nextHour) => onChange(`${nextHour}:${minute}`)}
            />
            <TimeColumn
                label="Min"
                options={MINUTES}
                selected={minute}
                onSelect={(nextMinute) => onChange(`${hour}:${nextMinute}`)}
            />
        </div>
    );
}

export { TimePicker };