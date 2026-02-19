/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'

cleanupOutdatedCaches()

if (self.__WB_MANIFEST) {
    precacheAndRoute(self.__WB_MANIFEST)
}

self.skipWaiting()
clientsClaim()

// Cache strategies (copied from previous auto-generated config logic if needed, 
// but usually specific runtime caching is handled here if complex.
// For now let's rely on default or re-implement the runtime caching from vite config if needed.
// Actually, with injectManifest, the `workbox` config in vite.config.ts might be ignored or handled differently.
// Typically `vite-plugin-pwa` injects the manifest, and we write the rest.
// We need to re-implement the caching logic here or imported.
// But for now, let's focus on Push.

self.addEventListener('push', (event) => {
    let data = { title: 'LifeHabits', body: 'Nuova notifica', url: '/', image: undefined };

    try {
        const jsonData = event.data?.json();
        console.log('SW: Push Payload received:', jsonData);
        data = { ...data, ...jsonData };
    } catch (e) {
        console.error('SW: Error parsing push data', e);
        // Fallback to text if possible
        data.body = event.data?.text() || data.body;
    }

    const options = {
        body: data.body,
        icon: '/pwa-192x192.png', // Ensure this path is correct relative to scope
        badge: '/pwa-192x192.png',
        image: data.image,
        vibrate: [100, 50, 100],
        data: {
            url: data.url,
            dateOfArrival: Date.now()
        },
        // Actions could be added here if needed
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
            .then(() => console.log('SW: Notification shown successfully'))
            .catch(err => console.error('SW: Error showing notification:', err))
    );
})

self.addEventListener('notificationclick', (event) => {
    event.notification.close()
    const urlToOpen = event.notification.data?.url || '/'

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            // Check if there is already a window/tab open with the target URL
            for (const client of windowClients) {
                if (client.url === urlToOpen && 'focus' in client) {
                    return client.focus()
                }
            }
            // If not, open a new window
            if (self.clients.openWindow) {
                return self.clients.openWindow(urlToOpen)
            }
        })
    )
})
