// Custom Service Worker logic for Push Notifications
// Imported via workbox.importScripts in vite.config.ts

self.addEventListener('push', (event) => {
    let data = { title: 'LifeHabits', body: 'Nuova notifica', url: '/', image: undefined };

    try {
        if (event.data) {
            const jsonData = event.data.json();
            console.log('SW: Push Payload received:', jsonData);
            data = { ...data, ...jsonData };
        }
    } catch (e) {
        console.error('SW: Error parsing push data', e);
        // Fallback to text if possible
        data.body = (event.data && event.data.text()) || data.body;
    }

    const options = {
        body: data.body,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        image: data.image,
        vibrate: [100, 50, 100],
        data: {
            url: data.url,
            dateOfArrival: Date.now()
        },
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
            .then(() => console.log('SW: Notification shown successfully'))
            .catch(err => console.error('SW: Error showing notification:', err))
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const urlToOpen = event.notification.data?.url || '/';

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            // Check if there is already a window/tab open with the target URL
            for (const client of windowClients) {
                if (client.url === urlToOpen && 'focus' in client) {
                    return client.focus();
                }
            }
            // If not, open a new window
            if (self.clients.openWindow) {
                return self.clients.openWindow(urlToOpen);
            }
        })
    );
});
