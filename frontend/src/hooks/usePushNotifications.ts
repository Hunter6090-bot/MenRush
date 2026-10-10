/**
 * Keeps push wiring warm for logged-in users WITHOUT ever prompting for
 * permission automatically. The service worker is always registered (so it can
 * receive pushes and handle notification clicks), but we only (re)create a push
 * subscription when the user has already granted permission via the explicit
 * in-app toggle / banner. The first-time permission request lives in the
 * notification settings UI and PushAlertBanner, behind a clear user action.
 *
 * On each foreground of an installed PWA, re-subscribe if permission is already
 * granted so a rotated VAPID or pruned endpoint recovers without another prompt.
 */
import { useEffect } from 'react';
import { getPushSupport, registerServiceWorker, subscribeToPush } from '../lib/push';

export function usePushNotifications(isLoggedIn: boolean) {
  useEffect(() => {
    if (!isLoggedIn) return;
    if (getPushSupport() === 'unsupported') return;

    const warm = async () => {
      await registerServiceWorker();
      if (getPushSupport() === 'granted') {
        await subscribeToPush();
      }
    };

    void warm();

    const onVisible = () => {
      if (document.visibilityState === 'visible') void warm();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', onVisible);
    };
  }, [isLoggedIn]);
}
