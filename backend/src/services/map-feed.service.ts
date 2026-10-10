import { query } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { MAP_PIN_FUZZ_DEFAULT_M, privateMapPointAround } from '../lib/mapPinFuzz';
import { clampRadiusKm, PIN_PREFILTER_BUFFER_M, publicPinSql } from '../lib/mapPinSql';
import { viewerStoredLocation } from '../lib/viewerOrigin';
import { liveTripExistsSql } from '../lib/travel';

/** Sender's public pin for a post (seed map:<senderId>, sender's Discretion). */
const SENDER_PIN = publicPinSql('mf.lat', 'mf.lng', 'mf.sender_id', 'sp.map_pin_fuzz_m');

export interface MapFeedMessage {
  id: string;
  sender_id: string;
  // Field names match the frontend's MapFeedMessage contract
  // (frontend/src/api/client.ts) — not renamed from "sender_*" because the
  // map feed is anonymous-by-design, same display fields used everywhere
  // else a poster's identity is shown in this feature.
  display_name: string;
  photo_url: string | null;
  message: string;
  lat: number;
  lng: number;
  created_at: string;
}

export const mapFeedService = {
  async listNearby(
    userId: string,
    // lat / lng are ignored: the query point is always the viewer's stored
    // location, so it cannot be moved around to triangulate someone.
    opts: { lat?: number; lng?: number; radiusKm?: number } = {},
  ): Promise<MapFeedMessage[]> {
    const origin = await viewerStoredLocation(userId);
    if (!origin) return [];

    // Same radius bounds as Nearby and Community (min 0.8 km).
    const radiusMeters = clampRadiusKm(opts.radiusKm, 5) * 1000;
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    // Coordinates returned and the radius check both use the sender's public
    // (Discretion-fuzzed) pin for the post, never raw GPS.
    const result = await query(
      `SELECT mf.id, mf.sender_id, u.name AS display_name, u.photo_url AS photo_url,
              mf.message, ${SENDER_PIN.lat} AS lat, ${SENDER_PIN.lng} AS lng, mf.created_at
       FROM map_feed_messages mf
       JOIN users u ON u.id = mf.sender_id
       LEFT JOIN profiles sp ON sp.user_id = mf.sender_id
       WHERE mf.created_at >= $3
         AND ST_DWithin(mf.location, ST_MakePoint($2, $1)::geography, $4::float8 + ${PIN_PREFILTER_BUFFER_M})
         AND ST_DWithin(${SENDER_PIN.geog}, ST_MakePoint($2, $1)::geography, $4::float8)
         -- Ghost / hidden members: their posts and pins are not shown to others.
         AND (
           mf.sender_id = $5
           OR (COALESCE(sp.is_visible, FALSE) = TRUE AND COALESCE(sp.is_ghost, FALSE) = FALSE)
         )
         AND NOT EXISTS (
           SELECT 1 FROM blocks b
           WHERE (b.blocker_id = $5 AND b.blocked_id = mf.sender_id)
              OR (b.blocker_id = mf.sender_id AND b.blocked_id = $5)
         )
         -- Travel: a member on a live trip is not at home, so their posts do
         -- not show at their home pin (same rule as Nearby). They still see their own.
         AND (mf.sender_id = $5 OR NOT ${liveTripExistsSql('mf.sender_id')})
       ORDER BY mf.created_at DESC
       LIMIT 200`,
      [origin.lat, origin.lng, fifteenMinsAgo, radiusMeters, userId],
    );

    // lat / lng are already the sender's public pin (SENDER_PIN in SQL).
    return result.rows;
  },

  async post(userId: string, text: string): Promise<MapFeedMessage & { lat: number; lng: number }> {
    const locRes = await query(
      `SELECT lat, lng, map_pin_fuzz_m FROM profiles WHERE user_id = $1`,
      [userId],
    );

    if (locRes.rows.length === 0 || locRes.rows[0].lat == null) {
      throw new Error('location_required');
    }

    const { lat, lng, map_pin_fuzz_m: fuzzM } = locRes.rows[0] as {
      lat: number;
      lng: number;
      map_pin_fuzz_m: number | null;
    };
    const id = uuidv4();
    const sanitized = text.replace(/<script[^>]*>.*?<\/script>/gi, '').trim();

    // $4 = lng (longitude first in ST_MakePoint), $5 = lat
    const insertRes = await query(
      `INSERT INTO map_feed_messages (id, sender_id, message, location, lat, lng)
       VALUES ($1, $2, $3, ST_MakePoint($4, $5)::geography, $5, $4)
       RETURNING id, sender_id, message, lat, lng, created_at`,
      [id, userId, sanitized, lng, lat],
    );

    const row = insertRes.rows[0];

    // HTTP reply and socket fan-out carry the public (fuzzed) pin, not raw GPS.
    const pin = privateMapPointAround(
      Number(row.lat),
      Number(row.lng),
      `map:${userId}`,
      fuzzM != null && Number.isFinite(Number(fuzzM)) ? Number(fuzzM) : MAP_PIN_FUZZ_DEFAULT_M,
    );

    const userRes = await query(`SELECT name, photo_url FROM users WHERE id = $1`, [userId]);
    return {
      ...row,
      lat: pin.lat,
      lng: pin.lng,
      display_name: userRes.rows[0]?.name ?? '',
      photo_url: userRes.rows[0]?.photo_url ?? null,
    };
  },

  /**
   * Socket fan-out targets for a new post. With senderId, anyone the sender
   * blocked or who blocked the sender is left out (same block lookup as Nearby),
   * and a ghost / hidden sender, or one on a live Travel trip, only reaches themselves.
   */
  async nearbyUserIds(
    lat: number,
    lng: number,
    radiusKm: number,
    senderId?: string,
  ): Promise<string[]> {
    const radiusMeters = radiusKm * 1000;
    const result = await query(
      `SELECT user_id FROM profiles
       WHERE lat IS NOT NULL
         AND ST_DWithin(location, ST_MakePoint($2, $1)::geography, $3)
         AND (
           $4::uuid IS NULL
           OR profiles.user_id = $4::uuid
           OR (
             EXISTS (
               SELECT 1 FROM profiles sp
               WHERE sp.user_id = $4::uuid AND sp.is_visible = TRUE AND sp.is_ghost = FALSE
             )
             -- Travel: a sender on a live trip reaches only themselves at home.
             AND NOT ${liveTripExistsSql('$4::uuid')}
             AND NOT EXISTS (
               SELECT 1 FROM blocks b
               WHERE (b.blocker_id = $4::uuid AND b.blocked_id = profiles.user_id)
                  OR (b.blocker_id = profiles.user_id AND b.blocked_id = $4::uuid)
             )
           )
         )`,
      [lat, lng, radiusMeters, senderId ?? null],
    );
    return result.rows.map((r: { user_id: string }) => r.user_id);
  },
};
