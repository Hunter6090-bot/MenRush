import { formatDistanceFromKm } from './localeUnits';

export interface DiscoveryPresence {
  distance_km?: string | number | null;
  distance_label?: string | null;
  is_pulsing?: boolean | null;
  pulse_expires_at?: string | null;
  available_until?: string | null;
  /** Backend: last_seen within the 1-hour presence window. */
  online?: boolean | null;
  last_seen?: string | null;
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

/** Pete lock: stay live for 1 hour after last activity / leaving. */
export const PRESENCE_WINDOW_MS = 60 * 60 * 1000;

function lastSeenWithinPresenceWindow(lastSeen?: string | null): boolean {
  if (!lastSeen) return false;
  const ts = new Date(lastSeen).getTime();
  return Number.isFinite(ts) && Date.now() - ts < PRESENCE_WINDOW_MS;
}

/**
 * "Live" / Active now — presence only. Never equate radius/filter headcount with Live.
 * Backend nearby SQL uses last_seen within 1 hour. Also honour last_seen here so a
 * stale `online: false` after disconnect still paints the green photo border.
 */
export function isUserOnlineNow(user: DiscoveryPresence): boolean {
  if (user.online === true) return true;
  return lastSeenWithinPresenceWindow(user.last_seen);
}

/** Count men who are actually online now among a nearby/filtered roster. */
export function countLiveOnline(users: readonly DiscoveryPresence[]): number {
  let n = 0;
  for (const user of users) {
    if (isUserOnlineNow(user)) n += 1;
  }
  return n;
}

/**
 * Member distance label. The server sends a coarse, Discretion-fuzzed label
 * ("<1 mi", "3 mi"); show it as-is so the client never adds precision back.
 * No distance (Show distance off, no location) reads "Nearby".
 */
export function getDistanceLabel(user: DiscoveryPresence): string {
  return memberDistanceLabel(user) ?? 'Nearby';
}

/** The member's distance label, or null when there is none to show. */
export function memberDistanceLabel(user: DiscoveryPresence): string | null {
  const label = typeof user.distance_label === 'string' ? user.distance_label.trim() : '';
  if (label) return label;
  if (user.distance_km == null || user.distance_km === '') return null;
  const km = Number(user.distance_km);
  if (!Number.isFinite(km) || km <= 0) return null;
  return formatDistanceFromKm(km);
}

/**
 * Meta parts that follow the distance label on a card, joined with " · ".
 * Drops blanks and anything that repeats the distance or an earlier part, so a
 * card with no distance never reads "Nearby · Nearby".
 */
export function metaAfterDistance(
  distanceLabel: string,
  parts: Array<string | null | undefined>,
): string {
  const seen = new Set<string>([distanceLabel.trim().toLowerCase()]);
  const out: string[] = [];
  for (const raw of parts) {
    const part = (raw ?? '').trim();
    if (!part) continue;
    const key = part.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(part);
  }
  return out.join(' · ');
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
