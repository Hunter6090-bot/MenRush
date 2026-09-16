/**
 * Nearby visitor fresh-face boost — honest home vs away detection.
 *
 * Approach (no H3, no reverse-geocode, no invented density):
 * - Seed home from the first GPS point (or keep existing home).
 * - "Home area" = within HOME_RADIUS_KM of home (city-scale ~40 km).
 * - Leaving home starts a visitor window with VISITOR_TTL_HOURS (48h default).
 * - TTL does not refresh on every GPS tick — expires, then normal ranking.
 * - Moving to a new cell (far from visit anchor) starts a fresh window.
 * - Returning home clears visitor fields.
 *
 * Brand face (shared with account-age NEW): pill `NEW`, helper `Just joined`.
 */

/** City-scale home radius — inside = home, outside = candidate visitor. */
export const HOME_RADIUS_KM = 40;

/** Fresh-face boost duration in a visit cell/town (documented product constant). */
export const VISITOR_TTL_HOURS = 48;

/** Same Brand pill as newly joined accounts. */
export const VISITOR_NEW_LABEL = 'NEW';

/** Same Brand helper as newly joined accounts. */
export const VISITOR_NEW_HELPER = 'Just joined';

const EARTH_RADIUS_KM = 6371;

/** Great-circle distance in km. */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

export function isOutsideHome(
  lat: number,
  lng: number,
  homeLat: number,
  homeLng: number,
  radiusKm: number = HOME_RADIUS_KM,
): boolean {
  return haversineKm(lat, lng, homeLat, homeLng) > radiusKm;
}

export type VisitorProfileState = {
  home_lat: number | null;
  home_lng: number | null;
  visitor_since: Date | string | null;
  visitor_expires_at: Date | string | null;
  visitor_anchor_lat: number | null;
  visitor_anchor_lng: number | null;
};

export type VisitorUpdate =
  | { action: 'seed_home'; homeLat: number; homeLng: number }
  | { action: 'clear_visitor' }
  | {
      action: 'start_visit';
      anchorLat: number;
      anchorLng: number;
      since: Date;
      expiresAt: Date;
    }
  | { action: 'noop' };

function toMs(value: Date | string | null | undefined): number | null {
  if (value == null) return null;
  const ts = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(ts) ? ts : null;
}

/**
 * Decide how to update visitor/home fields for one location ping.
 * Pure — no DB. Callers apply the returned action in SQL.
 */
export function planVisitorLocationUpdate(
  lat: number,
  lng: number,
  state: VisitorProfileState,
  now: Date = new Date(),
  opts?: { homeRadiusKm?: number; ttlHours?: number },
): VisitorUpdate {
  const homeRadiusKm = opts?.homeRadiusKm ?? HOME_RADIUS_KM;
  const ttlHours = opts?.ttlHours ?? VISITOR_TTL_HOURS;

  const homeLat = state.home_lat != null ? Number(state.home_lat) : null;
  const homeLng = state.home_lng != null ? Number(state.home_lng) : null;
  const hasHome =
    homeLat != null &&
    homeLng != null &&
    Number.isFinite(homeLat) &&
    Number.isFinite(homeLng);

  // First GPS → seed home. Not a visitor yet (they live here).
  if (!hasHome) {
    return { action: 'seed_home', homeLat: lat, homeLng: lng };
  }

  const away = isOutsideHome(lat, lng, homeLat!, homeLng!, homeRadiusKm);
  if (!away) {
    // Back home — clear any visit boost.
    if (state.visitor_expires_at || state.visitor_since) {
      return { action: 'clear_visitor' };
    }
    return { action: 'noop' };
  }

  const expiresMs = toMs(state.visitor_expires_at);
  const active = expiresMs != null && expiresMs > now.getTime();
  const anchorLat =
    state.visitor_anchor_lat != null ? Number(state.visitor_anchor_lat) : null;
  const anchorLng =
    state.visitor_anchor_lng != null ? Number(state.visitor_anchor_lng) : null;
  const hasAnchor =
    anchorLat != null &&
    anchorLng != null &&
    Number.isFinite(anchorLat) &&
    Number.isFinite(anchorLng);

  // Still in the same visit cell with live TTL — do not refresh (honest expiry).
  if (active && hasAnchor) {
    const stillInCell = haversineKm(lat, lng, anchorLat!, anchorLng!) <= homeRadiusKm;
    if (stillInCell) return { action: 'noop' };
  }

  // New town (or first leave home / expired prior visit): start fresh-face window.
  const since = now;
  const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000);
  return {
    action: 'start_visit',
    anchorLat: lat,
    anchorLng: lng,
    since,
    expiresAt,
  };
}

/** Active visitor boost right now? */
export function isVisitorBoostActive(
  visitorExpiresAt: string | Date | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  const ms = toMs(visitorExpiresAt ?? null);
  return ms != null && ms > nowMs;
}
