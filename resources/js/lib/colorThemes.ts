import { chatWallpaperPattern, chatWallpaperPatternLight } from '@/lib/chatWallpaper';

export type ThemeMode = 'dark' | 'light';

export type ColorThemeId =
    | 'green'
    | 'blue'
    | 'red'
    | 'yellow'
    | 'orange'
    | 'purple'
    | 'turquoise'
    | 'graphite'
    | 'pink'
    | 'indigo'
    | 'coral'
    | 'amber'
    | 'lime'
    | 'cyan'
    | 'wine';

export const THEME_STORAGE_KEY = 'digchat-theme';
export const COLOR_THEME_STORAGE_KEY = 'digchat-color-theme';

export const COLOR_THEME_OPTIONS: {
    id: ColorThemeId;
    label: string;
    swatch: string;
}[] = [
    { id: 'green', label: 'Verde', swatch: '#22c55e' },
    { id: 'blue', label: 'Azul', swatch: '#3b82f6' },
    { id: 'red', label: 'Vermelho', swatch: '#ef4444' },
    { id: 'yellow', label: 'Amarelo', swatch: '#eab308' },
    { id: 'orange', label: 'Laranja', swatch: '#f97316' },
    { id: 'purple', label: 'Roxo', swatch: '#a855f7' },
    { id: 'turquoise', label: 'Turquesa', swatch: '#14b8a6' },
    { id: 'graphite', label: 'Grafite', swatch: '#94a3b8' },
    { id: 'pink', label: 'Rosa', swatch: '#ec4899' },
    { id: 'indigo', label: 'Índigo', swatch: '#6366f1' },
    { id: 'coral', label: 'Coral', swatch: '#f43f5e' },
    { id: 'amber', label: 'Âmbar', swatch: '#f59e0b' },
    { id: 'lime', label: 'Lima', swatch: '#84cc16' },
    { id: 'cyan', label: 'Ciano', swatch: '#06b6d4' },
    { id: 'wine', label: 'Vinho', swatch: '#be123c' },
];

type Palette = Record<string, string>;

const MANAGED_CSS_VARS = new Set<string>();

function registerPalette(palette: Palette): Palette {
    Object.keys(palette).forEach((key) => MANAGED_CSS_VARS.add(key));
    return palette;
}

function darkPalette(
    hue: number,
    accentRgb: string,
    accentHsl: string,
    tints: [string, string, string],
    _chatBg: string,
    bodyBg: string,
): Palette {
    const [deep, dark, mid] = tints;

    return registerPalette({
        '--accent-rgb': accentRgb,
        '--accent-hsl': accentHsl,
        '--accent-fg-rgb': '0 0 0',
        '--tint-deep': deep,
        '--tint-dark': dark,
        '--tint-mid': mid,
        '--c-bg': dark,
        '--c-ink': '255 255 255',
        '--c-panel': mid,
        '--shell-surface': `rgb(${deep} / 0.90)`,
        '--sidebar-surface': `rgb(${deep})`,
        '--body-bg': bodyBg,
        '--background': `${hue} 40% 5%`,
        '--foreground': '0 0% 95%',
        '--card': `${hue} 30% 10%`,
        '--card-foreground': '0 0% 95%',
        '--popover': `${hue} 30% 10%`,
        '--popover-foreground': '0 0% 95%',
        '--primary': accentHsl,
        '--primary-foreground': `${hue} 40% 4%`,
        '--secondary': `${hue} 20% 15%`,
        '--secondary-foreground': '0 0% 85%',
        '--muted': `${hue} 20% 13%`,
        '--muted-foreground': '0 0% 70%',
        '--accent': accentHsl,
        '--accent-foreground': `${hue} 40% 4%`,
        '--border': `${hue} 20% 15%`,
        '--input': `${hue} 20% 14%`,
        '--ring': accentHsl,
        '--default-border-color': `rgb(${accentRgb} / 0.12)`,
        '--chat-bg-color': `hsl(${hue} 14% 9%)`,
        '--chat-bg-image': chatWallpaperPattern(accentRgb, 0.14, {
            strokeWidth: 1.25,
            fillOpacityFactor: 0.7,
            dotOpacity: 0.9,
        }),
    });
}

