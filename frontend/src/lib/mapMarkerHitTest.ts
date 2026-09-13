/**
 * Nearby map pins are HTML Mapbox markers. If they capture pointer events, they
 * steal pan/pinch from the GL canvas and the map feels sticky on phone —
 * Android Chrome and iPhone alike (owner lock: not iOS-only). Soft continuous
 * drag/pinch requires the canvas to own every touch (native dragPan +
 * touchZoomRotate + inertia). #224's panBy forwarding cannot meet that bar.
 *
 * Contract:
 * - Markers: pointer-events: none (including descendants)
 * - Taps: map click → project lng/lat → nearest pin within a hit radius
 * - Overlap piles: keep true lng/lat (no spiderfy); cycle taps through the stack
 */

export type ScreenPoint = { x: number; y: number };

export type MapProjectable = {
  project: (lngLat: { lng: number; lat: number } | [number, number]) => ScreenPoint;
};

export type HitCandidate<TKind extends string> = {
  kind: TKind;
  lng: number;
  lat: number;
  /** Half-diagonal / radius of the visible pin in CSS pixels. */
  radiusPx: number;
  id: string;
};

export type HitResult<TKind extends string> = HitCandidate<TKind> & {
  distancePx: number;
};

/**
 * All candidates whose projected screen position is within its hit radius of
 * `point`, nearest first. Pins stay at true lng/lat — no screen-space fan.
 */
export function listHitTestMapPins<TKind extends string>(
  map: MapProjectable,
  point: ScreenPoint,
  candidates: Array<HitCandidate<TKind>>,
): Array<HitResult<TKind>> {
  const hits: Array<HitResult<TKind>> = [];

  for (const c of candidates) {
    if (!Number.isFinite(c.lng) || !Number.isFinite(c.lat) || c.radiusPx <= 0) continue;
    const projected = map.project([c.lng, c.lat]);
    const distancePx = Math.hypot(projected.x - point.x, projected.y - point.y);
    if (distancePx > c.radiusPx) continue;
    hits.push({ ...c, distancePx });
  }

  hits.sort((a, b) => a.distancePx - b.distancePx || a.id.localeCompare(b.id));
  return hits;
}

/**
 * Nearest candidate whose projected screen position is within its hit radius
 * of `point`. Prefer closer pins when several overlap.
 */
export function hitTestMapPins<TKind extends string>(
  map: MapProjectable,
  point: ScreenPoint,
  candidates: Array<HitCandidate<TKind>>,
): HitResult<TKind> | null {
  const hits = listHitTestMapPins(map, point, candidates);
  return hits[0] ?? null;
}

/**
 * When several pins share nearly the same screen pixel (overlap pile), cycle
 * through them on repeated taps so none are permanently buried. Still uses
 * true lng/lat projection — never relocates markers (Al #254 lock).
 */
export function cycleHitTestMapPins<TKind extends string>(
  map: MapProjectable,
  point: ScreenPoint,
  candidates: Array<HitCandidate<TKind>>,
  lastHitId: string | null,
  /** Pins within this many px of the nearest hit's projected center count as one pile. */
  stackTolerancePx = 18,
): HitResult<TKind> | null {
  const hits = listHitTestMapPins(map, point, candidates);
  if (hits.length === 0) return null;
  const nearest = hits[0];
  const nearestProj = map.project([nearest.lng, nearest.lat]);
  const pile = hits.filter((h) => {
    const p = map.project([h.lng, h.lat]);
    return Math.hypot(p.x - nearestProj.x, p.y - nearestProj.y) <= stackTolerancePx;
  });

  if (pile.length <= 1) return nearest;

  const lastIdx = lastHitId ? pile.findIndex((h) => h.id === lastHitId) : -1;
  return pile[(lastIdx + 1) % pile.length] ?? nearest;
}

/** People face pins — pulsing markers are slightly larger. */
export function peoplePinHitRadiusPx(isPulsing: boolean): number {
  return isPulsing ? 34 : 28;
}

/**
 * Cruise / Hot Spot HTML pins — keep hit radius tight so people under/near
 * Cruise pins stay tappable (labels are zoom-gated separately).
 */
export function hotSpotPinHitRadiusPx(occupied: boolean): number {
  return occupied ? 36 : 30;
}

export function selfPinHitRadiusPx(isPulsing: boolean): number {
  return isPulsing ? 36 : 30;
}

/**
 * Mark a marker element as canvas-pass-through so e2e can assert the soft-gesture
 * contract (no HTML capture of pan/pinch).
 */
export function markMarkerCanvasPassThrough(el: HTMLElement): void {
  el.style.pointerEvents = 'none';
  el.style.touchAction = 'none';
  el.dataset.mapCanvasPassThrough = '1';
  // Descendants can re-enable pointer-events even when the parent is none —
  // force the whole subtree off so faces/labels never steal Mapbox touches.
  el.querySelectorAll<HTMLElement>('*').forEach((child) => {
    child.style.pointerEvents = 'none';
  });
}
