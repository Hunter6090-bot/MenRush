import { v4 as uuidv4 } from 'uuid';
import { query } from '../db';
import { bucketDistanceLabel } from '../lib/distanceLabel';

const FEED_RADIUS_KM = 25;
const FEED_LIMIT = 80;

export type CommunityPostRow = {
  id: string;
  user_id: string;
  author_name: string;
  body: string;
  created_at: string;
  distance_m: number | null;
  distance_label: string;
};

export const communityService = {
  async listNearby(viewerId: string, lat: number, lng: number): Promise<CommunityPostRow[]> {
    const radiusMeters = FEED_RADIUS_KM * 1000;
    const res = await query(
      `SELECT
          p.id,
          p.user_id,
          u.name AS author_name,
          p.body,
          p.created_at,
          CASE
            WHEN p.lat IS NOT NULL AND p.lng IS NOT NULL
              THEN ST_Distance(
                ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326)::geography,
                ST_MakePoint($2, $1)::geography
              )
            ELSE NULL
          END AS distance_m
         FROM community_posts p
         JOIN users u ON u.id = p.user_id
        WHERE p.created_at > NOW() - INTERVAL '7 days'
          AND NOT EXISTS (
            SELECT 1 FROM blocks b
             WHERE (b.blocker_id = $3 AND b.blocked_id = p.user_id)
                OR (b.blocker_id = p.user_id AND b.blocked_id = $3)
          )
          AND (
            (p.lat IS NOT NULL AND p.lng IS NOT NULL AND ST_DWithin(
              ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326)::geography,
              ST_MakePoint($2, $1)::geography,
              $4
            ))
            OR p.lat IS NULL
          )
        ORDER BY p.created_at DESC
        LIMIT $5`,
      [lat, lng, viewerId, radiusMeters, FEED_LIMIT],
    );

    return res.rows.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      author_name: row.author_name,
      body: row.body,
      created_at: row.created_at,
      distance_m: row.distance_m == null ? null : Number(row.distance_m),
      distance_label: bucketDistanceLabel(row.distance_m == null ? null : Number(row.distance_m)),
    }));
  },

  async createPost(
    userId: string,
    body: string,
    location?: { lat: number; lng: number },
  ): Promise<CommunityPostRow> {
    const id = uuidv4();
    const trimmed = body.trim();
    const res = await query(
      `INSERT INTO community_posts (id, user_id, body, lat, lng)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, user_id, body, created_at, lat, lng`,
      [id, userId, trimmed, location?.lat ?? null, location?.lng ?? null],
    );
    const nameRes = await query(`SELECT name FROM users WHERE id = $1`, [userId]);
    const row = res.rows[0];
    return {
      id: row.id,
      user_id: row.user_id,
      author_name: nameRes.rows[0]?.name ?? 'You',
      body: row.body,
      created_at: row.created_at,
      distance_m: 0,
      distance_label: '< 300 m',
    };
  },
};
