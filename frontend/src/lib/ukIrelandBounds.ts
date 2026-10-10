/**
 * UK + Ireland discovery region for map/list "All".
 * Keep numbers aligned with backend/src/lib/ukIrelandBounds.ts.
 */
export type LatLngBox = {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
};

export const UK_IRELAND_BOXES = {
  gbWest: { minLat: 49.85, maxLat: 61.0, minLng: -8.75, maxLng: 0.55 },
  gbEastKent: { minLat: 50.88, maxLat: 51.45, minLng: 0.35, maxLng: 1.45 },
  gbEastAnglia: { minLat: 51.45, maxLat: 53.7, minLng: 0.35, maxLng: 1.8 },
  channelIslands: { minLat: 49.15, maxLat: 49.76, minLng: -2.7, maxLng: -2.0 },
  ireland: { minLat: 51.35, maxLat: 55.45, minLng: -10.75, maxLng: -5.45 },
} as const satisfies Record<string, LatLngBox>;

export function isInUkIreland(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return Object.values(UK_IRELAND_BOXES).some(
    (box) => lat >= box.minLat && lat <= box.maxLat && lng >= box.minLng && lng <= box.maxLng,
  );
}
