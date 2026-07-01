import { Calendar } from '@/Components/ui/calendar';
import { TimePicker } from '@/Components/ui/time-picker';
import { cn } from '@/lib/utils';
import { formatCustomSnoozeLabel } from '@/lib/snooze';
import { ptBR } from 'date-fns/locale';

interface SnoozeDateTimePickerProps {
    date: Date | undefined;
    time: string;
    onDateChange: (date: Date | undefined) => void;
    onTimeChange: (time: string) => void;
    className?: string;
}

export default function SnoozeDateTimePicker({
    date,
    time,
    onDateChange,
    onTimeChange,
    className,
}: SnoozeDateTimePickerProps) {
    const minDate = new Date();
    minDate.setHours(0, 0, 0, 0);
    const preview = date && time ? formatCustomSnoozeLabel(date, time) : null;

    const pickerCardClass = 'rounded-xl border border-accent/10 bg-canvas p-3';

    return (
        <div className={cn('w-full space-y-2', className)}>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9.5rem] sm:items-stretch">
                <Calendar
                    mode="single"
                    selected={date}
                    onSelect={onDateChange}
                    locale={ptBR}
                    disabled={{ before: minDate }}
                    defaultMonth={date}
                    fixedWeeks
                    className="w-full"
                />

                <div className={cn('flex h-full flex-col', pickerCardClass)}>
                    <div className="flex h-9 w-full shrink-0 items-center justify-center">
                        <span className="select-none text-sm font-medium text-ink/85">Horário</span>
                    </div>
                    <TimePicker value={time} onChange={onTimeChange} className="min-h-0 flex-1" />
                </div>
            </div>

            {preview && (
                <p className="text-center text-xs font-medium text-accent">{preview}</p>
            )}
        </div>
    );
}