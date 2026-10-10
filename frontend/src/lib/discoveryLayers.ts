/**
 * Show/hide state for the Nearby map's independent People / Cruise layers (#67).
 * Face is Cruise; storage key `hotSpots` kept for session continuity.
 *
 * Explicitly session-only per the issue's approved product decision ("persist layer
 * selection for the current browser session only, not a long-lived preference") —
 * sessionStorage, not localStorage, so it clears when the tab/browser session ends.
 */
export type DiscoveryLayerKey = 'people' | 'hotSpots';

const STORAGE_PREFIX = 'menrush_discovery_layer_';

export function readLayerVisible(layer: DiscoveryLayerKey, fallback = true): boolean {
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + layer);
    if (raw === '1') return true;
    if (raw === '0') return false;
  } catch {
    /* private mode */
  }
  return fallback;
}

export function writeLayerVisible(layer: DiscoveryLayerKey, visible: boolean): void {
  try {
    sessionStorage.setItem(STORAGE_PREFIX + layer, visible ? '1' : '0');
  } catch {
    /* ignore */
  }
}
