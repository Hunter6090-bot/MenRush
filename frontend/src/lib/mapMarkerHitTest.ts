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
 * Nearest candidate whose projected screen position is within its hit radius
 * of `point`. Prefer closer pins when several overlap.
 */
export function hitTestMapPins<TKind extends string>(
  map: MapProjectable,
  point: ScreenPoint,
  candidates: Array<HitCandidate<TKind>>,
): HitResult<TKind> | null {
  let best: HitResult<TKind> | null = null;

  for (const c of candidates) {
    if (!Number.isFinite(c.lng) || !Number.isFinite(c.lat) || c.radiusPx <= 0) continue;
    const projected = map.project([c.lng, c.lat]);
    const distancePx = Math.hypot(projected.x - point.x, projected.y - point.y);
    if (distancePx > c.radiusPx) continue;
    if (!best || distancePx < best.distancePx) {
      best = { ...c, distancePx };
    }
  }

  return best;
}

/** People face pins — pulsing markers are slightly larger. */
export function peoplePinHitRadiusPx(isPulsing: boolean): number {
  return isPulsing ? 34 : 28;
}

/**
 * Cruise / Hot Spot HTML pins include label + padding; use a generous radius so
 * taps still open the sheet while gestures pass through to the canvas.
 */
export function hotSpotPinHitRadiusPx(occupied: boolean): number {
  return occupied ? 48 : 40;
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
