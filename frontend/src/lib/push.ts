import { apiClient } from '../api/client';

/**
 * Browser push helpers. Permission is only ever requested from an explicit
 * user action (`enablePushNotifications`) — never automatically — so browsers
 * don't silently block us and users stay in control.
 */

export type PushSupport = 'unsupported' | 'granted' | 'denied' | 'default';

export function getPushSupport(): PushSupport {
  if (typeof window === 'undefined') return 'unsupported';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission as PushSupport;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

async function getVapidPublicKey(): Promise<string | null> {
  try {
    const res = await apiClient.get<{ publicKey: string; configured?: boolean }>('/push/vapid-public');
    if (res.data.configured === false || !res.data.publicKey) return null;
    return res.data.publicKey;
  } catch {
    return null;
  }
}

/** True when the server has VAPID keys configured for web push. */
export async function isPushConfigured(): Promise<boolean> {
  try {
    const res = await apiClient.get<{ publicKey: string; configured?: boolean }>('/push/vapid-public');
    return res.data.configured !== false && !!res.data.publicKey;
  } catch {
    return false;
  }
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch {
    return null;
  }
}

/**
 * Create (or reuse) a push subscription and persist it server-side. Assumes
 * permission has already been granted — returns false otherwise.
 */
export async function subscribeToPush(): Promise<boolean> {
  if (getPushSupport() !== 'granted') return false;
  const reg = (await navigator.serviceWorker.getRegistration()) || (await registerServiceWorker());
  if (!reg) return false;

  const vapidKey = await getVapidPublicKey();
  if (!vapidKey) return false;

  try {
    const subscription =
      (await reg.pushManager.getSubscription()) ||
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
      }));

    const sub = subscription.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
    if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) return false;

    await apiClient.post('/push/subscribe', {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    });
    return true;
  } catch {
    return false;
  }
}

/** Triggered from a clear user action (e.g. a settings toggle). */
export async function enablePushNotifications(): Promise<PushSupport> {
  const support = getPushSupport();
  if (support === 'unsupported' || support === 'denied') return support;

  await registerServiceWorker();
  const permission = await Notification.requestPermission();
  if (permission === 'granted') await subscribeToPush();
  return permission as PushSupport;
}

export async function disablePushNotifications(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const subscription = await reg?.pushManager.getSubscription();
  if (!subscription) return;
  const endpoint = subscription.endpoint;
  try {
    await subscription.unsubscribe();
  } catch {}
  try {
    await apiClient.post('/push/unsubscribe', { endpoint });
  } catch {}
}
