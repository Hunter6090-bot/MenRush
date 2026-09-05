/**
 * Trap the browser/Android back gesture while a full-screen overlay is open.
 * Closing via UI removes the trap entry without leaving the current route.
 * Spreads React Router's history.state so navigate(-1) still works after close.
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
 * While mounted, Android/browser Back closes the overlay instead of leaving
 * the page. Call `release()` from the overlay's close handler (or unmount).
 */
export function armOverlayBack(overlayId: string, onBack: () => void): () => void {
  pushOverlayBackEntry(overlayId);
  let released = false;

  const onPopState = () => {
    if (released) return;
    released = true;
    onBack();
  };

  window.addEventListener('popstate', onPopState);

  return () => {
    window.removeEventListener('popstate', onPopState);
    if (released) return;
    released = true;
    if (historyHasOverlayBack(overlayId)) {
      window.history.back();
    }
  };
}
