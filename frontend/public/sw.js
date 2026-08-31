// MenRush Service Worker — handles background push notifications.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// Fetch handler required for installability. Do not claim navigations —
// a rejected fetch() here blanked SPA routes (profile/chat) on flaky networks.
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') return;
  event.respondWith(fetch(event.request));
});

function resolveNotificationHref(raw, fallbackPath) {
  const origin = self.location.origin;
  const fallback = new URL(fallbackPath || '/discover', origin).href;
  if (!raw || typeof raw !== 'string') return fallback;
  try {
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      const abs = new URL(raw);
      if (abs.origin !== origin) return fallback;
      return abs.href;
    }
    return new URL(raw.startsWith('/') ? raw : '/' + raw, origin).href;
  } catch {
    return fallback;
  }
}

function peerIdFromMessagesHref(href) {
  try {
    const match = new URL(href).pathname.match(/^\/messages\/([^/?#]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

function pathFromHref(href) {
  try {
    const u = new URL(href);
    return u.pathname + u.search + u.hash;
  } catch {
    return '/discover';
  }
}

self.addEventListener('push', (event) => {
  let data = {};
  try {
    if (event.data) data = event.data.json();
  } catch {}

  const title = data.title || 'MenRush';
  const href = resolveNotificationHref(data.url, '/discover');
  const path = pathFromHref(href);
  const otherId = peerIdFromMessagesHref(href);
  const options = {
    body: data.body || 'New activity on MenRush',
    icon: data.icon || '/brand/icon-192.png',
    badge: '/brand/icon-48.png',
    tag: data.tag || 'menrush',
    renotify: true,
    // Absolute href — iOS openWindow + data round-trip need a full URL.
    data: { url: href, path, otherId },
  };

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      // Hint every open client so an already-open 1:1 can refetch when the
      // WebSocket missed the live event (common after iPhone PWA suspend).
      for (const client of windows) {
        try {
          client.postMessage({
            type: 'MENRUSH_CHAT_HINT',
            url: path,
            otherId: otherId || undefined,
          });
        } catch {
          /* ignore */
        }
      }

      const active = windows.find((c) => c.visibilityState === 'visible' && c.focused);
      if (active) {
        try {
          if (new URL(active.url).pathname === path) return;
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
  const raw = event.notification.data && event.notification.data.url;
  const href = resolveNotificationHref(raw, '/discover');
  const path = pathFromHref(href);

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windows) {
        if (!client.url || !client.url.startsWith(self.location.origin)) continue;

        // Prefer SPA postMessage — WindowClient.navigate() often no-ops on
        // iOS Safari / Home Screen PWAs after focus(), which only dismissed
        // the banner without opening the chat.
        try {
          client.postMessage({ type: 'MENRUSH_NOTIFICATION_NAVIGATE', url: path });
        } catch {
          /* ignore */
        }

        try {
          if (typeof client.focus === 'function') await client.focus();
        } catch {
          /* ignore */
        }

        if ('navigate' in client && typeof client.navigate === 'function') {
          try {
            await client.navigate(href);
          } catch {
            /* iOS: expected — postMessage is the real navigation */
          }
        }
        return;
      }

      // Cold start: absolute URL is required on iOS.
      await self.clients.openWindow(href);
    })(),
  );
});
