// Custom Service Worker logic for Push Notifications
// Imported via workbox.importScripts in vite.config.ts
// iOS/Safari compatible: no badge, vibrate, or image options

function safeNotificationUrl(value) {
    if (typeof value !== 'string' || value.length > 2048) return '/';
    try {
        const url = new URL(value || '/', self.location.origin);
        if (url.origin !== self.location.origin || url.username || url.password) return '/';
        return /^[a-z][a-z\d+.-]*:/i.test(value) ? url.href : `${url.pathname}${url.search}${url.hash}`;
    } catch {
        return '/';
    }
}

self.addEventListener('push', (event) => {
    let data = { title: 'LifeHabits', body: 'Nuova notifica', url: '/' };

    try {
        if (event.data) {
            const jsonData = event.data.json();
            console.log('SW: Push Payload received:', jsonData);
            data = { ...data, ...jsonData };
        }
    } catch (e) {
        console.error('SW: Error parsing push data', e);
        data.body = (event.data && event.data.text()) || data.body;
    }

    // iOS/Safari only supports: body, icon, tag, data, requireInteraction
    // Do NOT include: badge, vibrate, image, actions — they cause showNotification() to fail silently on iOS
    const options = {
        body: data.body,
        icon: '/pwa-192x192.png',
        tag: 'lifehabits-notification',
        data: {
            url: safeNotificationUrl(data.url),
            dateOfArrival: Date.now()
        },
        requireInteraction: false,
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
            .then(() => console.log('SW: Notification shown successfully'))
            .catch(err => console.error('SW: Error showing notification:', err))
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const urlToOpen = safeNotificationUrl(event.notification.data?.url);

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            for (const client of windowClients) {
                if (client.url === new URL(urlToOpen, self.location.origin).href && 'focus' in client) {
                    return client.focus();
                }
            }
            if (self.clients.openWindow) {
                return self.clients.openWindow(urlToOpen);
            }
        })
    );
});
