import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function onlyDigits(value: string | null | undefined): string {
    return String(value ?? '').replace(/\D/g, '');
}

export function formatClientPhone(value: string | null | undefined): string {
    const original = String(value ?? '').trim();
    const digits = onlyDigits(original);

    if (!digits) {
        return original;
    }

    if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
        const ddd = digits.slice(2, 4);
        const number = digits.slice(4);

        if (number.length === 9) {
            return `+55 (${ddd}) ${number.slice(0, 5)}-${number.slice(5)}`;
        }

        return `+55 (${ddd}) ${number.slice(0, 4)}-${number.slice(4)}`;
    }

    if (digits.length === 11 || digits.length === 10) {
        const ddd = digits.slice(0, 2);
        const number = digits.slice(2);

        if (number.length === 9) {
            return `(${ddd}) ${number.slice(0, 5)}-${number.slice(5)}`;
        }

        return `(${ddd}) ${number.slice(0, 4)}-${number.slice(4)}`;
    }

    if (digits.length === 9) {
        return `${digits.slice(0, 5)}-${digits.slice(5)}`;
    }

    if (digits.length === 8) {
        return `${digits.slice(0, 4)}-${digits.slice(4)}`;
    }

    return original;
}

export function formatClientDisplayName(
    name: string | null | undefined,
    phone?: string | null,
): string {
    const rawName = String(name ?? '').trim();

    if (!rawName) {
        return formatClientPhone(phone);
    }

    const nameDigits = onlyDigits(rawName);
    const phoneDigits = onlyDigits(phone);

    if (nameDigits && (nameDigits === phoneDigits || nameDigits.length >= 8)) {
        return formatClientPhone(rawName);
    }

    return rawName;
}
