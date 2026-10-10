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
 * Map chrome stays hidden until then so pills never paint at the un-offset y
 * and slide. A short timeout (or an error) always releases them so a hung
 * check cannot hide Radius / Filters / Pulse. A banner that arrives after
 * that timeout may animate once from the released position.
 */
import { useLayoutEffect, useState, useSyncExternalStore, type RefObject } from 'react';

export type TopPromptSnapshot = {
  bottom: number | null;
  settled: boolean;
};

/** Give up waiting for the push-setup check and show map chrome. */
export const TOP_PROMPT_SETTLE_TIMEOUT_MS = 800;

let snapshot: TopPromptSnapshot = { bottom: null, settled: true };
const listeners = new Set<() => void>();
let settleTimer: ReturnType<typeof setTimeout> | null = null;
/** True after the timeout released chrome; do not hide again for the same wait. */
let pendingGaveUp = false;

function emit(): void {
  for (const listener of listeners) listener();
}

function clearSettleTimer(): void {
  if (settleTimer == null) return;
  clearTimeout(settleTimer);
  settleTimer = null;
}

function armSettleTimer(): void {
  if (settleTimer != null) return;
  settleTimer = setTimeout(() => {
    settleTimer = null;
    if (snapshot.settled) return;
    pendingGaveUp = true;
    snapshot = { bottom: null, settled: true };
    emit();
  }, TOP_PROMPT_SETTLE_TIMEOUT_MS);
}

export function getTopPromptSnapshot(): TopPromptSnapshot {
  return snapshot;
}

export function getTopPromptBottom(): number | null {
  return snapshot.bottom;
}

/** Banner is still checking. Map pills must not paint at the un-offset y. */
export function markTopPromptPending(): void {
  if (pendingGaveUp) return;
  if (!snapshot.settled && snapshot.bottom == null) return;
  snapshot = { bottom: null, settled: false };
  armSettleTimer();
  emit();
}

export function setTopPromptBottom(next: number | null): void {
  const value = next == null ? null : Math.round(next);
  if (snapshot.settled && value === snapshot.bottom) return;
  pendingGaveUp = false;
  clearSettleTimer();
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
  clearSettleTimer();
  pendingGaveUp = false;
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
 * Space reserved at the bottom of the map so the compact footer stays above
 * the tab bar, PULSE FAB and chat dock. Locate is cleared by the footer's
 * side inset (the pill is not full-width). This spacer can shrink on a short
 * map so Radius / Filters always keep a row.
 */
export const MAP_OVERLAY_BOTTOM_CLEARANCE_CLASS =
  'h-[calc(var(--fab-size,4rem)+var(--fab-offset,1rem)+2.25rem)]';

/** Pinned footer may not eat the top stack on a short or landscape map. */
export const MAP_OVERLAY_PINNED_MAX_CLASS = 'max-h-[25%]';

/** Landscape and other short maps: no Pulse card, pin note, spots note or scroll. */
export const MAP_SHORT_HEIGHT_PX = 480;

/**
 * How far `anchorRef` must move down to clear the banner. Re-measures when the
 * banner changes and whenever the anchor or its parent resizes. Chrome stays
 * hidden until `settled` so the first painted y is already the final y.
 * After that, a late banner (past the 800ms release) may animate once.
 */
export function useClearanceBelowTopPrompt(anchorRef: RefObject<HTMLElement | null>): {
  offset: number;
  ready: boolean;
  animate: boolean;
} {
  const { bottom: bannerBottom, settled } = useTopPromptSnapshot();
  const [offset, setOffset] = useState(0);
  const [animate, setAnimate] = useState(false);

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor || !settled) {
      return;
    }

    const measure = () => {
      setOffset(offsetBelowTopPrompt(anchor.getBoundingClientRect().top, getTopPromptBottom()));
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

  useLayoutEffect(() => {
    if (!settled) {
      setAnimate(false);
      return;
    }
    const id = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(id);
  }, [settled]);

  return { offset, ready: settled, animate };
}