function lightPalette(
    hue: number,
    accentRgb: string,
    accentHsl: string,
    inkRgb: string,
    _chatBg?: string,
): Palette {
    return registerPalette({
        '--accent-rgb': accentRgb,
        '--accent-hsl': accentHsl,
        '--accent-fg-rgb': '255 255 255',
        '--tint-deep': '255 255 255',
        '--tint-dark': '255 255 255',
        '--tint-mid': '241 241 241',
        '--c-bg': '255 255 255',
        '--c-ink': inkRgb,
        '--c-panel': '241 241 241',
        '--shell-surface': '#ffffff',
        '--sidebar-surface': '#ffffff',
        '--body-bg': '#f0f0f0',
        '--background': `${hue} 50% 97%`,
        '--foreground': `${hue} 30% 4%`,
        '--card': '0 0% 100%',
        '--card-foreground': `${hue} 30% 4%`,
        '--popover': '0 0% 100%',
        '--popover-foreground': `${hue} 30% 4%`,
        '--primary': accentHsl,
        '--primary-foreground': '0 0% 100%',
        '--secondary': `${hue} 22% 89%`,
        '--secondary-foreground': `${hue} 28% 12%`,
        '--muted': `${hue} 14% 92%`,
        '--muted-foreground': `${hue} 12% 36%`,
        '--accent': accentHsl,
        '--accent-foreground': '0 0% 100%',
        '--border': `${hue} 22% 80%`,
        '--input': `${hue} 22% 85%`,
        '--ring': accentHsl,
        '--default-border-color': `rgb(${inkRgb} / 0.10)`,
        '--chat-bg-color': `hsl(${hue} 10% 96%)`,
        '--chat-bg-image': chatWallpaperPatternLight(accentRgb),
    });
}

export const COLOR_PALETTES: Record<
    ColorThemeId,
    { dark: Palette; light: Palette }
> = {
    green: {
        dark: darkPalette(
            160,
            '34 197 94',
            '142 70% 55%',
            ['8 16 10', '10 22 14', '20 42 27'],
            '#0b141a',
            '#0d0d0d',
        ),
        light: lightPalette(142, '34 197 94', '142 70% 55%', '14 22 17', '#e0ebe4'),
    },
    blue: {
        dark: darkPalette(
            220,
            '59 130 246',
            '217 91% 60%',
            ['6 10 18', '8 14 24', '14 26 44'],
            '#0e1621',
            '#0a0d14',
        ),
        light: lightPalette(214, '59 130 246', '217 91% 60%', '10 16 28', '#dce8f4'),
    },
    red: {
        dark: darkPalette(
            0,
            '239 68 68',
            '0 84% 60%',
            ['14 6 6', '18 8 8', '36 16 16'],
            '#1a0e0e',
            '#140a0a',
        ),
        light: lightPalette(0, '239 68 68', '0 84% 60%', '28 10 10', '#f0e0e0'),
    },
    yellow: {
        dark: darkPalette(
            45,
            '234 179 8',
            '45 93% 47%',
            ['14 12 4', '18 16 6', '36 32 12'],
            '#1a1608',
            '#14120a',
        ),
        light: lightPalette(48, '234 179 8', '45 93% 47%', '22 18 6', '#f0ead8'),
    },
    orange: {
        dark: darkPalette(
            25,
            '249 115 22',
            '25 95% 53%',
            ['16 8 4', '20 12 6', '40 24 12'],
            '#1a1008',
            '#140e0a',
        ),
        light: lightPalette(28, '249 115 22', '25 95% 53%', '24 14 6', '#f0e4d8'),
    },
    purple: {
        dark: darkPalette(
            270,
            '168 85 247',
            '271 91% 65%',
            ['10 6 18', '14 10 24', '28 18 44'],
            '#12101a',
            '#0f0a14',
        ),
        light: lightPalette(270, '168 85 247', '271 91% 65%', '20 12 28', '#ebe4f4'),
    },
    turquoise: {
        dark: darkPalette(
            175,
            '20 184 166',
            '173 80% 40%',
            ['6 14 14', '8 18 18', '14 36 36'],
            '#0a1414',
            '#0a1212',
        ),
        light: lightPalette(175, '20 184 166', '173 80% 40%', '8 20 18', '#dceeea'),
    },
    graphite: {
        dark: darkPalette(
            220,
            '148 163 184',
            '215 20% 65%',
            ['12 14 16', '16 18 20', '32 36 40'],
            '#111316',
            '#0d0e10',
        ),
        light: lightPalette(220, '100 116 139', '215 16% 47%', '16 18 22', '#e4e7eb'),
    },
    pink: {
        dark: darkPalette(
            330,
            '236 72 153',
            '330 81% 60%',
            ['16 6 12', '20 8 16', '40 16 32'],
            '#1a0e14',
            '#140a10',
        ),
        light: lightPalette(330, '236 72 153', '330 81% 60%', '24 10 18', '#f0e0ea'),
    },
    indigo: {
        dark: darkPalette(
            239,
            '99 102 241',
            '239 84% 67%',
            ['8 8 20', '10 12 28', '20 22 48'],
            '#0e0e1a',
            '#0a0a12',
        ),
        light: lightPalette(239, '99 102 241', '239 84% 67%', '14 14 32', '#e4e6f4'),
    },
    coral: {
        dark: darkPalette(
            347,
            '244 63 94',
            '347 77% 60%',
            ['16 6 8', '20 8 10', '40 16 20'],
            '#1a0e10',
            '#140a0c',
        ),
        light: lightPalette(347, '244 63 94', '347 77% 60%', '28 10 14', '#f0e2e6'),
    },
    amber: {
        dark: darkPalette(
            38,
            '245 158 11',
            '38 92% 50%',
            ['14 10 4', '18 14 6', '36 28 12'],
            '#1a1408',
            '#14100a',
        ),
        light: lightPalette(38, '245 158 11', '38 92% 50%', '22 16 6', '#f2ead8'),
    },
    lime: {
        dark: darkPalette(
            84,
            '132 204 22',
            '84 81% 44%',
            ['10 14 4', '14 20 6', '28 40 12'],
            '#101408',
            '#0e120a',
        ),
        light: lightPalette(84, '132 204 22', '84 81% 44%', '16 22 6', '#e8f0dc'),
    },
    cyan: {
        dark: darkPalette(
            189,
            '6 182 212',
            '189 94% 43%',
            ['4 12 16', '6 16 20', '12 32 40'],
            '#081418',
            '#061012',
        ),
        light: lightPalette(189, '6 182 212', '189 94% 43%', '6 18 22', '#dceef4'),
    },
    wine: {
        dark: darkPalette(
            347,
            '190 18 60',
            '347 83% 41%',
            ['12 4 6', '16 6 8', '32 12 16'],
            '#16080c',
            '#120608',
        ),
        light: lightPalette(347, '190 18 60', '347 83% 41%', '24 8 12', '#ecdce2'),
    },
};

