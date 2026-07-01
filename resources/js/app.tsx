import '../css/app.css';
import './bootstrap';

import { PageTransition } from '@/Components/PageTransition';
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

        root.render(
            <App {...props}>
                {({ Component, props: pageProps, key }) => (
                    <PageTransition transitionKey={key} className="min-h-full">
                        <Component {...pageProps} />
                    </PageTransition>
                )}
            </App>,
        );
    },
    progress: {
        color: '#4B5563',
        delay: 800,
    },
});
