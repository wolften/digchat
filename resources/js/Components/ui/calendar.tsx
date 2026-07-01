import * as React from 'react';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { DayButton, DayPicker, getDefaultClassNames } from 'react-day-picker';

import { cn } from '@/lib/utils';
import { Button, buttonVariants } from '@/Components/ui/button';

function CalendarDayButton({
    className,
    day,
    modifiers,
    ...props
}: React.ComponentProps<typeof DayButton>) {
    const defaultClassNames = getDefaultClassNames();
    const ref = React.useRef<HTMLButtonElement>(null);

    React.useEffect(() => {
        if (modifiers.focused) {
            ref.current?.focus();
        }
    }, [modifiers.focused]);

    return (
        <Button
            ref={ref}
            variant="ghost"
            size="icon"
            data-day={day.date.toLocaleDateString()}
            data-selected-single={
                modifiers.selected
                && !modifiers.range_start
                && !modifiers.range_end
                && !modifiers.range_middle
            }
            data-range-start={modifiers.range_start}
            data-range-end={modifiers.range_end}
            data-range-middle={modifiers.range_middle}
            className={cn(
                'mx-auto flex aspect-square size-9 w-full max-w-9 flex-col gap-1 font-normal leading-none',
                'data-[selected-single=true]:bg-accent data-[selected-single=true]:text-canvas',
                'data-[range-middle=true]:bg-accent/15 data-[range-middle=true]:text-accent',
                'data-[range-start=true]:bg-accent data-[range-start=true]:text-canvas',
                'data-[range-end=true]:bg-accent data-[range-end=true]:text-canvas',
                'data-[range-end=true]:rounded-md data-[range-middle=true]:rounded-none data-[range-start=true]:rounded-md',
                'group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10',
                'group-data-[focused=true]/day:border-accent/40 group-data-[focused=true]/day:ring-2 group-data-[focused=true]/day:ring-accent/25',
                '[&>span]:text-xs [&>span]:opacity-70',
                defaultClassNames.day,
                className,
            )}
            {...props}
        />
    );
}

function Calendar({
    className,
    classNames,
    showOutsideDays = true,
    captionLayout = 'label',
    buttonVariant = 'ghost',
    formatters,
    components,
    ...props
}: React.ComponentProps<typeof DayPicker> & {
    buttonVariant?: React.ComponentProps<typeof Button>['variant'];
}) {
    const defaultClassNames = getDefaultClassNames();

    return (
        <DayPicker
            showOutsideDays={showOutsideDays}
            className={cn(
                'group/calendar w-full rounded-xl border border-accent/10 bg-canvas p-3',
                '[&_.rdp-months]:w-full [&_.rdp-months]:max-w-none',
                '[&_.rdp-month]:w-full',
                '[&_.rdp-day]:!h-auto [&_.rdp-day]:!w-[14.2857%]',
                '[&_.rdp-day_button]:!size-9',
                String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
                String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
                className,
            )}
            captionLayout={captionLayout}
            formatters={{
                formatMonthDropdown: (date) => date.toLocaleString('pt-BR', { month: 'short' }),
                ...formatters,
            }}
            classNames={{
                root: cn('w-full', defaultClassNames.root),
                months: cn('relative flex flex-col gap-4 md:flex-row', defaultClassNames.months),
                month: cn('flex w-full flex-col gap-4', defaultClassNames.month),
                nav: cn(
                    'absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1',
                    defaultClassNames.nav,
                ),
                button_previous: cn(
                    buttonVariants({ variant: buttonVariant }),
                    'h-[--cell-size] w-[--cell-size] select-none p-0 text-ink/60 hover:text-accent aria-disabled:opacity-50',
                    defaultClassNames.button_previous,
                ),
                button_next: cn(
                    buttonVariants({ variant: buttonVariant }),
                    'h-[--cell-size] w-[--cell-size] select-none p-0 text-ink/60 hover:text-accent aria-disabled:opacity-50',
                    defaultClassNames.button_next,
                ),
                month_caption: cn(
                    'flex h-[--cell-size] w-full items-center justify-center px-[--cell-size]',
                    defaultClassNames.month_caption,
                ),
                dropdowns: cn(
                    'flex h-[--cell-size] w-full items-center justify-center gap-1.5 text-sm font-medium',
                    defaultClassNames.dropdowns,
                ),
                dropdown_root: cn(
                    'relative rounded-md border border-accent/15 shadow-sm has-focus:border-accent/40 has-focus:ring-2 has-focus:ring-accent/20',
                    defaultClassNames.dropdown_root,
                ),
                dropdown: cn('absolute inset-0 opacity-0', defaultClassNames.dropdown),
                caption_label: cn(
                    'select-none font-medium text-ink/85',
                    captionLayout === 'label'
                        ? 'text-sm'
                        : 'flex h-8 items-center gap-1 rounded-md pl-2 pr-1 text-sm [&>svg]:size-3.5 [&>svg]:text-ink/45',
                    defaultClassNames.caption_label,
                ),
                month_grid: cn('w-full table-fixed border-collapse', defaultClassNames.month_grid),
                weekdays: cn(defaultClassNames.weekdays),
                weekday: cn(
                    'w-[14.2857%] select-none p-2 text-center text-[0.8rem] font-normal text-ink/45',
                    defaultClassNames.weekday,
                ),
                week: cn(defaultClassNames.week),
                week_number_header: cn('w-[--cell-size] select-none', defaultClassNames.week_number_header),
                week_number: cn('select-none text-[0.8rem] text-ink/45', defaultClassNames.week_number),
                day: cn(
                    'group/day relative w-[14.2857%] select-none p-1 text-center align-middle',
                    defaultClassNames.day,
                ),
                range_start: cn('rounded-l-md bg-accent/15', defaultClassNames.range_start),
                range_middle: cn('rounded-none', defaultClassNames.range_middle),
                range_end: cn('rounded-r-md bg-accent/15', defaultClassNames.range_end),
                today: cn(
                    'rounded-md bg-accent/10 text-accent data-[selected=true]:rounded-none',
                    defaultClassNames.today,
                ),
                outside: cn('text-ink/30 aria-selected:text-ink/30', defaultClassNames.outside),
                disabled: cn('text-ink/25 opacity-50', defaultClassNames.disabled),
                hidden: cn('invisible', defaultClassNames.hidden),
                ...classNames,
            }}
            components={{
                Root: ({ className: rootClassName, rootRef, ...rootProps }) => (
                    <div
                        data-slot="calendar"
                        ref={rootRef}
                        className={cn(rootClassName)}
                        {...rootProps}
                    />
                ),
                Chevron: ({ className: chevronClassName, orientation, ...chevronProps }) => {
                    if (orientation === 'left') {
                        return <ChevronLeft className={cn('h-4 w-4', chevronClassName)} {...chevronProps} />;
                    }

                    if (orientation === 'right') {
                        return <ChevronRight className={cn('h-4 w-4', chevronClassName)} {...chevronProps} />;
                    }

                    return <ChevronDown className={cn('h-4 w-4', chevronClassName)} {...chevronProps} />;
                },
                DayButton: CalendarDayButton,
                WeekNumber: ({ children, ...weekProps }) => (
                    <td {...weekProps}>
                        <div className="flex size-[--cell-size] items-center justify-center text-center">
                            {children}
                        </div>
                    </td>
                ),
                ...components,
            }}
            {...props}
        />
    );
}

export { Calendar, CalendarDayButton };