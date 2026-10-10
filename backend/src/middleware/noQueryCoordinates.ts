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
 * Any /api request whose query string carries a coordinate key is rejected
 * with 400 coordinates_in_url, so an old cached client fails cleanly (and
 * reloads) instead of quietly continuing to leak.
 */
export const QUERY_COORDINATE_KEYS = ['lat', 'lng', 'lon', 'latitude', 'longitude'] as const;

export function hasQueryCoordinates(query: unknown): boolean {
  if (!query || typeof query !== 'object') return false;
  const keys = Object.keys(query as Record<string, unknown>).map((k) => k.toLowerCase());
  return QUERY_COORDINATE_KEYS.some((k) => keys.includes(k));
}

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
