import { query } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { MAP_PIN_FUZZ_DEFAULT_M } from '../lib/mapPinFuzz';
import { memberPublicPin } from '../lib/memberDistance';

/**
 * Map feed coordinates are the sender's PUBLIC (Discretion-fuzzed) pin, the
 * same point the Nearby map shows. Raw GPS never leaves the server, so a feed
 * message cannot be used to measure an exact distance.
 */
function publicFeedPoint(
  senderId: string,
  lat: number | string,
  lng: number | string,
  fuzzM: number | string | null | undefined,
): { lat: number; lng: number } {
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return { lat: la, lng: ln };
  return memberPublicPin(
    senderId,
    la,
    ln,
    fuzzM != null && Number.isFinite(Number(fuzzM)) ? Number(fuzzM) : MAP_PIN_FUZZ_DEFAULT_M,
  );
}

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
      `SELECT mf.id, mf.sender_id, u.name AS display_name, u.photo_url AS photo_url,
              mf.message, mf.lat, mf.lng, mf.created_at,
              COALESCE(sp.map_pin_fuzz_m, ${MAP_PIN_FUZZ_DEFAULT_M}) AS sender_fuzz_m
       FROM map_feed_messages mf
       JOIN users u ON u.id = mf.sender_id
       LEFT JOIN profiles sp ON sp.user_id = mf.sender_id
       WHERE mf.created_at >= $3
         AND ST_DWithin(mf.location, ST_MakePoint($2, $1)::geography, $4)
       ORDER BY mf.created_at DESC
       LIMIT 200`,
      [lat, lng, fifteenMinsAgo, radiusMeters],
    );

    return result.rows.map((row: MapFeedMessage & { sender_fuzz_m?: number | string }) => {
      const { sender_fuzz_m: fuzz, ...msg } = row;
      const point = publicFeedPoint(msg.sender_id, msg.lat, msg.lng, fuzz);
      return { ...msg, lat: point.lat, lng: point.lng };
    });
  },

  async post(userId: string, text: string): Promise<MapFeedMessage & { lat: number; lng: number }> {
    const locRes = await query(
      `SELECT lat, lng, COALESCE(map_pin_fuzz_m, ${MAP_PIN_FUZZ_DEFAULT_M}) AS map_pin_fuzz_m
         FROM profiles WHERE user_id = $1`,
      [userId],
    );

    if (locRes.rows.length === 0 || locRes.rows[0].lat == null) {
      throw new Error('location_required');
    }

    const { lat, lng, map_pin_fuzz_m: fuzzM } = locRes.rows[0] as {
      lat: number;
      lng: number;
      map_pin_fuzz_m: number;
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

    const userRes = await query(`SELECT name, photo_url FROM users WHERE id = $1`, [userId]);
    // Payload (HTTP + socket fan-out) carries the public fuzzed pin, not raw GPS.
    // The fan-out radius is centred on that same public pin.
    const point = publicFeedPoint(userId, row.lat, row.lng, fuzzM);
    return {
      ...row,
      lat: point.lat,
      lng: point.lng,
      display_name: userRes.rows[0]?.name ?? '',
      photo_url: userRes.rows[0]?.photo_url ?? null,
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
    return result.rows.map((r: { user_id: string }) => r.user_id);
  },
};
