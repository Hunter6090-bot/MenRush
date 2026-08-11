import { query } from '../db';
import { v4 as uuidv4 } from 'uuid';

export interface MapFeedMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_photo_url: string | null;
  message: string;
  lat: number;
  lng: number;
  created_at: string;
}

export const mapFeedService = {
  async listNearby(
    userId: string,
    opts: { lat?: number; lng?: number; radiusKm?: number } = {},
  ): Promise<MapFeedMessage[]> {
    // Fall back to sender's own stored location when caller omits coords.
    let lat = opts.lat;
    let lng = opts.lng;

    if (lat === undefined || lng === undefined) {
      const locRes = await query(
        `SELECT lat, lng FROM profiles WHERE user_id = $1`,
        [userId],
      );
      if (locRes.rows.length === 0 || locRes.rows[0].lat == null) return [];
      lat = locRes.rows[0].lat;
      lng = locRes.rows[0].lng;
    }

    const radiusMeters = (opts.radiusKm ?? 5) * 1000;
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    const result = await query(
      `SELECT mf.id, mf.sender_id, u.name AS sender_name, u.photo_url AS sender_photo_url,
              mf.message, mf.lat, mf.lng, mf.created_at
       FROM map_feed_messages mf
       JOIN users u ON u.id = mf.sender_id
       WHERE mf.created_at >= $3
         AND ST_DWithin(mf.location, ST_MakePoint($2, $1)::geography, $4)
       ORDER BY mf.created_at DESC
       LIMIT 200`,
      [lat, lng, fifteenMinsAgo, radiusMeters],
    );

    return result.rows;
  },

  async post(userId: string, text: string): Promise<MapFeedMessage & { lat: number; lng: number }> {
    const locRes = await query(
      `SELECT lat, lng FROM profiles WHERE user_id = $1`,
      [userId],
    );

    if (locRes.rows.length === 0 || locRes.rows[0].lat == null) {
      throw new Error('location_required');
    }

    const { lat, lng } = locRes.rows[0] as { lat: number; lng: number };
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

    const userRes = await query(`SELECT name, photo_url FROM users WHERE id = $1`, [userId]);
    return {
      ...row,
      sender_name: userRes.rows[0]?.name ?? '',
      sender_photo_url: userRes.rows[0]?.photo_url ?? null,
    };
  },

  async nearbyUserIds(lat: number, lng: number, radiusKm: number): Promise<string[]> {
    const radiusMeters = radiusKm * 1000;
    const result = await query(
      `SELECT user_id FROM profiles
       WHERE lat IS NOT NULL
         AND ST_DWithin(location, ST_MakePoint($2, $1)::geography, $3)`,
      [lat, lng, radiusMeters],
    );
    return result.rows.map((r: any) => r.user_id as string);
  },
};
