import {
    applyAppearance,
    getStoredColorTheme,
    getStoredThemeMode,
    isColorThemeId,
} from '@/lib/colorThemes';

const mode = getStoredThemeMode();
const color = getStoredColorTheme();

if (isColorThemeId(color)) {
    applyAppearance(mode, color);
}