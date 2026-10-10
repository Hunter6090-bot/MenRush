/**
 * Service-worker push display policy (mirrored in `public/sw.js`).
 *
 * Incoming *calls* must always surface a notification when the push arrives.
 * A backgrounded / frozen PWA can still report a "visible" client while the
 * socket is dead — suppressing the call ring drops the call silently.
 * In-app UI may also ring; duplicate UX beats a missed call.
 */
export type PushKind = 'message' | 'call' | 'missed_call' | string;

export function shouldShowPushNotification(opts: {
  kind: PushKind;
  hasFocusedVisibleClient: boolean;
  /** Path of the focused visible client, if any. */
  clientPath?: string | null;
  /** Path the notification would open. */
  notifPath?: string | null;
}): boolean {
  const kind = opts.kind || 'message';
  if (kind === 'call') return true;

  if (!opts.hasFocusedVisibleClient) return true;

  // Already looking at this thread — skip the tray duplicate.
  if (opts.clientPath && opts.notifPath && opts.clientPath === opts.notifPath) {
    return false;
  }
  return true;
}