const VALID_COLORS = new Set<ColorThemeId>(
    COLOR_THEME_OPTIONS.map((option) => option.id),
);

export function isColorThemeId(value: string | null): value is ColorThemeId {
    return value !== null && VALID_COLORS.has(value as ColorThemeId);
}

function getMetaColorTheme(): ColorThemeId | null {
    if (typeof document === 'undefined') return null;

    const value = document
        .querySelector('meta[name="user-color-theme"]')
        ?.getAttribute('content');

    return isColorThemeId(value ?? null) ? (value as ColorThemeId) : null;
}

export function getStoredColorTheme(): ColorThemeId {
    if (typeof window === 'undefined') return 'green';

    const fromMeta = getMetaColorTheme();
    if (fromMeta) return fromMeta;

    const stored = localStorage.getItem(COLOR_THEME_STORAGE_KEY);
    return isColorThemeId(stored) ? stored : 'green';
}

export function getStoredThemeMode(): ThemeMode {
    if (typeof window === 'undefined') return 'dark';

    const stored = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
    if (stored === 'light' || stored === 'dark') return stored;

    return window.matchMedia('(prefers-color-scheme: light)').matches
        ? 'light'
        : 'dark';
}

/** Paleta escura do tema — usada na tela de login para o fundo colorido. */
export function getLoginShellPalette(color?: ColorThemeId): Palette {
    const resolved = color ?? getStoredColorTheme();
    return COLOR_PALETTES[resolved].dark;
}

export function applyAppearance(mode: ThemeMode, color: ColorThemeId) {
    const html = document.documentElement;
    const palette = COLOR_PALETTES[color][mode];

    MANAGED_CSS_VARS.forEach((key) => {
        if (!(key in palette)) {
            html.style.removeProperty(key);
        }
    });

    Object.entries(palette).forEach(([key, value]) => {
        html.style.setProperty(key, value);
    });

    html.classList.remove('light', 'dark');
    html.classList.add(mode);
    html.dataset.colorTheme = color;
    html.style.colorScheme = mode;
}