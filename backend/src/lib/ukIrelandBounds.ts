import { PIN_PREFILTER_BUFFER_M, publicPinSql } from './mapPinSql';

/**
 * UK + Ireland discovery region for map/list "All".
 * Split boxes keep Channel Islands and southeast England without
 * sweeping in northern France (Cherbourg, Caen, Rouen, Le Havre, Dieppe, Boulogne).
 * Not a radius. Excludes US and continental Europe.
 */
export type LatLngBox = {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
};

export const UK_IRELAND_BOXES = {
  /** GB + NI + Scilly / Shetland, west of Greenwich-ish so Normandy stays out. */
  gbWest: { minLat: 49.85, maxLat: 61.0, minLng: -8.75, maxLng: 0.55 },
  /** Kent / Sussex coast — north of Dieppe, west of Boulogne. */
  gbEastKent: { minLat: 50.88, maxLat: 51.45, minLng: 0.35, maxLng: 1.45 },
  /** East Anglia including Lowestoft; Calais is east of maxLng. */
  gbEastAnglia: { minLat: 51.45, maxLat: 53.7, minLng: 0.35, maxLng: 1.8 },
  /** Jersey, Guernsey, Alderney, Sark — Cherbourg stays east of maxLng. */
  channelIslands: { minLat: 49.15, maxLat: 49.76, minLng: -2.7, maxLng: -2.0 },
  ireland: { minLat: 51.35, maxLat: 55.45, minLng: -10.75, maxLng: -5.45 },
} as const satisfies Record<string, LatLngBox>;

function boxSql(box: LatLngBox): string {
  return `(p.lat BETWEEN ${box.minLat} AND ${box.maxLat} AND p.lng BETWEEN ${box.minLng} AND ${box.maxLng})`;
}

/** SQL fragment (profiles p) — real stored lat/lng, not fuzzed map pins. */
export const UK_IRELAND_LOCATION_SQL = `
        AND (
          ${Object.values(UK_IRELAND_BOXES).map(boxSql).join('\n          OR ')}
        )
`;

/**
 * Viewer origin ($1 lat, $2 lng) and $4 must appear in count and list.
 * All binds $4 = 0 so this is not a radius cap.
 */
export const UK_IE_BOUND_PARAMS_SQL = `
        AND ST_Distance(p.location, ST_MakePoint($2, $1)::geography) >= $4
`;

export function nearbyLocationPredicate(scope: 'radius' | 'uk_ie'): string {
  if (scope === 'uk_ie') {
    return `${UK_IRELAND_LOCATION_SQL}${UK_IE_BOUND_PARAMS_SQL}`;
  }
  // Radius is measured to the member's public (Discretion-fuzzed) pin, never raw
  // GPS, so shrinking the radius cannot reveal more than the map pin already shows.
  // The raw-GPS check is only an index prefilter (radius + max fuzz).
  const pin = publicPinSql('p.lat', 'p.lng', 'u.id', 'p.map_pin_fuzz_m');
  return `AND ST_DWithin(p.location, ST_MakePoint($2, $1)::geography, $4::float8 + ${PIN_PREFILTER_BUFFER_M})
        AND ST_DWithin(${pin.geog}, ST_MakePoint($2, $1)::geography, $4::float8)`;
}

export function isInBox(lat: number, lng: number, box: LatLngBox): boolean {
  return lat >= box.minLat && lat <= box.maxLat && lng >= box.minLng && lng <= box.maxLng;
}

export function isInUkIreland(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return Object.values(UK_IRELAND_BOXES).some((box) => isInBox(lat, lng, box));
}
