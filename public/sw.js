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
        // Each app passes its own tag so a budget alert never replaces the tracker's reminder.
        tag: evt.data.tag || 'daily-checkin',
        renotify: false,
        data: { url: evt.data.url || '/tracker/progress' },
      })
    );
  }
});

// A push from the server (KordaBudget's background job). The payload is
// decrypted by the browser before it gets here: { title, body, tag, url }.
self.addEventListener('push', evt => {
  let data = {};
  try {
    data = evt.data ? evt.data.json() : {};
  } catch {
    data = { body: evt.data ? evt.data.text() : '' };
  }
  evt.waitUntil(
    self.registration.showNotification(data.title || 'KordaBudget', {
      body: data.body || '',
      icon: '/web-app-manifest-192x192.png',
      badge: '/favicon-96x96.png',
      // Same tag as the app's own notice for the same event, so it shows once.
      tag: data.tag || 'kb-push',
      renotify: false,
      data: { url: data.url || '/budget/overzicht' },
    })
  );
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
