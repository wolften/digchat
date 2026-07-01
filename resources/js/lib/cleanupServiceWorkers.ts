/**
 * Remove service workers órfãos que tentam buscar scripts inexistentes
 * (ex.: internal-notifications-sw.js do preview do Cursor em localhost:3000).
 * O DigChat usa a Notification API diretamente — não depende de service worker.
 */
export function cleanupStaleServiceWorkers(): void {
    if (!('serviceWorker' in navigator)) {
        return;
    }

    void navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
            const scriptUrl =
                registration.active?.scriptURL ??
                registration.installing?.scriptURL ??
                registration.waiting?.scriptURL ??
                '';

            if (scriptUrl.includes('internal-notifications-sw')) {
                void registration.unregister();
            }
        }
    });
}