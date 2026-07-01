import { useAppearance } from '@/contexts/AppearanceContext';
import { isColorThemeId } from '@/lib/colorThemes';
import { PageProps } from '@/types';
import { usePage } from '@inertiajs/react';
import { useEffect } from 'react';

export function AppearanceSync() {
    const user = usePage<PageProps>().props.auth?.user;
    const { syncColorTheme } = useAppearance();

    useEffect(() => {
        const color = user?.color_theme;

        if (isColorThemeId(color ?? null)) {
            syncColorTheme(color);
        }
    }, [user?.color_theme, syncColorTheme]);

    return null;
}