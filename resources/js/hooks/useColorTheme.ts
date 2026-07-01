import { useAppearance } from '@/hooks/useAppearance';

export function useColorTheme() {
    const { colorTheme, setColorTheme } = useAppearance();
    return { colorTheme, setColorTheme };
}