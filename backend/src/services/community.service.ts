import { query } from '../db';

export type CommunityPostRow = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  author_name: string;
  author_photo_url: string | null;
  distance_m: number;
};

export type CommunityPostDTO = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  author_name: string;
  author_photo_url: string | null;
  /** Bucketed distance in km for locale formatting on the client. */
  distance_km: string;
  /** Approximate distance label (privacy-bucketed). */
  distance_label: string;
};

function bucketDistance(distanceM: number): { distance_km: string; distance_label: string } {
  const km = distanceM / 1000;
  let bucketed: number;
  let label: string;
  if (km < 0.3) {
    bucketed = 0.2;
    label = '< 300 m';
  } else if (km < 1) {
    bucketed = Math.round(km * 10) / 10;
    label = `${Math.round(bucketed * 1000)} m`;
  } else if (km < 5) {
    bucketed = Math.round(km * 2) / 2;
    label = `${bucketed.toFixed(1)} km`;
  } else {
    bucketed = Math.round(km);
    label = `${bucketed} km`;
  }
  return { distance_km: bucketed.toFixed(2), distance_label: label };
}

function toDto(row: CommunityPostRow): CommunityPostDTO {
  const { distance_km, distance_label } = bucketDistance(Number(row.distance_m) || 0);
  const created =
    typeof row.created_at === 'string'
      ? row.created_at
      : new Date(row.created_at as unknown as string).toISOString();
  return {
    id: row.id,
    user_id: row.user_id,
    body: row.body,
    created_at: created,
    author_name: row.author_name,
    author_photo_url: row.author_photo_url,
    distance_km,
    distance_label,
  };
}

export const communityService = {
  /**
   * Create a text-only Community post at the author's current profile pin.
   * Free for all verified users — no premium gate.
   */
  async create(userId: string, body: string): Promise<CommunityPostDTO> {
    const trimmed = body.trim();
    if (!trimmed || trimmed.length > 280) {
      throw new Error('invalid_body');
    }

    const loc = await query(
      `SELECT lat, lng FROM profiles WHERE user_id = $1 AND lat IS NOT NULL AND lng IS NOT NULL`,
      [userId],
    );
    if (loc.rows.length === 0) {
      throw new Error('location_required');
    }
    const lat = Number(loc.rows[0].lat);
    const lng = Number(loc.rows[0].lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new Error('location_required');
    }

    const inserted = await query(
      `INSERT INTO community_posts (user_id, body, lat, lng, location)
       VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($4, $3), 4326)::geography)
       RETURNING id, user_id, body, created_at`,
      [userId, trimmed, lat, lng],
    );
    const post = inserted.rows[0];

    const author = await query(`SELECT name, photo_url FROM users WHERE id = $1`, [userId]);
    const authorRow = author.rows[0] ?? { name: 'Member', photo_url: null };

    return toDto({
      id: post.id,
      user_id: post.user_id,
      body: post.body,
      created_at: post.created_at,
      author_name: authorRow.name,
      author_photo_url: authorRow.photo_url,
      distance_m: 0,
    });
  },

  /**
   * List nearby Community posts within radiusKm of (lat, lng).
   * Respects blocks; never returns exact post coordinates.
   */
  async listNearby(params: {
    viewerId: string;
    lat: number;
    lng: number;
    radiusKm?: number;
    limit?: number;
  }): Promise<CommunityPostDTO[]> {
    const radiusKm = Math.min(Math.max(params.radiusKm ?? 10, 0.8), 161);
    const limit = Math.min(Math.max(params.limit ?? 50, 1), 100);
    const radiusM = radiusKm * 1000;

    const result = await query(
      `SELECT
         cp.id,
         cp.user_id,
         cp.body,
         cp.created_at,
         u.name AS author_name,
         u.photo_url AS author_photo_url,
         ST_Distance(
           cp.location,
           ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
         ) AS distance_m
       FROM community_posts cp
       JOIN users u ON u.id = cp.user_id
       WHERE ST_DWithin(
         cp.location,
         ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
         $3
       )
       AND NOT EXISTS (
         SELECT 1 FROM blocks b
         WHERE (b.blocker_id = $4 AND b.blocked_id = cp.user_id)
            OR (b.blocker_id = cp.user_id AND b.blocked_id = $4)
       )
       ORDER BY cp.created_at DESC
       LIMIT $5`,
      [params.lat, params.lng, radiusM, params.viewerId, limit],
    );

    return result.rows.map((row: CommunityPostRow) => toDto(row));
  },
};
