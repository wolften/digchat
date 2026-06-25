import { useEffect, useState } from 'react';

type Theme = 'dark' | 'light';

const LIGHT_VARS: Record<string, string> = {
    '--tint-deep': '255 255 255',
    '--tint-dark': '255 255 255',
    '--tint-mid': '241 241 241',

    '--c-bg': '255 255 255',
    '--c-ink': '14 22 17',
    '--c-panel': '241 241 241',

    '--shell-surface': '#ffffff',
    '--sidebar-surface': '#ffffff',

    '--background': '142 50% 97%',
    '--foreground': '142 30% 4%',
    '--card': '0 0% 100%',
    '--card-foreground': '142 30% 4%',
    '--popover': '0 0% 100%',
    '--popover-foreground': '142 30% 4%',
    '--primary-foreground': '0 0% 100%',
    '--secondary': '142 22% 89%',
    '--secondary-foreground': '142 28% 12%',
    '--muted': '142 14% 92%',
    '--muted-foreground': '142 12% 36%',
    '--accent-foreground': '0 0% 100%',
    '--border': '142 22% 80%',
    '--input': '142 22% 85%',
};

function applyTheme(theme: Theme) {
    const html = document.documentElement;
    if (theme === 'light') {
        Object.entries(LIGHT_VARS).forEach(([k, v]) => html.style.setProperty(k, v));
        html.style.colorScheme = 'light';
    } else {
        Object.keys(LIGHT_VARS).forEach((k) => html.style.removeProperty(k));
        html.style.colorScheme = 'dark';
    }
    html.classList.toggle('light', theme === 'light');
    html.classList.toggle('dark', theme === 'dark');
}

export function useTheme() {
    const [theme, setTheme] = useState<Theme>(() => {
        if (typeof window === 'undefined') return 'dark';
        const stored = localStorage.getItem('digchat-theme') as Theme | null;
        if (stored === 'light' || stored === 'dark') return stored;
        return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    });

    useEffect(() => {
        applyTheme(theme);
        localStorage.setItem('digchat-theme', theme);
    }, [theme]);

    const toggle = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

    return { theme, toggle };
}
