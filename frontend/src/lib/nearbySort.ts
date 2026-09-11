/**
 * Nearby roster sort modes — explicit Nearest vs Latest choice.
 *
 * Default: Nearest (distance-first). Session persistence via localStorage.
 * Latest: newest signups / fresh faces first (same NEW window + visitor
 * fresh-face as Brand NEW — do not invent users).
 *
 * Status NEW filter stays independent (filters + its own within-set sort).
 * Tribe filters / Chat inbox NEW / avatar treatment are out of scope.
 */
import type { NearbyUser } from '../components/ProfileCard';
import { createdAtMs, isFreshFaceNearby, isNewlyJoined, isVisitorFresh } from './newJoiner';

export type NearbySortMode = 'nearest' | 'latest';

export const NEARBY_SORT_STORAGE_KEY = 'menrush_nearby_sort';

/** Brand-safe short labels — Product/Brand glance: Nearest / Latest. */
export const NEARBY_SORT_LABELS: Record<NearbySortMode, string> = {
  nearest: 'Nearest',
  latest: 'Latest',
};

export const DEFAULT_NEARBY_SORT: NearbySortMode = 'nearest';

export function isNearbySortMode(value: unknown): value is NearbySortMode {
  return value === 'nearest' || value === 'latest';
}

export function readNearbySort(): NearbySortMode {
  try {
    const raw = localStorage.getItem(NEARBY_SORT_STORAGE_KEY);
    if (isNearbySortMode(raw)) return raw;
  } catch {
    /* ignore */
  }
  return DEFAULT_NEARBY_SORT;
}

export function writeNearbySort(mode: NearbySortMode): void {
  try {
    localStorage.setItem(NEARBY_SORT_STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
}

function distanceKm(user: NearbyUser): number {
  const n = parseFloat(String(user.distance_km));
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
}

/** Latest within fresh faces: joiners (newest first), then active visitors. */
function compareFreshFaceOrder(a: NearbyUser, b: NearbyUser): number {
  const aJoin = isNewlyJoined(a.created_at) ? 1 : 0;
  const bJoin = isNewlyJoined(b.created_at) ? 1 : 0;
  if (aJoin !== bJoin) return bJoin - aJoin;
  if (aJoin && bJoin) {
    const byAge = createdAtMs(b.created_at) - createdAtMs(a.created_at);
    if (byAge !== 0) return byAge;
  }
  const aVis = isVisitorFresh(a) ? 1 : 0;
  const bVis = isVisitorFresh(b) ? 1 : 0;
  if (aVis !== bVis) return bVis - aVis;
  const byVisitor = createdAtMs(b.visitor_expires_at) - createdAtMs(a.visitor_expires_at);
  if (byVisitor !== 0) return byVisitor;
  return distanceKm(a) - distanceKm(b);
}

/**
 * Sort the Nearby roster for Grid (and Map marker listing order).
 * - nearest: closest first (pure distance).
 * - latest: fresh faces first, then remaining by account created_at desc.
 */
export function sortNearbyUsers(users: NearbyUser[], mode: NearbySortMode): NearbyUser[] {
  const list = [...users];
  if (mode === 'nearest') {
    return list.sort((a, b) => distanceKm(a) - distanceKm(b));
  }
  return list.sort((a, b) => {
    const aFresh = isFreshFaceNearby(a) ? 1 : 0;
    const bFresh = isFreshFaceNearby(b) ? 1 : 0;
    if (aFresh !== bFresh) return bFresh - aFresh;
    if (aFresh && bFresh) return compareFreshFaceOrder(a, b);
    const byCreated = createdAtMs(b.created_at) - createdAtMs(a.created_at);
    if (byCreated !== 0) return byCreated;
    return distanceKm(a) - distanceKm(b);
  });
}
