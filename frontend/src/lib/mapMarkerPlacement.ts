/**
 * Nearby / Cruise map pin placement contract (Al P0).
 *
 * Every HTML Mapbox marker must sit at its true lng/lat. Never apply screen-space
 * spiderfy, vertical stacks, collision fans, or document-flow offsets that move
 * pins off geography when zoomed out. Overlap/condensation is preferred.
 *
 * Mapbox requires the marker root to keep `position: absolute` (see mapbox-gl.css).
 * Setting `position: relative|static` on that root causes the classic vertical
 * column bug (Mapbox GL JS #4048 / #7258).
 */

export type GeoPoint = { lng: number; lat: number };

/** True when a Mapbox marker root style would break geographic placement. */
export function markerRootBreaksGeographicPlacement(
  style: Partial<CSSStyleDeclaration> | { position?: string },
): boolean {
  const position = String(style.position ?? '').trim().toLowerCase();
  return position === 'relative' || position === 'static' || position === 'sticky';
}

/**
 * Detect a non-geographic vertical stack: many pins share nearly the same screen X
 * while spanning a large screen Y range — the zoomed-out "column over the Channel" shape.
 */
export function looksLikeVerticalMarkerStack(
  screenPoints: Array<{ x: number; y: number }>,
  opts?: { minCount?: number; maxXSpreadPx?: number; minYSpanPx?: number },
): boolean {
  const minCount = opts?.minCount ?? 4;
  const maxXSpreadPx = opts?.maxXSpreadPx ?? 28;
  const minYSpanPx = opts?.minYSpanPx ?? 120;
  if (screenPoints.length < minCount) return false;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of screenPoints) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return false;
  return maxX - minX <= maxXSpreadPx && maxY - minY >= minYSpanPx;
}

/** Projected screen points must stay near their true lng/lat projection (no spider offset). */
export function markerStaysAtProjectedPoint(
  projected: { x: number; y: number },
  rendered: { x: number; y: number },
  tolerancePx = 2,
): boolean {
  return (
    Math.hypot(projected.x - rendered.x, projected.y - rendered.y) <= tolerancePx
  );
}
