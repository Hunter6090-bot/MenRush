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
  spot_id?: string | null;
  venue_claim_id?: string | null;
  is_venue_managed?: boolean;
  status?: string;
  managed_label?: string | null;
}

export const eventService = {
  /**
   * Find events near a point that are live now or upcoming.
   * Supports daysAhead window (default 30 days for month calendar view).
   * Excludes events that already ended or are cancelled.
   */
  async getNearbyEvents(opts: {
    lat: number;
    lng: number;
    radiusKm?: number;
    daysAhead?: number;
    limit?: number;
  }): Promise<NearbyEventRow[]> {
    const radiusMeters = (opts.radiusKm ?? 25) * 1000;
    const limit = opts.limit ?? 20;
    const daysAhead = opts.daysAhead ?? 30;

    const res = await query(
      `SELECT r.id, r.name, r.description, r.avatar_url, r.created_by,
              r.starts_at, r.ends_at, r.venue_name, r.lat, r.lng,
              r.spot_id, r.venue_claim_id,
              COALESCE(r.is_venue_managed, FALSE) AS is_venue_managed,
              COALESCE(r.status, 'published') AS status,
              CASE WHEN r.is_venue_managed = TRUE THEN 'Calendar managed by venue' ELSE NULL END AS managed_label,
              COUNT(rm.id)::int AS member_count,
              ST_Distance(r.location, ST_MakePoint($2, $1)::geography) AS distance_m,
              (r.starts_at IS NOT NULL AND r.starts_at <= NOW()
                AND (r.ends_at IS NULL OR r.ends_at > NOW())) AS is_live
         FROM rooms r
         LEFT JOIN room_members rm ON rm.room_id = r.id
        WHERE r.kind = 'event'
          AND COALESCE(r.status, 'published') = 'published'
          AND (r.ends_at IS NULL OR r.ends_at > NOW())
          AND (r.starts_at IS NULL OR r.starts_at < NOW() + ($5 || ' days')::interval)
          AND r.location IS NOT NULL
          AND ST_DWithin(r.location, ST_MakePoint($2, $1)::geography, $3)
        GROUP BY r.id
        ORDER BY is_live DESC, COALESCE(r.starts_at, NOW()) ASC, distance_m ASC
        LIMIT $4`,
      [opts.lat, opts.lng, radiusMeters, limit, String(daysAhead)]
    );

    return res.rows;
  },

  async getEvent(eventId: string): Promise<NearbyEventRow | null> {
    const res = await query(
      `SELECT r.id, r.name, r.description, r.avatar_url, r.created_by,
              r.starts_at, r.ends_at, r.venue_name, r.lat, r.lng,
              r.spot_id, r.venue_claim_id,
              COALESCE(r.is_venue_managed, FALSE) AS is_venue_managed,
              COALESCE(r.status, 'published') AS status,
              CASE WHEN r.is_venue_managed = TRUE THEN 'Calendar managed by venue' ELSE NULL END AS managed_label,
              COUNT(rm.id)::int AS member_count,
              NULL::float AS distance_m,
              (r.starts_at IS NOT NULL AND r.starts_at <= NOW()
                AND (r.ends_at IS NULL OR r.ends_at > NOW())) AS is_live
         FROM rooms r
         LEFT JOIN room_members rm ON rm.room_id = r.id
        WHERE r.id = $1 AND r.kind = 'event'
        GROUP BY r.id`,
      [eventId],
    );
    return (res.rows[0] as NearbyEventRow) ?? null;
  },
};
