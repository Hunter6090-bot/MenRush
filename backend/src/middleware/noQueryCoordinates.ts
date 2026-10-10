import { NextFunction, Request, Response } from 'express';

/**
 * Coordinates never travel in a URL.
 *
 * Request URLs (query strings included) end up in proxy and platform logs
 * (Vercel runtime logs record the search params of every /api request), so a
 * lat/lng in the query string is a member's GPS sitting in a vendor's logs.
 * The app sends its location only in the body of POST /api/users/location, and
 * every read uses the stored location.
 *
 * Default (lenient) mode: any coordinate key in an /api query string (lat,
 * lng, lon, latitude, longitude, ll, coords; also lat[], lat[0], filter[lat])
 * is stripped from req.query, req.url and req.originalUrl before routing, so
 * no route or later logger can read it. A counter logs how often this
 * happens (count per route, never the values). Old cached tabs keep
 * working; their URL coordinates are never stored or used, and every read is
 * served from the stored location. This lets backend and frontend deploy in
 * either order.
 *
 * Strict mode (STRICT_NO_URL_COORDINATES=true, planned for a follow-up PR once
 * old tabs have reloaded): the request is rejected with 400 coordinates_in_url.
 */
export const QUERY_COORDINATE_KEYS = [
  'lat',
  'lng',
  'lon',
  'latitude',
  'longitude',
  'll',
  'coords',
] as const;

/**
 * A query key is a coordinate when any bracket segment is a coordinate name:
 * `lat`, `lat[]`, `lat[0]`, `filter[lat]`, `ll`, `coords[]`. Case-insensitive.
 */
export function isCoordinateKey(key: string): boolean {
  const segments = key
    .toLowerCase()
    .split(/[[\]]/)
    .map((x) => x.trim())
    .filter(Boolean);
  return segments.some((seg) => (QUERY_COORDINATE_KEYS as readonly string[]).includes(seg));
}

function hasCoordinateKeyDeep(value: unknown, depth = 0): boolean {
  if (!value || typeof value !== 'object' || depth > 5) return false;
  return Object.keys(value as Record<string, unknown>).some(
    (k) => isCoordinateKey(k) || hasCoordinateKeyDeep((value as Record<string, unknown>)[k], depth + 1),
  );
}

/** True when the parsed query (nested objects too, e.g. filter[lat]) carries a coordinate key. */
export function hasQueryCoordinates(query: unknown): boolean {
  return hasCoordinateKeyDeep(query);
}

function stripCoordinateKeysDeep(value: unknown, depth = 0): void {
  if (!value || typeof value !== 'object' || depth > 5) return;
  const obj = value as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (isCoordinateKey(key)) delete obj[key];
    else stripCoordinateKeysDeep(obj[key], depth + 1);
  }
}

function decodeKey(rawKey: string): string {
  try {
    return decodeURIComponent(rawKey.replace(/\+/g, ' '));
  } catch {
    return rawKey;
  }
}

/** True when a raw URL's query string carries a coordinate key (any form above). */
export function urlHasCoordinates(url: string | undefined): boolean {
  if (!url) return false;
  const q = url.indexOf('?');
  if (q < 0) return false;
  return url
    .slice(q + 1)
    .split('&')
    .some((pair) => pair && isCoordinateKey(decodeKey(pair.split('=')[0])));
}

/** Remove coordinate keys from a raw URL path + query string. */
export function stripCoordinatesFromUrl(url: string): string {
  const q = url.indexOf('?');
  if (q < 0) return url;
  const path = url.slice(0, q);
  const kept = url
    .slice(q + 1)
    .split('&')
    .filter((pair) => pair && !isCoordinateKey(decodeKey(pair.split('=')[0])));
  return kept.length ? `${path}?${kept.join('&')}` : path;
}

// ── Counter: how often URL coordinates still arrive ───────────────────────────
// Count only (never values, never member ids, never the query string), by the
// first two path segments (e.g. /api/users), so we know when strict mode is
// safe. Logged hourly when non-zero; read with urlCoordinateCounts().
const counts = new Map<string, number>();
let countTimer: NodeJS.Timeout | null = null;
const COUNT_LOG_INTERVAL_MS = 60 * 60 * 1000;

function routeBucket(url: string): string {
  const path = url.split('?')[0];
  const segs = path.split('/').filter(Boolean).slice(0, 2);
  return segs.length ? `/${segs.join('/')}` : '/';
}

function flushUrlCoordinateCounts(): void {
  if (!counts.size) return;
  let total = 0;
  const parts: string[] = [];
  for (const [bucket, n] of counts) {
    total += n;
    parts.push(`${bucket}=${n}`);
  }
  console.log(`[no-url-coords] ${total} request(s) carried URL coordinates in the last hour (stripped): ${parts.join(' ')}`);
  counts.clear();
}

export function recordUrlCoordinates(originalUrl: string): void {
  const bucket = routeBucket(originalUrl);
  counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  if (!countTimer) {
    countTimer = setInterval(flushUrlCoordinateCounts, COUNT_LOG_INTERVAL_MS);
    countTimer.unref?.();
  }
}

/** Snapshot of the current counts (tests, diagnostics). */
export function urlCoordinateCounts(): Record<string, number> {
  return Object.fromEntries(counts);
}

/** Tests only. */
export function resetUrlCoordinateCounts(): void {
  counts.clear();
}

export function strictNoUrlCoordinates(): boolean {
  return String(process.env.STRICT_NO_URL_COORDINATES || '').toLowerCase() === 'true';
}

/** Lenient: drop coordinate keys from req.query and req.url, then carry on. */
export function ignoreQueryCoordinates(req: Request, _res: Response, next: NextFunction) {
  if (hasQueryCoordinates(req.query) || urlHasCoordinates(req.originalUrl) || urlHasCoordinates(req.url)) {
    recordUrlCoordinates(req.originalUrl || req.url);
    stripCoordinateKeysDeep(req.query);
    req.url = stripCoordinatesFromUrl(req.url);
    if (req.originalUrl) req.originalUrl = stripCoordinatesFromUrl(req.originalUrl);
  }
  next();
}

/** Strict: 400 coordinates_in_url. Not mounted by default (see strictNoUrlCoordinates). */
export function rejectQueryCoordinates(req: Request, res: Response, next: NextFunction) {
  if (hasQueryCoordinates(req.query) || urlHasCoordinates(req.originalUrl) || urlHasCoordinates(req.url)) {
    recordUrlCoordinates(req.originalUrl || req.url);
    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(400).json({
      error: 'Location is sent with POST /api/users/location, never in the URL. Please reload the app.',
      code: 'coordinates_in_url',
    });
  }
  next();
}

/** The /api guard: lenient unless STRICT_NO_URL_COORDINATES=true. */
export function noQueryCoordinates(req: Request, res: Response, next: NextFunction) {
  if (strictNoUrlCoordinates()) return rejectQueryCoordinates(req, res, next);
  return ignoreQueryCoordinates(req, res, next);
}
