/**
 * UK + Ireland discovery region for map/list "All".
 * Keep numbers aligned with backend/src/lib/ukIrelandBounds.ts.
 */
export const UK_BOX = {
  minLat: 49.15,
  maxLat: 61.0,
  minLng: -8.75,
  maxLng: 1.85,
} as const;

export const IRELAND_BOX = {
  minLat: 51.35,
  maxLat: 55.45,
  minLng: -10.75,
  maxLng: -5.45,
} as const;

export function isInUkIreland(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  const inUk =
    lat >= UK_BOX.minLat && lat <= UK_BOX.maxLat && lng >= UK_BOX.minLng && lng <= UK_BOX.maxLng;
  const inIe =
    lat >= IRELAND_BOX.minLat &&
    lat <= IRELAND_BOX.maxLat &&
    lng >= IRELAND_BOX.minLng &&
    lng <= IRELAND_BOX.maxLng;
  return inUk || inIe;
}
