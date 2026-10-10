import { MAP_PIN_FUZZ_DEFAULT_M, MAP_PIN_FUZZ_MAX_M, MAP_PIN_FUZZ_MIN_M } from './mapPinFuzz';

/**
 * SQL twin of privateMapPointAround (seed `map:<userId>`): the member's public,
 * Discretion-fuzzed pin, the same point the map shows to viewers.
 *
 * Radius filters must use this point, never raw GPS (`p.location`). Filtering on
 * raw GPS lets a viewer shrink the radius (or step their origin) until a member
 * drops out, which gives away the real distance to about 10 m whatever the
 * member's Discretion setting.
 *
 * Arguments are SQL expressions: real lat, real lng, member id, max fuzz (m).
 */
export function publicPinSql(
  latExpr: string,
  lngExpr: string,
  idExpr: string,
  fuzzExpr: string,
): { lat: string; lng: string; geog: string } {
  const hash = `sha256(convert_to('map:' || (${idExpr})::text, 'UTF8'))`;
  const u0 = `(get_byte(${hash}, 0) * 256 + get_byte(${hash}, 1))`;
  const u2 = `(get_byte(${hash}, 2) * 256 + get_byte(${hash}, 3))`;
  const fmax = `LEAST(${MAP_PIN_FUZZ_MAX_M}, GREATEST(${MAP_PIN_FUZZ_MIN_M}, ROUND(COALESCE((${fuzzExpr})::numeric, ${MAP_PIN_FUZZ_DEFAULT_M}))))`;
  const fmin = `GREATEST(40, ROUND(${fmax} * 0.25))`;
  const meters = `((${fmin} + MOD(${u0}, ${fmax} - ${fmin} + 1))::float8)`;
  const bearing = `((MOD(${u2}, 360) * pi()) / 180)`;
  const dLat = `((${meters} / 1000 / 111) * cos(${bearing}))`;
  const lngScale = `GREATEST(cos(((${latExpr}) * pi()) / 180), 0.2)`;
  const dLng = `((${meters} / 1000 / (111 * ${lngScale})) * sin(${bearing}))`;
  const lat = `(ROUND(((${latExpr}) + ${dLat})::numeric, 6)::float8)`;
  const lng = `(ROUND(((${lngExpr}) + ${dLng})::numeric, 6)::float8)`;
  return { lat, lng, geog: `ST_MakePoint(${lng}, ${lat})::geography` };
}

/**
 * The pin never sits more than the max fuzz from raw GPS, so a raw-GPS
 * ST_DWithin(radius + this buffer) is a safe index prefilter: it keeps every
 * member whose pin is inside the radius and changes no result.
 */
export const PIN_PREFILTER_BUFFER_M = MAP_PIN_FUZZ_MAX_M + 200;

/** Same radius bounds as Nearby (/api/users/nearby) and Community. */
export const RADIUS_KM_MIN = 0.8;
export const RADIUS_KM_MAX = 161;

export function clampRadiusKm(radiusKm: number | undefined, fallbackKm: number): number {
  const r = radiusKm !== undefined && Number.isFinite(radiusKm) ? radiusKm : fallbackKm;
  return Math.min(Math.max(r, RADIUS_KM_MIN), RADIUS_KM_MAX);
}
