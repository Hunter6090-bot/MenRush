/**
 * Resolve a typed town/city to a UK or Ireland settlement geometry.
 * Nominatim is constrained to gb,ie — never US / other countries.
 * Only real town/city (not hamlet/village/suburb) so place search cannot
 * walk small places to narrow a precise pin.
 * Does not reverse-geocode profiles or invent a city for unpinned users.
 */

export type NominatimHit = {
  display_name?: string;
  class?: string;
  type?: string;
  addresstype?: string;
  name?: string;
  importance?: number;
  boundingbox?: string[];
  geojson?: { type: string; coordinates: unknown };
  address?: {
    country_code?: string;
    city?: string;
    town?: string;
    village?: string;
    hamlet?: string;
    suburb?: string;
    municipality?: string;
  };
};

export type UkIePlace = {
  displayName: string;
  countryCode: 'gb' | 'ie';
  south: number;
  north: number;
  west: number;
  east: number;
  geojson: { type: string; coordinates: unknown } | null;
};

/** Human copy only — never leak raw codes to clients. */
export const PLACE_LOOKUP_FAILED_MESSAGE =
  "Couldn't look up that place. Try another UK or Ireland town or city.";

export class PlaceLookupError extends Error {
  constructor(message = PLACE_LOOKUP_FAILED_MESSAGE) {
    super(message);
    this.name = 'PlaceLookupError';
  }
}

/** Town / city only — exclude hamlet, village, suburb, neighbourhood, city_district. */
const SETTLEMENT_TYPES = new Set(['city', 'town', 'municipality']);

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'MenRushProfilePlaceSearch/1.0 (https://menrush.com)';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_MAX = 400;

const cache = new Map<string, { at: number; value: UkIePlace | null }>();
const inflight = new Map<string, Promise<UkIePlace | null>>();

export function normalizePlaceQuery(q: string): string {
  return q.trim().replace(/\s+/g, ' ');
}

function countryCode(hit: NominatimHit): 'gb' | 'ie' | null {
  const cc = hit.address?.country_code?.trim().toLowerCase();
  if (cc === 'gb' || cc === 'uk') return 'gb';
  if (cc === 'ie') return 'ie';
  return null;
}

function settlementLabel(hit: NominatimHit): string {
  return (
    hit.address?.city ||
    hit.address?.town ||
    hit.address?.municipality ||
    hit.name ||
    ''
  ).trim();
}

export function isUkIeSettlement(hit: NominatimHit): boolean {
  if (!countryCode(hit)) return false;
  const kind = (hit.addresstype || hit.type || '').toLowerCase();
  if (SETTLEMENT_TYPES.has(kind)) return true;
  if (hit.class === 'place' && SETTLEMENT_TYPES.has((hit.type || '').toLowerCase())) {
    return true;
  }
  // Administrative boundary only when labelled as a city/town/municipality.
  if (hit.class === 'boundary' && (hit.type || '').toLowerCase() === 'administrative') {
    return Boolean(hit.address?.city || hit.address?.town || hit.address?.municipality);
  }
  return false;
}

function parseBbox(hit: NominatimHit): {
  south: number;
  north: number;
  west: number;
  east: number;
} | null {
  const box = hit.boundingbox;
  if (!box || box.length < 4) return null;
  const south = Number(box[0]);
  const north = Number(box[1]);
  const west = Number(box[2]);
  const east = Number(box[3]);
  if (![south, north, west, east].every(Number.isFinite)) return null;
  if (south >= north) return null;
  return { south, north, west, east };
}

function usableGeojson(hit: NominatimHit): UkIePlace['geojson'] {
  const g = hit.geojson;
  if (!g || typeof g.type !== 'string' || g.coordinates == null) return null;
  const t = g.type.toLowerCase();
  if (t !== 'polygon' && t !== 'multipolygon') return null;
  return g;
}

