import { query } from '../db';
import { ProfileInput } from '../types/validation';

export const userService = {
  async getNearbyUsers(
    userId: string,
    lat: number,
    lng: number,
    radiusKm: number = 5,
    filters?: { minAge?: number; maxAge?: number; interests?: string[] }
  ) {
    const radiusMeters = radiusKm * 1000;
    const values: any[] = [lat, lng, userId, radiusMeters];
    let queryStr = `
      SELECT
        u.id, u.name, u.age, u.bio, u.photo_url, u.interests,
        p.lat, p.lng, p.online, p.last_seen,
        ST_Distance(p.location, ST_MakePoint($2, $1)::geography) as distance_m
      FROM users u
      JOIN profiles p ON u.id = p.user_id
      WHERE u.id != $3
        AND ST_DWithin(p.location, ST_MakePoint($2, $1)::geography, $4)
    `;

    if (filters?.minAge) {
      values.push(filters.minAge);
      queryStr += ` AND u.age >= $${values.length}`;
    }
    if (filters?.maxAge) {
      values.push(filters.maxAge);
      queryStr += ` AND u.age <= $${values.length}`;
    }
    if (filters?.interests && filters.interests.length > 0) {
      values.push(filters.interests);
      queryStr += ` AND u.interests && $${values.length}`;
    }

    queryStr += ` ORDER BY p.online DESC, p.last_seen DESC LIMIT 50`;

    const result = await query(queryStr, values);

    return result.rows.map((row) => ({
      ...row,
      distance_km: (row.distance_m / 1000).toFixed(2),
    }));
  },

  async getUserProfile(userId: string) {
    const result = await query(
      `SELECT
        u.id, u.email, u.name, u.age, u.bio, u.photo_url, u.interests, u.created_at,
        p.lat, p.lng, p.online, p.last_seen
       FROM users u
       LEFT JOIN profiles p ON u.id = p.user_id
       WHERE u.id = $1`,
      [userId]
    );
    return result.rows[0];
  },

  async updateLocation(userId: string, lat: number, lng: number) {
    await query(
      `INSERT INTO profiles (user_id, location, lat, lng, online, last_seen)
       VALUES ($1, ST_MakePoint($3, $2), $2, $3, true, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         location = ST_MakePoint($3, $2),
         lat = $2,
         lng = $3,
         online = true,
         last_seen = NOW()`,
      [userId, lat, lng]
    );
  },

  async setOnlineStatus(userId: string, online: boolean) {
    await query(
      `UPDATE profiles SET online = $1, last_seen = NOW() WHERE user_id = $2`,
      [online, userId]
    );
  },

  async updateProfile(userId: string, data: ProfileInput) {
    const updates: string[] = [];
    const values: unknown[] = [userId];

    if (data.bio !== undefined) {
      updates.push(`bio = $${values.length + 1}`);
      values.push(data.bio || null);
    }
    if (data.photo_url !== undefined) {
      updates.push(`photo_url = $${values.length + 1}`);
      values.push(data.photo_url || null);
    }
    if (data.interests !== undefined) {
      updates.push(`interests = $${values.length + 1}`);
      values.push(data.interests);
    }

    if (updates.length === 0) {
      const res = await query(
        `SELECT id, name, age, bio, photo_url, interests FROM users WHERE id = $1`,
        [userId]
      );
      return res.rows[0];
    }

    const result = await query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $1
       RETURNING id, name, age, bio, photo_url, interests`,
      values
    );
    return result.rows[0];
  },

  async likeUser(likerId: string, likedId: string) {
    // Record the like
    await query(
      `INSERT INTO likes (liker_id, liked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [likerId, likedId]
    );

    // Check if it's a match
    const result = await query(
      `SELECT id FROM likes WHERE liker_id = $1 AND liked_id = $2`,
      [likedId, likerId]
    );

    return result.rows.length > 0;
  },

  async getMatches(userId: string) {
    const result = await query(
      `SELECT u.id, u.name, u.age, u.bio, u.photo_url, p.online, p.last_seen
       FROM users u
       JOIN profiles p ON u.id = p.user_id
       WHERE u.id IN (
         SELECT l1.liked_id
         FROM likes l1
         JOIN likes l2 ON l1.liker_id = l2.liked_id AND l1.liked_id = l2.liker_id
         WHERE l1.liker_id = $1
       )
       ORDER BY p.online DESC, p.last_seen DESC`,
      [userId]
    );
    return result.rows;
  },
};
