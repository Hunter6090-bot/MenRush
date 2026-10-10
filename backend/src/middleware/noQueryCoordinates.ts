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
 * Default (lenient) mode: any coordinate key in an /api query string is
 * stripped before routing, so no route can read it. Old cached tabs keep
 * working; their URL coordinates are never stored or used, and every read is
 * served from the stored location. This lets backend and frontend deploy in
 * either order.
 *
 * Strict mode (STRICT_NO_URL_COORDINATES=true, planned for a follow-up PR once
 * old tabs have reloaded): the request is rejected with 400 coordinates_in_url.
 */
export const QUERY_COORDINATE_KEYS = ['lat', 'lng', 'lon', 'latitude', 'longitude'] as const;

function isCoordinateKey(key: string): boolean {
  return (QUERY_COORDINATE_KEYS as readonly string[]).includes(key.toLowerCase());
}

export function hasQueryCoordinates(query: unknown): boolean {
  if (!query || typeof query !== 'object') return false;
  return Object.keys(query as Record<string, unknown>).some(isCoordinateKey);
}

/** Remove coordinate keys from a raw URL path + query string. */
export function stripCoordinatesFromUrl(url: string): string {
  const q = url.indexOf('?');
  if (q < 0) return url;
  const path = url.slice(0, q);
  const kept = url
    .slice(q + 1)
    .split('&')
    .filter((pair) => {
      if (!pair) return false;
      const rawKey = pair.split('=')[0];
      let key = rawKey;
      try {
        key = decodeURIComponent(rawKey.replace(/\+/g, ' '));
      } catch {
        /* keep the raw key */
      }
      return !isCoordinateKey(key);
    });
  return kept.length ? `${path}?${kept.join('&')}` : path;
}

export function strictNoUrlCoordinates(): boolean {
  return String(process.env.STRICT_NO_URL_COORDINATES || '').toLowerCase() === 'true';
}

/** Lenient: drop coordinate keys from req.query and req.url, then carry on. */
export function ignoreQueryCoordinates(req: Request, _res: Response, next: NextFunction) {
  if (hasQueryCoordinates(req.query)) {
    const q = req.query as Record<string, unknown>;
    for (const key of Object.keys(q)) {
      if (isCoordinateKey(key)) delete q[key];
    }
    req.url = stripCoordinatesFromUrl(req.url);
  }
  next();
}

/** Strict: 400 coordinates_in_url. Not mounted by default (see strictNoUrlCoordinates). */
export function rejectQueryCoordinates(req: Request, res: Response, next: NextFunction) {
  if (hasQueryCoordinates(req.query)) {
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
