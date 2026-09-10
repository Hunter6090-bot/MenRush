import { formatDistanceFromKm } from './localeUnits';

export interface DiscoveryPresence {
  distance_km?: string | number | null;
  distance_label?: string | null;
  is_pulsing?: boolean | null;
  pulse_expires_at?: string | null;
  available_until?: string | null;
  /** Backend: online=true AND last_seen within the presence window (~20m). */
  online?: boolean | null;
}

function hasFutureTimestamp(value?: string | null): boolean {
  if (!value) return false;
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) && ts > Date.now();
}

export function isUserPulsing(user: DiscoveryPresence): boolean {
  if (user.is_pulsing) return true;
  return hasFutureTimestamp(user.pulse_expires_at) || hasFutureTimestamp(user.available_until);
}

/**
 * "Live" / Active now — presence only. Never equate radius/filter headcount with Live.
 * Matches backend nearby SQL: online AND last_seen within ~20 minutes.
 */
export function isUserOnlineNow(user: DiscoveryPresence): boolean {
  return user.online === true;
}

/** Count men who are actually online now among a nearby/filtered roster. */
export function countLiveOnline(users: readonly DiscoveryPresence[]): number {
  let n = 0;
  for (const user of users) {
    if (isUserOnlineNow(user)) n += 1;
  }
  return n;
}

export function getDistanceLabel(user: DiscoveryPresence): string {
  const km = Number(user.distance_km ?? 0);
  if (!Number.isFinite(km) || km <= 0) return 'Nearby';
  return formatDistanceFromKm(km);
}

/** Great-circle distance in metres (for throttling map/GPS updates). */
export function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
