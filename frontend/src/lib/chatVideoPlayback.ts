/**
 * Chat video / video-note playback helpers.
 *
 * Open-thread polls re-sign media URLs every few seconds. Binding `<video src>`
 * directly to that rotating grant restarted the download forever (black frame,
 * duration `--:--`). Callers should lock a play src once armed and only refresh
 * the grant on retry / missing URL — never block first paint on a JWT round-trip.
 *
 * Speed bar (owner): a ~13s note must leave `--:--` and start within ~1–2s on a
 * normal mobile network via progressive Range streaming (not full-blob wait).
 */

/** Hard cap — if metadata / first frame has not arrived, clear chrome → retry. */
export const VIDEO_LOAD_TIMEOUT_MS = 3_500;

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

/**
 * Resolve the URL to stream into `<video>` without waiting on a refresh when a
 * thread-signed URL is already present (progressive / Range start).
 */
export function resolveChatVideoPlayUrl(opts: {
  threadUrl?: string | null;
  refreshedUrl?: string | null;
  preferRefresh: boolean;
}): string | null {
  const refreshed = opts.refreshedUrl?.trim() || null;
  const thread = opts.threadUrl?.trim() || null;
  if (opts.preferRefresh) return refreshed || thread;
  return thread || refreshed;
}
