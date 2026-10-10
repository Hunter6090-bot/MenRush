/**
 * Where the floating alerts banner ends on screen, so overlaid controls (the
 * map's Radius and Filters pills, and the quiet-map Pulse card) can sit clear
 * of it (QC P2 on #357, follow-up after #392 / #405).
 *
 * The banner floats over the page so content does not jump, but on Nearby that
 * covered the map's top controls until it was closed. The banner publishes its
 * bottom edge (viewport px) while it is on screen; null when it is not.
 *
 * `settled` is false while the banner is still deciding (async push check).
 * Map chrome stays hidden until then so pills never paint at y70 and jump.
 */
import { useLayoutEffect, useState, useSyncExternalStore, type RefObject } from 'react';

export type TopPromptSnapshot = {
  bottom: number | null;
  settled: boolean;
};

let snapshot: TopPromptSnapshot = { bottom: null, settled: true };
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function getTopPromptSnapshot(): TopPromptSnapshot {
  return snapshot;
}

export function getTopPromptBottom(): number | null {
  return snapshot.bottom;
}

/** Banner is still checking. Map pills must not paint at the un-offset y. */
export function markTopPromptPending(): void {
  if (!snapshot.settled && snapshot.bottom == null) return;
  snapshot = { bottom: null, settled: false };
  emit();
}

export function setTopPromptBottom(next: number | null): void {
  const value = next == null ? null : Math.round(next);
  if (snapshot.settled && value === snapshot.bottom) return;
  snapshot = { bottom: value, settled: true };
  emit();
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

export function useTopPromptSnapshot(): TopPromptSnapshot {
  return useSyncExternalStore(subscribe, getTopPromptSnapshot, getTopPromptSnapshot);
}

/** Test-only: restore the idle snapshot between cases. */
export function resetTopPromptOverlayForTests(): void {
  snapshot = { bottom: null, settled: true };
  emit();
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
 * Space reserved at the bottom of the map so pinned chrome (empty card, notes)
 * and the scrolling top stack stay above the tab bar, PULSE FAB, chat dock
 * and Mapbox locate control.
 */
export const MAP_OVERLAY_BOTTOM_CLEARANCE_CLASS =
  'pb-[calc(var(--fab-size,4rem)+var(--fab-offset,1rem)+1.75rem)]';

/**
 * How far `anchorRef` must move down to clear the banner. Re-measures when the
 * banner changes and whenever the anchor or its parent resizes. Pills stay
 * hidden until the banner has settled, so a late mount cannot flash y70→y221.
 */
export function useClearanceBelowTopPrompt(anchorRef: RefObject<HTMLElement | null>): {
  offset: number;
  ready: boolean;
} {
  const { bottom: bannerBottom, settled } = useTopPromptSnapshot();
  const [offset, setOffset] = useState(0);
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    if (!settled) {
      setReady(false);
      return;
    }

    const anchor = anchorRef.current;
    if (!anchor) {
      setOffset(0);
      setReady(true);
      return;
    }

    const measure = () => {
      const live = getTopPromptBottom();
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
  }, [anchorRef, bannerBottom, settled]);

  return { offset, ready };
}
