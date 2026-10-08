import {
  MAP_PIN_FUZZ_DEFAULT_M,
  privateMapPointAround,
} from './mapPinFuzz';

/**
 * Member-to-member distance for Nearby, profiles and Community.
 *
 * Privacy rules (Pete, Oct 2026):
 *  - Distance is measured to the member's FUZZED map pin (the same Discretion
 *    offset the map uses, seed `map:<userId>`), never to raw GPS. The offset is
 *    deterministic per member so repeated checks do not jitter and cannot be
 *    averaged back to the real point.
 *  - Coarse UK miles only: under 1 mile reads "<1 mi", then whole miles.
 *  - When the member has Show distance off, no distance field is returned at all.
 *    Callers spread `{}` so the payload shape matches every other "no distance"
 *    case (no viewer location, ghost, hidden), with no flag that tells them apart.
 */

export const METERS_PER_MILE = 1609.344;

/** Sort key (km) for the "<1 mi" bucket: half a mile, so it sorts first. */
const UNDER_ONE_MILE_SORT_KM = 0.8;

export type MemberDistanceFields = {
  /** Coarse bucket in km, for sorting only. Matches distance_label. */
  distance_km: string;
  /** "<1 mi" or whole miles, e.g. "3 mi". */
  distance_label: string;
};

/** Great-circle distance in metres. */
export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371008.8;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** "<1 mi" under one mile, then whole miles. */
export function coarseMilesFromMeters(meters: number): MemberDistanceFields {
  const miles = Math.max(0, Number(meters) || 0) / METERS_PER_MILE;
  if (miles < 1) {
    return { distance_km: UNDER_ONE_MILE_SORT_KM.toFixed(2), distance_label: '<1 mi' };
  }
  const whole = Math.max(1, Math.round(miles));
  return {
    distance_km: ((whole * METERS_PER_MILE) / 1000).toFixed(2),
    distance_label: `${whole} mi`,
  };
}

function finite(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

/** The member's public (fuzzed) pin, same as the map shows. */
export function memberPublicPin(
  memberId: string,
  realLat: number,
  realLng: number,
  fuzzMaxM: number | null | undefined,
): { lat: number; lng: number } {
  const fuzz = Number(fuzzMaxM);
  return privateMapPointAround(
    realLat,
    realLng,
    `map:${memberId}`,
    Number.isFinite(fuzz) ? fuzz : MAP_PIN_FUZZ_DEFAULT_M,
  );
}

export type MemberDistanceInput = {
  memberId: string;
  /** Viewer origin (their own location). */
  viewerLat: number | null | undefined;
  viewerLng: number | null | undefined;
  /** Member's stored location (or the point a post was made at). */
  memberLat: number | null | undefined;
  memberLng: number | null | undefined;
  /** Member's Discretion setting (map_pin_fuzz_m). */
  fuzzMaxM: number | null | undefined;
  /** Member's Show distance setting. NULL/undefined = on (default). */
  showDistance: boolean | null | undefined;
  /** Extra suppression (e.g. viewer is on the member's hide list). */
  suppress?: boolean;
};

/**
 * Either `{ distance_km, distance_label }` or `{}`. Never null fields, never a
 * reason, so "Show distance off" and every other no-distance case look the same.
 */
export function memberDistanceFields(
  input: MemberDistanceInput,
): MemberDistanceFields | Record<string, never> {
  if (input.suppress) return {};
  if (input.showDistance === false) return {};
  const vLat = input.viewerLat != null ? Number(input.viewerLat) : NaN;
  const vLng = input.viewerLng != null ? Number(input.viewerLng) : NaN;
  const mLat = input.memberLat != null ? Number(input.memberLat) : NaN;
  const mLng = input.memberLng != null ? Number(input.memberLng) : NaN;
  if (!finite(vLat) || !finite(vLng) || !finite(mLat) || !finite(mLng)) return {};
  const pin = memberPublicPin(input.memberId, mLat, mLng, input.fuzzMaxM);
  return coarseMilesFromMeters(haversineMeters(vLat, vLng, pin.lat, pin.lng));
}
