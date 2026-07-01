export type SnoozePreset = '1h' | '3h' | 'tomorrow_10' | 'custom';

export interface CustomSnoozeValue {
    date: Date;
    time: string;
}

export function defaultCustomSnoozeDate(): Date {
    const date = new Date();
    date.setMinutes(0, 0, 0);
    date.setHours(date.getHours() + 1);
    return date;
}

export function defaultCustomSnoozeTime(date: Date = defaultCustomSnoozeDate()): string {
    const pad = (value: number) => String(value).padStart(2, '0');
    const roundedMinutes = Math.ceil(date.getMinutes() / 5) * 5;
    const hours = roundedMinutes >= 60 ? date.getHours() + 1 : date.getHours();
    const minutes = roundedMinutes >= 60 ? 0 : roundedMinutes;

    return `${pad(hours % 24)}:${pad(minutes)}`;
}

export function customSnoozeIso(date: Date | undefined, time: string): string | null {
    if (!date || !time) return null;

    const [hours, minutes] = time.split(':').map((part) => Number.parseInt(part, 10));
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;

    const combined = new Date(date);
    combined.setHours(hours, minutes, 0, 0);

    if (combined.getTime() <= Date.now() + 4 * 60 * 1000) {
        return null;
    }

    return combined.toISOString();
}

export function formatCustomSnoozeLabel(date: Date, time: string): string {
    const iso = customSnoozeIso(date, time);
    return iso ? formatSnoozeUntil(iso) : 'Selecione data e hora válidas';
}

export function snoozeUntilFromPreset(
    preset: SnoozePreset,
    custom?: CustomSnoozeValue,
): string | null {
    const now = new Date();

    switch (preset) {
        case '1h': {
            const date = new Date(now.getTime() + 60 * 60 * 1000);
            return date.toISOString();
        }
        case '3h': {
            const date = new Date(now.getTime() + 3 * 60 * 60 * 1000);
            return date.toISOString();
        }
        case 'tomorrow_10': {
            const date = new Date(now);
            date.setDate(date.getDate() + 1);
            date.setHours(10, 0, 0, 0);
            return date.toISOString();
        }
        case 'custom':
            return customSnoozeIso(custom?.date, custom?.time ?? '');
        default:
            return null;
    }
}

export function formatSnoozeUntil(iso: string | null): string {
    if (!iso) return '';

    const date = new Date(iso);
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const sameDay =
        date.getFullYear() === now.getFullYear()
        && date.getMonth() === now.getMonth()
        && date.getDate() === now.getDate();

    const isTomorrow =
        date.getFullYear() === tomorrow.getFullYear()
        && date.getMonth() === tomorrow.getMonth()
        && date.getDate() === tomorrow.getDate();

    const time = date.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
    });

    if (sameDay) return `hoje às ${time}`;
    if (isTomorrow) return `amanhã às ${time}`;

    return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

