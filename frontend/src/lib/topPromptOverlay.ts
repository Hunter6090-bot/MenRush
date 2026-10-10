/**
 * Where the floating alerts banner ends on screen, so overlaid controls (the
 * map's Radius and Filters pills) can move out from under it (QC P2 on #357).
 *
 * The banner floats over the page so content does not jump, but on Nearby that
 * covered the map's top controls until it was closed. The banner publishes its
 * bottom edge (viewport px) while it is on screen; null when it is not.
 */
import { useSyncExternalStore } from 'react';

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
