import { query } from '../db';
import { ProfileInput } from '../types/validation';

export const userService = {
  async getNearbyUsers(
    userId: string,
    lat: number,
    lng: number,
    radiusKm: number = 5,
    filters?: { minAge?: number; maxAge?: number; interests?: string[]; onlyPulse?: boolean }
  ) {
    const radiusMeters = radiusKm * 1000;
    const values: any[] = [lat, lng, userId, radiusMeters];
    // Pulse v1: is_pulsing/pulse_expires_at live on users (per pulse-spec.md).
    // Computed `is_pulsing_live` AND-checks the expiry so a stale row that hasn't
    // been cron-swept yet doesn't masquerade as pulsing in the UI.
    let queryStr = `
      SELECT
        u.id, u.name, u.age, u.bio, u.photo_url, u.interests,
        u.is_verified,
        ROUND(p.lat::numeric, 3) as lat, ROUND(p.lng::numeric, 3) as lng,
        p.online, p.last_seen, p.available_until,
        (u.is_pulsing AND u.pulse_expires_at IS NOT NULL AND u.pulse_expires_at > NOW()) AS is_pulsing,
        CASE
          WHEN u.is_pulsing AND u.pulse_expires_at > NOW() THEN u.pulse_expires_at
          ELSE NULL
        END AS pulse_expires_at,
        ST_Distance(p.location, ST_MakePoint($2, $1)::geography) as distance_m
      FROM users u
      JOIN profiles p ON u.id = p.user_id
      WHERE u.id != $3
        AND ST_DWithin(p.location, ST_MakePoint($2, $1)::geography, $4)
        AND p.is_visible = true
        AND NOT EXISTS (
          SELECT 1 FROM blocks b
          WHERE (b.blocker_id = $3 AND b.blocked_id = u.id)
             OR (b.blocker_id = u.id AND b.blocked_id = $3)
        )
    `;

    if (filters?.onlyPulse) {
      // Honour either the new (users.is_pulsing) or legacy (profiles.available_until)
      // pulse signal so old data still surfaces during the transition.
      queryStr += ` AND (
        (u.is_pulsing = TRUE AND u.pulse_expires_at > NOW())
        OR (p.available_until IS NOT NULL AND p.available_until > NOW())
      )`;
    }
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

    // Spec: pulsing users sort first, then by last_seen DESC.
    queryStr += ` ORDER BY
      (u.is_pulsing AND u.pulse_expires_at > NOW()) DESC,
      (p.available_until IS NOT NULL AND p.available_until > NOW()) DESC,
      p.online DESC,
      p.last_seen DESC
    LIMIT 50`;

    const result = await query(queryStr, values);

    return result.rows.map((row) => ({
      ...row,
      distance_km: (row.distance_m / 1000).toFixed(2),
    }));
  },

  async getUserProfile(userId: string, includeEmail: boolean = true) {
    const emailField = includeEmail ? 'u.email, ' : '';
    const result = await query(
      `SELECT
        u.id, ${emailField}u.name, u.age, u.bio, u.headline, u.looking_for,
        u.photo_url, u.interests, u.created_at,
        u.is_verified, u.verification_status,
        p.lat, p.lng, p.online, p.last_seen, p.is_visible, p.available_until
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
    if (data.headline !== undefined) {
      updates.push(`headline = $${values.length + 1}`);
      values.push(data.headline || null);
    }
    if (data.looking_for !== undefined) {
      updates.push(`looking_for = $${values.length + 1}`);
      values.push(data.looking_for || null);
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
        `SELECT id, name, age, bio, headline, looking_for, photo_url, interests FROM users WHERE id = $1`,
        [userId]
      );
      return res.rows[0];
    }

    updates.push(`updated_at = NOW()`);

    const result = await query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $1
       RETURNING id, name, age, bio, headline, looking_for, photo_url, interests`,
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

  async updateVisibility(userId: string, isVisible: boolean) {
    await query(
      `UPDATE profiles SET is_visible = $1, updated_at = NOW() WHERE user_id = $2`,
      [isVisible, userId]
    );
  },

  async startPulse(userId: string, minutes: number = 90) {
    const result = await query(
      `UPDATE profiles
       SET available_until = NOW() + ($1 || ' minutes')::interval,
           updated_at = NOW()
       WHERE user_id = $2
       RETURNING available_until`,
      [minutes, userId]
    );
    return (result.rows[0]?.available_until as string | undefined) ?? null;
  },

  async stopPulse(userId: string) {
    await query(
      `UPDATE profiles SET available_until = NULL, updated_at = NOW() WHERE user_id = $1`,
      [userId]
    );
  },

  async blockUser(blockerId: string, blockedId: string) {
    await query(
      `INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2)
       ON CONFLICT (blocker_id, blocked_id) DO NOTHING`,
      [blockerId, blockedId]
    );
  },

  async unblockUser(blockerId: string, blockedId: string) {
    await query(
      `DELETE FROM blocks WHERE blocker_id = $1 AND blocked_id = $2`,
      [blockerId, blockedId]
    );
  },

  async reportUser(reporterId: string, reportedId: string, reason: string, details?: string) {
    await query(
      `INSERT INTO reports (reporter_id, reported_id, reason, details) VALUES ($1, $2, $3, $4)`,
      [reporterId, reportedId, reason, details ?? null]
    );
  },

  async getMatches(userId: string) {
    const result = await query(
      `SELECT
        u.id, u.name, u.age, u.bio, u.photo_url,
        p.online, p.last_seen,
        msg.message as last_message,
        msg.created_at as last_message_at
       FROM users u
       JOIN profiles p ON u.id = p.user_id
       LEFT JOIN LATERAL (
         SELECT message, created_at
         FROM messages
         WHERE (sender_id = u.id AND receiver_id = $1)
            OR (sender_id = $1 AND receiver_id = u.id)
         ORDER BY created_at DESC
         LIMIT 1
       ) msg ON true
       WHERE u.id IN (
         SELECT l1.liked_id
         FROM likes l1
         JOIN likes l2 ON l1.liker_id = l2.liked_id AND l1.liked_id = l2.liker_id
         WHERE l1.liker_id = $1
       )
       ORDER BY p.online DESC, COALESCE(msg.created_at, p.last_seen) DESC`,
      [userId]
    );
    return result.rows;
  },
};
