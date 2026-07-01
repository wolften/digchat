import { useAppearance } from '@/hooks/useAppearance';

export function useTheme() {
    const { theme, toggle } = useAppearance();
    return { theme, toggle };
}