/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

self.skipWaiting()
clientsClaim()

// ─────────────────────────────────────────────────────────────
// PUSH NOTIFICATIONS — iOS/Safari compatible
// IMPORTANT: Do NOT add badge, vibrate, image, or actions.
// These options cause showNotification() to fail silently on iOS/Safari.
// Supported on iOS: body, icon, tag, data, requireInteraction
// ─────────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
    let data = { title: 'LifeHabits', body: 'Nuova notifica', url: '/' };

    try {
        const jsonData = event.data?.json();
        console.log('SW: Push Payload received:', jsonData);
        data = { ...data, ...jsonData };
    } catch (e) {
        console.error('SW: Error parsing push data', e);
        data.body = event.data?.text() || data.body;
    }

    // Minimal notification options — fully iOS/Safari compatible
    const options: NotificationOptions = {
        body: data.body,
        icon: '/pwa-192x192.png',
        tag: 'lifehabits-notification',
        requireInteraction: false,
        data: {
            url: data.url || '/',
            dateOfArrival: Date.now()
        },
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
            .then(() => console.log('SW: Notification shown successfully'))
            .catch(err => console.error('SW: Error showing notification:', err))
    );
})

self.addEventListener('notificationclick', (event) => {
    event.notification.close()
    const urlToOpen = (event.notification.data as any)?.url || '/';

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            for (const client of windowClients) {
                if (client.url === new URL(urlToOpen, self.location.origin).href && 'focus' in client) {
                    return client.focus()
                }
            }
            if (self.clients.openWindow) {
                return self.clients.openWindow(urlToOpen)
            }
        })
    )
})
