/**
 * Pin overlap helpers for Nearby map chrome (Al P0 busy-map).
 *
 * Contract (locks #254):
 * - Markers always use true lng/lat via Mapbox setLngLat — no spiderfy column.
 * - Dense piles stay tappable via cycleHitTestMapPins + tighter Cruise hit radii.
 * - Labels hide when zoomed out so Hot Spot name pills do not form an unpressable blob.
 */

export const HOTSPOT_LABEL_MIN_ZOOM = 13;

export function shouldShowHotSpotLabel(zoom: number): boolean {
  return Number.isFinite(zoom) && zoom >= HOTSPOT_LABEL_MIN_ZOOM;
}

/** People above occupied Cruise above empty Cruise — visual only, same geography. */
export function mapPinZIndex(kind: 'self' | 'person' | 'hotspot', occupied = false): number {
  if (kind === 'self') return 6;
  if (kind === 'person') return 5;
  return occupied ? 4 : 2;
}

export type OverlapPoint = { id: string; x: number; y: number };

/**
 * Group projected screen points that sit within `tolerancePx` of each other.
 * Used for tests / diagnostics — does not relocate markers.
 */
export function groupScreenOverlaps(
  points: OverlapPoint[],
  tolerancePx = 28,
): Array<OverlapPoint[]> {
  const used = new Set<string>();
  const groups: Array<OverlapPoint[]> = [];
  for (const p of points) {
    if (used.has(p.id)) continue;
    const group = [p];
    used.add(p.id);
    for (const q of points) {
      if (used.has(q.id)) continue;
      if (Math.hypot(p.x - q.x, p.y - q.y) <= tolerancePx) {
        group.push(q);
        used.add(q.id);
      }
    }
    groups.push(group);
  }
  return groups;
}
