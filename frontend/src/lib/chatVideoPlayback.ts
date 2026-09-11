/**
 * Chat video / video-note playback helpers.
 *
 * Open-thread polls re-sign media URLs every few seconds. Binding `<video src>`
 * directly to that rotating grant restarted the download forever (black frame,
 * duration `--:--`). Callers should lock a play src once armed and refresh the
 * grant explicitly on open / retry.
 */

export const VIDEO_LOAD_TIMEOUT_MS = 20_000;

export type ChatVideoLoadState = 'idle' | 'loading' | 'ready' | 'error';

/** Path only — ignore `?access=` so callers can compare stable media identity. */
export function chatMediaPath(url?: string | null): string {
  if (!url) return '';
  return String(url).trim().split('?', 1)[0] || '';
}

/**
 * iPhone Safari / PWA cannot decode WebM video notes. Prefer an honest error
 * over a forever-black player when the server reports video/webm.
 */
export function isAppleIncompatibleVideoMime(mime?: string | null): boolean {
  if (!mime) return false;
  const base = String(mime).split(';', 1)[0].trim().toLowerCase();
  return base === 'video/webm' || base === 'video/x-matroska';

}

export function isLikelyAppleMobileClient(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/i.test(ua)) return true;
  return (
    navigator.platform === 'MacIntel' &&
    typeof navigator.maxTouchPoints === 'number' &&
    navigator.maxTouchPoints > 1
  );
}

export function chatVideoUnsupportedHint(mime?: string | null): string | null {
  if (!isLikelyAppleMobileClient()) return null;
  if (!isAppleIncompatibleVideoMime(mime)) return null;
  return "Can't play this video on this device. Ask them to resend as a video note.";
}
