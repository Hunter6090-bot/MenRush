import { query } from '../db';

/**
 * After Hours events.
 *
 * Events live in the `rooms` table with `kind = 'event'`. They have time
 * windows (`starts_at` / `ends_at`) and an optional venue. Listing returns
 * only events that are currently live or upcoming within the next 24h, within
 * the requested radius.
 */

export interface NearbyEventRow {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  created_by: string;
  starts_at: string | null;
  ends_at: string | null;
  venue_name: string | null;
  lat: number | null;
  lng: number | null;
  member_count: number;
  distance_m: number | null;
  is_live: boolean;
}

export const eventService = {
  /**
   * Find events near a point that are live now or upcoming within the next 24h.
   * Excludes events that already ended.
   */
  async getNearbyEvents(opts: { lat: number; lng: number; radiusKm?: number; limit?: number }): Promise<NearbyEventRow[]> {
    const radiusMeters = (opts.radiusKm ?? 25) * 1000;
    const limit = opts.limit ?? 20;

    const res = await query(
      `SELECT r.id, r.name, r.description, r.avatar_url, r.created_by,
              r.starts_at, r.ends_at, r.venue_name, r.lat, r.lng,
              COUNT(rm.id)::int AS member_count,
              ST_Distance(r.location, ST_MakePoint($2, $1)::geography) AS distance_m,
              (r.starts_at IS NOT NULL AND r.starts_at <= NOW()
                AND (r.ends_at IS NULL OR r.ends_at > NOW())) AS is_live
         FROM rooms r
         LEFT JOIN room_members rm ON rm.room_id = r.id
        WHERE r.kind = 'event'
          AND (r.ends_at IS NULL OR r.ends_at > NOW())
          AND (r.starts_at IS NULL OR r.starts_at < NOW() + INTERVAL '24 hours')
          AND r.location IS NOT NULL
          AND ST_DWithin(r.location, ST_MakePoint($2, $1)::geography, $3)
        GROUP BY r.id
        ORDER BY is_live DESC, COALESCE(r.starts_at, NOW()) ASC, distance_m ASC
        LIMIT $4`,
      [opts.lat, opts.lng, radiusMeters, limit]
    );

    return res.rows;
  },
};
