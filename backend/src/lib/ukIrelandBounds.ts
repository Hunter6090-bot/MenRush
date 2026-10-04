/**
 * UK + Ireland discovery region for Nearby "All".
 * Boxes are inclusive of GB (incl. NI, Shetland, Channel Islands) and IE.
 * They are not a radius and exclude US / most of continental Europe.
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

/** SQL fragment (profiles p) — real stored lat/lng, not fuzzed map pins. */
export const UK_IRELAND_LOCATION_SQL = `
        AND (
          (p.lat BETWEEN ${UK_BOX.minLat} AND ${UK_BOX.maxLat} AND p.lng BETWEEN ${UK_BOX.minLng} AND ${UK_BOX.maxLng})
          OR (p.lat BETWEEN ${IRELAND_BOX.minLat} AND ${IRELAND_BOX.maxLat} AND p.lng BETWEEN ${IRELAND_BOX.minLng} AND ${IRELAND_BOX.maxLng})
        )
`;

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
