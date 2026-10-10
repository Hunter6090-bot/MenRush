/**
 * Ignore implausible location jumps, so a member cannot teleport their own
 * query point around to triangulate someone (set location, query, move 2 km,
 * query again...). Every location write goes through userService.updateLocation,
 * which asks this gate first; a rejected fix keeps the stored location and only
 * refreshes presence.
 *
 * Allowed move = grace + max speed x time since the last accepted fix. 300 m/s
 * is faster than any airliner, so real travel always passes; the grace covers
 * GPS noise. Kept in memory per process (no schema change). The first fix after
 * a restart is accepted.
 */
export const MAX_PLAUSIBLE_SPEED_MPS = 300;
export const JUMP_GRACE_M = 250;
const MAX_TRACKED = 100_000;

type Fix = { lat: number; lng: number; atMs: number };

export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371008.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function isPlausibleMove(prev: Fix, lat: number, lng: number, nowMs: number): boolean {
  const elapsedS = Math.max(0, (nowMs - prev.atMs) / 1000);
  return (
    distanceMeters(prev.lat, prev.lng, lat, lng) <= JUMP_GRACE_M + MAX_PLAUSIBLE_SPEED_MPS * elapsedS
  );
}

const lastFix = new Map<string, Fix>();

/** True when the fix should be stored; false when it is an implausible jump. */
export function acceptLocationFix(
  userId: string,
  lat: number,
  lng: number,
  nowMs: number = Date.now(),
): boolean {
  const prev = lastFix.get(userId);
  if (prev && !isPlausibleMove(prev, lat, lng, nowMs)) return false;
  lastFix.delete(userId);
  lastFix.set(userId, { lat, lng, atMs: nowMs });
  if (lastFix.size > MAX_TRACKED) {
    const oldest = lastFix.keys().next().value;
    if (oldest !== undefined) lastFix.delete(oldest);
  }
  return true;
}

/** Tests only. */
export function resetLocationJumpGate(): void {
  lastFix.clear();
}
