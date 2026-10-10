/**
 * Where the floating alerts banner ends on screen, so overlaid controls (the
 * map's Radius and Filters pills, and the quiet-map Pulse card) can sit clear
 * of it (QC P2 on #357, follow-up after #392).
 *
 * The banner floats over the page so content does not jump, but on Nearby that
 * covered the map's top controls until it was closed. The banner publishes its
 * bottom edge (viewport px) while it is on screen; null when it is not.
 *
 * Clearance must follow later layout changes (a late-loading Pulse card pushes
 * the map down). Measuring only when the banner value changes left the pills
 * ~153px too low.
 */
import { useLayoutEffect, useState, useSyncExternalStore, type RefObject } from 'react';

let bottom: number | null = null;
const listeners = new Set<() => void>();

export function setTopPromptBottom(next: number | null): void {
  const value = next == null ? null : Math.round(next);
  if (value === bottom) return;
  bottom = value;
  for (const listener of listeners) listener();
}

export function getTopPromptBottom(): number | null {
  return bottom;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useTopPromptBottom(): number | null {
  return useSyncExternalStore(subscribe, getTopPromptBottom, getTopPromptBottom);
}

/** Gap kept between the banner and a control moved below it. */
export const TOP_PROMPT_GAP_PX = 8;

/**
 * How far a control whose container starts at `containerTop` (viewport px)
 * must move down so it clears the banner. 0 when the banner is gone or does
 * not reach it.
 */
export function offsetBelowTopPrompt(containerTop: number, bannerBottom: number | null): number {
  if (bannerBottom == null) return 0;
  return Math.max(0, Math.ceil(bannerBottom + TOP_PROMPT_GAP_PX - containerTop));
}

/**
 * How far `anchorRef` must move down to clear the banner. Re-measures when the
 * banner changes and whenever the anchor or its parent resizes (Pulse card
 * loading, rotation, font wrap). Apply the result as padding-top or margin so
 * it takes space in a stacked layout; do not use CSS `top` on an overlay that
 * can slide over siblings.
 *
 * The anchor's border-box top must stay stable when the offset is applied
 * (padding-top on the same node is safe; margin-top on the same node is not).
 */
export function useClearanceBelowTopPrompt(anchorRef: RefObject<HTMLElement | null>): {
  offset: number;
  ready: boolean;
} {
  const bannerBottom = useTopPromptBottom();
  const [offset, setOffset] = useState(0);
  // Always hide until the first layout measure so the first painted frame is
  // never offset-0 (pills under the banner) or a leftover offset (y606).
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) {
      setOffset(0);
      setReady(true);
      return;
    }

    const measure = () => {
      const live = getTopPromptBottom();
      const bannerEl = document.querySelector('[data-testid="push-alert-banner"]');
      // Banner is in the tree but has not published yet — stay hidden so the
      // first painted pills are not at the un-offset y (QC P2).
      if (bannerEl && live == null) return;
      setOffset(offsetBelowTopPrompt(anchor.getBoundingClientRect().top, live));
      setReady(true);
    };

    measure();

    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(anchor);
    if (anchor.parentElement) ro?.observe(anchor.parentElement);
    const bannerEl = document.querySelector('[data-testid="push-alert-banner"]');
    if (bannerEl) ro?.observe(bannerEl);
    window.addEventListener('resize', measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [anchorRef, bannerBottom]);

  return { offset, ready };
}
