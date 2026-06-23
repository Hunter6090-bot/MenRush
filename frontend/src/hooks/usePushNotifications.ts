import { useEffect } from 'react';
import { getPushSupport, registerServiceWorker, subscribeToPush } from '../lib/push';

/**
 * Keeps push wiring warm for logged-in users WITHOUT ever prompting for
 * permission automatically. The service worker is always registered (so it can
 * receive pushes and handle notification clicks), but we only (re)create a push
 * subscription when the user has already granted permission via the explicit
 * in-app toggle. The first-time permission request lives in the notification
 * settings UI, behind a clear user action.
 */
export function usePushNotifications(isLoggedIn: boolean) {
  useEffect(() => {
    if (!isLoggedIn) return;
    if (getPushSupport() === 'unsupported') return;

    void (async () => {
      await registerServiceWorker();
      if (getPushSupport() === 'granted') {
        await subscribeToPush();
      }
    })();
  }, [isLoggedIn]);
}
