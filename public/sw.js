const CACHE = 'korda-tracker-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', evt => evt.waitUntil(clients.claim()));

// Serve app shell from network, fall back to cache for navigation
self.addEventListener('fetch', evt => {
  if (evt.request.mode === 'navigate') {
    evt.respondWith(
      fetch(evt.request).catch(() => caches.match('/index.html'))
    );
  }
});

// Show a notification when triggered by the app
self.addEventListener('message', evt => {
  if (evt.data?.type === 'SHOW_NOTIFICATION') {
    evt.waitUntil(
      self.registration.showNotification(evt.data.title || 'KordaTracker', {
        body: evt.data.body,
        icon: '/web-app-manifest-192x192.png',
        badge: '/favicon-96x96.png',
        tag: 'daily-checkin',
        renotify: false,
        data: { url: evt.data.url || '/tracker/progress' },
      })
    );
  }
});

// Navigate to the right page when notification is tapped
self.addEventListener('notificationclick', evt => {
  evt.notification.close();
  const url = evt.notification.data?.url || '/tracker/dashboard';
  evt.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if ('focus' in c) { c.navigate(url); return c.focus(); }
      }
      return clients.openWindow(url);
    })
  );
});