export function pickUkIeSettlement(hits: NominatimHit[], query: string): UkIePlace | null {
  const needle = normalizePlaceQuery(query).toLowerCase();
  const ranked = hits
    .filter(isUkIeSettlement)
    .map((hit) => {
      const bbox = parseBbox(hit);
      const cc = countryCode(hit);
      if (!bbox || !cc) return null;
      const label = settlementLabel(hit);
      const display = label || hit.display_name || query;
      const exact = label.toLowerCase() === needle;
      return {
        place: {
          displayName: display,
          countryCode: cc,
          ...bbox,
          geojson: usableGeojson(hit),
        } satisfies UkIePlace,
        exact,
        importance: Number(hit.importance) || 0,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .sort((a, b) => {
      if (a.exact !== b.exact) return a.exact ? -1 : 1;
      return b.importance - a.importance;
    });

  return ranked[0]?.place ?? null;
}

function ringContains(lng: number, lat: number, ring: number[][]): boolean {
  // Ray cast — ring is [lng, lat][]
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi + 0.0) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function geojsonContains(geojson: NonNullable<UkIePlace['geojson']>, lat: number, lng: number): boolean {
  const t = geojson.type.toLowerCase();
  const coords = geojson.coordinates as unknown;
  if (t === 'polygon' && Array.isArray(coords) && Array.isArray(coords[0])) {
    const rings = coords as number[][][];
    if (!ringContains(lng, lat, rings[0])) return false;
    for (let i = 1; i < rings.length; i++) {
      if (ringContains(lng, lat, rings[i])) return false; // hole
    }
    return true;
  }
  if (t === 'multipolygon' && Array.isArray(coords)) {
    for (const poly of coords as number[][][][]) {
      if (!Array.isArray(poly?.[0])) continue;
      if (!ringContains(lng, lat, poly[0])) continue;
      let inHole = false;
      for (let i = 1; i < poly.length; i++) {
        if (ringContains(lng, lat, poly[i])) {
          inHole = true;
          break;
        }
      }
      if (!inHole) return true;
    }
    return false;
  }
  return false;
}

/** True when a discretionary (fuzzed) map point falls inside the place. */
export function placeContainsPoint(place: UkIePlace, lat: number, lng: number): boolean {
  if (![lat, lng].every(Number.isFinite)) return false;
  if (place.geojson) {
    return geojsonContains(place.geojson, lat, lng);
  }
  return (
    lat >= place.south &&
    lat <= place.north &&
    lng >= place.west &&
    lng <= place.east
  );
}

function cacheGet(key: string): UkIePlace | null | undefined {
  const row = cache.get(key);
  if (!row) return undefined;
  if (Date.now() - row.at > CACHE_TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  return row.value;
}

function cacheSet(key: string, value: UkIePlace | null) {
  if (cache.size >= CACHE_MAX) {
    const first = cache.keys().next().value;
    if (first) cache.delete(first);
  }
  cache.set(key, { at: Date.now(), value });
}

export async function lookupUkIePlace(q: string): Promise<UkIePlace | null> {
  const term = normalizePlaceQuery(q);
  if (term.length < 2) return null;
  const key = term.toLowerCase();
  const cached = cacheGet(key);
  if (cached !== undefined) return cached;

  const pending = inflight.get(key);
  if (pending) return pending;

  const job = (async () => {
    const url = new URL(NOMINATIM_URL);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('limit', '8');
    url.searchParams.set('countrycodes', 'gb,ie');
    url.searchParams.set('polygon_geojson', '1');
    url.searchParams.set('q', term);

    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 5000);
    let res: Response;
    try {
      res = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/json',
        },
        signal: ac.signal,
      });
    } catch {
      throw new PlaceLookupError();
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) throw new PlaceLookupError();

    let data: NominatimHit[] = [];
    try {
      const json = await res.json();
      data = Array.isArray(json) ? json : [];
    } catch {
      throw new PlaceLookupError();
    }

    const place = pickUkIeSettlement(data, term);
    cacheSet(key, place);
    return place;
  })();

  inflight.set(key, job);
  try {
    return await job;
  } finally {
    inflight.delete(key);
  }
}
