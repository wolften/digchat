import {
    applyAppearance,
    COLOR_THEME_STORAGE_KEY,
    getStoredColorTheme,
    getStoredThemeMode,
    isColorThemeId,
    THEME_STORAGE_KEY,
    type ColorThemeId,
    type ThemeMode,
} from '@/lib/colorThemes';
import { router } from '@inertiajs/react';
import {
    createContext,
    PropsWithChildren,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';

type AppearanceContextValue = {
    theme: ThemeMode;
    colorTheme: ColorThemeId;
    toggle: () => void;
    setColorTheme: (color: ColorThemeId) => void;
    syncColorTheme: (color: ColorThemeId) => void;
};

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

type AppearanceProviderProps = PropsWithChildren<{
    initialColorTheme?: string | null;
}>;

function resolveInitialColor(initialColorTheme?: string | null): ColorThemeId {
    if (isColorThemeId(initialColorTheme ?? null)) {
        return initialColorTheme as ColorThemeId;
    }

    return getStoredColorTheme();
}

export function AppearanceProvider({
    children,
    initialColorTheme,
}: AppearanceProviderProps) {
    const [theme, setTheme] = useState<ThemeMode>(() => getStoredThemeMode());
    const [colorTheme, setColorThemeState] = useState<ColorThemeId>(() =>
        resolveInitialColor(initialColorTheme),
    );

    useEffect(() => {
        applyAppearance(theme, colorTheme);
        localStorage.setItem(THEME_STORAGE_KEY, theme);
        localStorage.setItem(COLOR_THEME_STORAGE_KEY, colorTheme);
    }, [theme, colorTheme]);

    const toggle = useCallback(
        () => setTheme((current) => (current === 'dark' ? 'light' : 'dark')),
        [],
    );

    const syncColorTheme = useCallback((next: ColorThemeId) => {
        if (isColorThemeId(next)) {
            setColorThemeState(next);
        }
    }, []);

    const setColorTheme = useCallback((next: ColorThemeId) => {
        if (!isColorThemeId(next)) return;

        setColorThemeState(next);

        router.patch(
            route('profile.color-theme'),
            { color_theme: next },
            { preserveScroll: true, preserveState: true },
        );
    }, []);

    const value = useMemo(
        () => ({ theme, colorTheme, toggle, setColorTheme, syncColorTheme }),
        [theme, colorTheme, toggle, setColorTheme, syncColorTheme],
    );

    return (
        <AppearanceContext.Provider value={value}>
            {children}
        </AppearanceContext.Provider>
    );
}

export function useAppearance() {
    const context = useContext(AppearanceContext);

    if (!context) {
        throw new Error('useAppearance must be used within AppearanceProvider');
    }

    return context;
}