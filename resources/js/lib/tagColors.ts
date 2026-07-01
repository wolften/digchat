export const TAG_DOT_CLASSES: Record<string, string> = {
    blue: 'bg-blue-400',
    green: 'bg-green-500',
    amber: 'bg-amber-400',
    red: 'bg-red-500',
    purple: 'bg-purple-500',
    teal: 'bg-teal-400',
    coral: 'bg-orange-400',
    pink: 'bg-pink-400',
};

export function tagDotClass(color: string): string {
    return TAG_DOT_CLASSES[color] ?? 'bg-ink/30';
}