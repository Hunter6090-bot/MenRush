/**
 * Trap the browser/Android back gesture while a full-screen overlay is open.
 * Closing via UI removes the trap entry without leaving the current route.
 * Spreads React Router's history.state so navigate(-1) still works after close.
 *
 * Strict Mode safe: cleanup does NOT call history.back() (that POP remounts the
 * route and would clear overlay React state). Remounts re-attach the listener
 * if the trap entry is already on the stack.
 */

export const OVERLAY_BACK_KEY = 'menrushOverlayBack';

export type OverlayBackState = Record<string, unknown> & {
  [OVERLAY_BACK_KEY]?: string;
};

export function pushOverlayBackEntry(overlayId: string): void {
  if (typeof window === 'undefined') return;
  const prev = (window.history.state as OverlayBackState | null) ?? {};
  window.history.pushState({ ...prev, [OVERLAY_BACK_KEY]: overlayId }, '');
}

export function historyHasOverlayBack(overlayId: string): boolean {
  if (typeof window === 'undefined') return false;
  const state = window.history.state as OverlayBackState | null;
  return state?.[OVERLAY_BACK_KEY] === overlayId;
}

/**
 * While armed, Android/browser Back closes the overlay instead of leaving
 * the page. Call the returned release from the overlay unmount; call
 * `release({ popEntry: true })` from the UI close handler so the extra
 * history entry is removed without a second onBack.
 */
export function armOverlayBack(
  overlayId: string,
  onBack: () => void,
): (opts?: { popEntry?: boolean }) => void {
  if (!historyHasOverlayBack(overlayId)) {
    pushOverlayBackEntry(overlayId);
  }

  let released = false;

  const onPopState = () => {
    if (released) return;
    released = true;
    onBack();
  };

  window.addEventListener('popstate', onPopState);

  return (opts?: { popEntry?: boolean }) => {
    window.removeEventListener('popstate', onPopState);
    if (released) return;
    released = true;
    if (opts?.popEntry && historyHasOverlayBack(overlayId)) {
      window.history.back();
    }
  };
}
