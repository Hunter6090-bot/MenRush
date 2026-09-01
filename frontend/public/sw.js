// MenRush Service Worker — background push for messages and incoming calls, with deep-link recovery.
// SW_VERSION=2026-09-01-call-ring-always-v5 — bump to force clients onto new click/call logic.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// Keep a fetch listener for installability heuristics, but NEVER call
// respondWith. Proxying every request through the SW added multi-second lag
// on mobile Safari/Chrome (phones parse a heavy SPA; SW double-hop made every
// API + Mapbox + asset fetch worse). Browser handles network natively.
// (#158 notificationclick / tag recovery lives below — do not remove.)
self.addEventListener('fetch', () => {
  /* no-op — do not intercept */
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

function isLikelyIOS() {
  const ua = (self.navigator && self.navigator.userAgent) || '';
  if (/iPad|iPhone|iPod/i.test(ua)) return true;
  return Boolean(
    self.navigator &&
      self.navigator.platform === 'MacIntel' &&
      (self.navigator.maxTouchPoints || 0) > 1,
  );
}

/** Recover /messages/:id when iOS drops notification.data but keeps tag. */
function hrefFromNotification(notification) {
  const data = notification && notification.data ? notification.data : {};
  const fromData = data.url || data.path || null;
  if (fromData) return resolveNotificationHref(fromData, '/discover');

  const tag = notification && notification.tag ? String(notification.tag) : '';
  if (tag.startsWith('msg-') && tag.length > 4) {
    return resolveNotificationHref('/messages/' + tag.slice(4), '/discover');
  }
  if (tag.startsWith('call-') && tag.length > 5) {
    return resolveNotificationHref('/messages/' + tag.slice(5), '/discover');
  }
  if (data.otherId) {
    return resolveNotificationHref('/messages/' + data.otherId, '/discover');
  }
  return resolveNotificationHref(null, '/discover');
}

/**
 * Mirror of frontend/src/lib/swPushPolicy.ts — keep in sync.
 * Incoming calls ALWAYS show a notification. A frozen/background PWA can still
 * look "visible" while the socket is dead; suppressing the ring drops the call.
 */
function shouldShowPushNotification(kind, hasFocusedVisibleClient, clientPath, notifPath) {
  if (kind === 'call') return true;
  if (!hasFocusedVisibleClient) return true;
  if (clientPath && notifPath && clientPath === notifPath) return false;
  return true;
}

self.addEventListener('push', (event) => {
  let data = {};
  try {
    if (event.data) data = event.data.json();
  } catch {}

  const href = resolveNotificationHref(data.url, '/discover');
  const path = pathFromHref(href);
  const otherId = peerIdFromMessagesHref(href) || null;
  const kind = data.kind || (String(data.tag || '').startsWith('call-') ? 'call' : 'message');
  const isCall = kind === 'call';
  const title = data.title || (isCall ? 'Incoming call' : 'MenRush');
  // tag encodes peer id so notificationclick can recover if data is stripped.
  const tag = data.tag || (otherId ? 'msg-' + otherId : isCall ? 'menrush-call' : 'menrush');
  const options = {
    body: data.body || (isCall ? 'Incoming video call' : 'New activity on MenRush'),
    icon: data.icon || '/brand/icon-192.png',
    badge: '/brand/icon-48.png',
    tag,
    renotify: true,
    silent: false,
    requireInteraction: isCall,
    vibrate: isCall ? [300, 120, 300, 120, 300, 120, 400] : [180, 80, 180],
    data: { url: href, path, otherId, kind },
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
      for (const client of windows) {
        try {
          client.postMessage({
            type: 'MENRUSH_CHAT_HINT',
            url: path,
            otherId: otherId || undefined,
            kind,
          });
        } catch {
          /* ignore */
        }
      }

      const active = windows.find((c) => c.visibilityState === 'visible' && c.focused);
      let clientPath = null;
      if (active) {
        try {
          clientPath = pathFromHref(active.url);
        } catch {
          clientPath = null;
        }
      }
      const show = shouldShowPushNotification(
        kind,
        Boolean(active),
        clientPath,
        path,
      );
      if (!show) return;
      await self.registration.showNotification(title, options);
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  const action = event.action;
  event.notification.close();
  if (action === 'dismiss') return;
  const href = hrefFromNotification(event.notification);
  const path = pathFromHref(href);
  const ios = isLikelyIOS();

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windows) {
        if (!client.url || !client.url.startsWith(self.location.origin)) continue;
        try {
          client.postMessage({ type: 'MENRUSH_NOTIFICATION_NAVIGATE', url: path });
        } catch {
          /* ignore */
        }
      }

      // iPhone Home Screen PWAs: focus()+navigate() often no-ops after close().
      // openWindow(absolute) is required to surface the deep link.
      if (ios) {
        const opened = await self.clients.openWindow(href);
        if (opened) return;
      }

      for (const client of windows) {
        if (!client.url || !client.url.startsWith(self.location.origin)) continue;
        try {
          if (typeof client.focus === 'function') await client.focus();
        } catch {
          /* ignore */
        }
        if ('navigate' in client && typeof client.navigate === 'function') {
          try {
            await client.navigate(href);
          } catch {
            /* ignore */
          }
        }
        return;
      }

      await self.clients.openWindow(href);
    })(),
  );
});
