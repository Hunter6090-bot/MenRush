// MenRush Service Worker — handles background push notifications.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    if (event.data) data = event.data.json();
  } catch {}

  const title = data.title || 'MenRush';
  const url = data.url || '/discover';
  const options = {
    body: data.body || 'New activity on MenRush',
    icon: data.icon || '/brand/icon-192.png',
    badge: '/brand/icon-48.png',
    // Per-conversation tag collapses repeats so a chat doesn't spam the tray.
    tag: data.tag || 'menrush',
    renotify: true,
    data: { url },
  };

  event.waitUntil(
    (async () => {
      // Dedupe with the foreground app: skip push only when a visible, focused tab
      // is already on the target conversation — not for every focused tab.
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const active = windows.find((c) => c.visibilityState === 'visible' && c.focused);
      if (active) {
        try {
          if (new URL(active.url).pathname === url) return;
        } catch {
          /* compare failed — show the notification */
        }
      }
      await self.registration.showNotification(title, options);
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/discover';
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windows) {
        if (client.url.includes(self.location.origin)) {
          await client.focus();
          if ('navigate' in client) {
            try {
              await client.navigate(url);
            } catch {}
          }
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
