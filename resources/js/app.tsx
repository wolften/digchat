import '../css/app.css';
import './appearance-init';
import './bootstrap';

import { preloadAppIcon } from '@/Components/AppIcon';
import { AppearanceProvider } from '@/contexts/AppearanceContext';
import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

createInertiaApp({
    title: (title) => `${title} - ${appName}`,
    resolve: (name) =>
        resolvePageComponent(
            `./Pages/${name}.tsx`,
            import.meta.glob('./Pages/**/*.tsx'),
        ),
    setup({ el, App, props }) {
        const root = createRoot(el);
        const initialIconUrl = (props.initialPage?.props as { appIconUrl?: string | null } | undefined)
            ?.appIconUrl;
        preloadAppIcon(initialIconUrl);

        const initialColorTheme = (
            props.initialPage?.props as { auth?: { user?: { color_theme?: string } } } | undefined
        )?.auth?.user?.color_theme;

        root.render(
            <AppearanceProvider initialColorTheme={initialColorTheme}>
                <App {...props} />
            </AppearanceProvider>,
        );
    },
    progress: {
        color: '#4B5563',
        delay: 800,
    },
});
