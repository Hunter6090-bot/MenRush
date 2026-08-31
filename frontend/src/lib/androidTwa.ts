/** Android Trusted Web Activity / Play package constants. */
export const ANDROID_TWA_PACKAGE_ID = 'com.menrush.app';

/** Play Store listing URL (live once the listing is published). */
export const ANDROID_PLAY_STORE_URL =
  `https://play.google.com/store/apps/details?id=${ANDROID_TWA_PACKAGE_ID}`;

/** market:// deep link used by Android Chrome for native install handoff. */
export const ANDROID_PLAY_MARKET_URL = `market://details?id=${ANDROID_TWA_PACKAGE_ID}`;

export function isAndroidPhone(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /Android/i.test(ua) && /Mobile/i.test(ua) && !/iPad|iPhone|iPod/i.test(ua);
}

/** Chrome (or Chrome WebView) on Android — where beforeinstallprompt / Play TWA apply. */
export function isAndroidChrome(): boolean {
  if (!isAndroidPhone()) return false;
  const ua = navigator.userAgent || '';
  // Chrome on Android includes Chrome/; exclude pure Firefox / Opera Mini / Samsung Internet if needed.
  // Samsung Internet and Firefox also install PWAs, but this banner targets Chrome TWA flow.
  return /Chrome\//i.test(ua) && !/EdgA|OPR|Firefox|FxiOS/i.test(ua);
}

/** Open Play Store, falling back to HTTPS if the market intent is blocked. */
export function openAndroidPlayInstall(): void {
  if (typeof window === 'undefined') return;
  const started = Date.now();
  window.location.href = ANDROID_PLAY_MARKET_URL;
  window.setTimeout(() => {
    // If the market intent did not navigate away, open the HTTPS listing.
    if (Date.now() - started < 1600) {
      window.location.href = ANDROID_PLAY_STORE_URL;
    }
  }, 700);
}
