import { useEffect } from 'react';
import { apiClient } from '../api/client';

async function getVapidPublicKey(): Promise<string | null> {
  try {
    const res = await apiClient.get<{ publicKey: string }>('/push/vapid-public');
    return res.data.publicKey || null;
  } catch {
    return null;
  }
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr.buffer as ArrayBuffer;
}

export function usePushNotifications(isLoggedIn: boolean) {
  useEffect(() => {
    if (!isLoggedIn) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    (async () => {
      try {
        // Register service worker
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });

        // Request notification permission
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        // Get VAPID key from server
        const vapidKey = await getVapidPublicKey();
        if (!vapidKey) return;

        // Subscribe to push
        const subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });

        // POST subscription to backend
        const sub = subscription.toJSON() as {
          endpoint: string;
          keys?: { p256dh?: string; auth?: string };
        };
        if (!sub.keys?.p256dh || !sub.keys?.auth) return;

        await apiClient.post('/push/subscribe', {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
        });
      } catch {
        // silently ignore — push is non-critical
      }
    })();
  }, [isLoggedIn]);
}
