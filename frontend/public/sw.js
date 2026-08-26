// MenRush Service Worker — background push for messages and incoming calls.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    if (event.data) data = event.data.json();
  } catch {}

  const kind = data.kind || (String(data.tag || '').startsWith('call-') ? 'call' : 'message');
  const isCall = kind === 'call';
  const title = data.title || (isCall ? 'Incoming call' : 'MenRush');
  const url = data.url || '/discover';
  const options = {
    body: data.body || (isCall ? 'Incoming video call' : 'New activity on MenRush'),
    icon: data.icon || '/brand/icon-192.png',
    badge: '/brand/icon-48.png',
    tag: data.tag || (isCall ? 'menrush-call' : 'menrush'),
    renotify: true,
    silent: false,
    requireInteraction: isCall,
    vibrate: isCall ? [300, 120, 300, 120, 300, 120, 400] : [180, 80, 180],
    data: { url, kind },
    actions: isCall
      ? [
          { action: 'answer', title: 'Answer' },
          { action: 'dismiss', title: 'Decline' },
        ]
      : [],
  };

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const active = windows.find((c) => c.visibilityState === 'visible' && c.focused);
      if (active) {
        // In-app socket already rings the call UI / shows the thread.
        if (isCall) return;
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
  const action = event.action;
  event.notification.close();
  if (action === 'dismiss') return;
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
