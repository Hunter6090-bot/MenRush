import crypto from 'crypto';
import { query } from '../db';
import { accessControl } from '../security/access';
import { ProfileInput } from '../types/validation';

function stableBearing(seed: string) {
  const hash = crypto.createHash('sha256').update(seed).digest();
  return hash.readUInt32BE(0) % 360;
}

function privateMapPoint(originLat: number, originLng: number, distanceKm: number, seed: string) {
  const bearing = stableBearing(seed) * (Math.PI / 180);
  const latitudeOffset = (distanceKm / 111) * Math.cos(bearing);
  const longitudeScale = Math.max(Math.cos(originLat * (Math.PI / 180)), 0.2);
  const longitudeOffset = (distanceKm / (111 * longitudeScale)) * Math.sin(bearing);
  return {
    lat: Number((originLat + latitudeOffset).toFixed(6)),
    lng: Number((originLng + longitudeOffset).toFixed(6)),
  };
}

const includeE2eFixtures = () =>
  process.env.INCLUDE_E2E_FIXTURES === 'true' || process.env.INCLUDE_E2E_FIXTURES === '1';

export const userService = {
  async getNearbyUsers(
    userId: string,
    radiusKm: number = 5,
    filters?: {
      minAge?: number;
      maxAge?: number;
      interests?: string[];
      onlyPulse?: boolean;
      lookingFor?: string;
      mood?: string;
    },
    clientLocation?: { lat: number; lng: number },
  ) {
    await accessControl.requireVerified(userId);

    if (clientLocation) {
      await this.updateLocation(userId, clientLocation.lat, clientLocation.lng);
    }

    const locationResult = await query(
      `SELECT lat, lng
       FROM profiles
       WHERE user_id = $1 AND location IS NOT NULL AND lat IS NOT NULL AND lng IS NOT NULL`,
      [userId],
    );
    if (!locationResult.rows[0]) return [];

    const originLat = Number(locationResult.rows[0].lat);
    const originLng = Number(locationResult.rows[0].lng);
    const radiusMeters = radiusKm * 1000;
    const values: any[] = [originLat, originLng, userId, radiusMeters];
    // Pulse v1: is_pulsing/pulse_expires_at live on users (per pulse-spec.md).
    // Computed `is_pulsing_live` AND-checks the expiry so a stale row that hasn't
    // been cron-swept yet doesn't masquerade as pulsing in the UI.
    let queryStr = `
      SELECT
        u.id, u.name, u.age, u.bio, u.headline, u.looking_for, u.photo_url, u.cover_url, u.interests,
        u.is_verified,
        p.online, p.last_seen, p.available_until,
        (u.is_pulsing AND u.pulse_expires_at IS NOT NULL AND u.pulse_expires_at > NOW()) AS is_pulsing,
        CASE
          WHEN u.is_pulsing AND u.pulse_expires_at > NOW() THEN u.pulse_expires_at
          ELSE NULL
        END AS pulse_expires_at,
        CASE
          WHEN p.mood_set_at IS NOT NULL AND p.mood_set_at > NOW() - INTERVAL '6 hours' THEN p.mood
          ELSE NULL
        END AS mood,
        ST_Distance(p.location, ST_MakePoint($2, $1)::geography) as distance_m
      FROM users u
      JOIN profiles p ON u.id = p.user_id
      WHERE u.id != $3
        AND ST_DWithin(p.location, ST_MakePoint($2, $1)::geography, $4)
        AND p.is_visible = true
        AND p.is_ghost = false
        AND NOT EXISTS (
          SELECT 1 FROM blocks b
          WHERE (b.blocker_id = $3 AND b.blocked_id = u.id)
             OR (b.blocker_id = u.id AND b.blocked_id = $3)
        )
    `;

    if (!includeE2eFixtures()) {
      queryStr += ` AND u.email NOT LIKE '%@example.com'`;
    }

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
    if (filters?.lookingFor) {
      const lf = filters.lookingFor.toLowerCase();
      if (lf === 'chat') {
        queryStr += ` AND p.online = true`;
      } else if (lf === 'date') {
        values.push('%dating%');
        queryStr += ` AND (u.looking_for ILIKE $${values.length} OR u.interests && ARRAY['Dating']::text[])`;
      } else if (lf === 'nsa') {
        values.push('%nsa%');
        queryStr += ` AND (u.looking_for ILIKE $${values.length} OR u.interests && ARRAY['NSA']::text[])`;
      } else if (lf === 'drinks') {
        queryStr += ` AND (
          (p.mood_set_at IS NOT NULL AND p.mood_set_at > NOW() - INTERVAL '6 hours' AND p.mood ILIKE '%drink%')
          OR u.looking_for ILIKE '%drink%'
          OR u.interests && ARRAY['Drinks']::text[]
        )`;
      }
    }
    if (filters?.mood) {
      values.push(filters.mood);
      queryStr += ` AND p.mood_set_at IS NOT NULL AND p.mood_set_at > NOW() - INTERVAL '6 hours' AND p.mood ILIKE $${values.length}`;
    }

    // Spec: pulsing users sort first, then by last_seen DESC.
    queryStr += ` ORDER BY
      (u.is_pulsing AND u.pulse_expires_at > NOW()) DESC,
      (p.available_until IS NOT NULL AND p.available_until > NOW()) DESC,
      p.online DESC,
      p.last_seen DESC
    LIMIT 50`;

    const result = await query(queryStr, values);

    return result.rows.map((row) => {
      const km = row.distance_m / 1000;
      // Distance bucketing and randomized bearings prevent triangulation while
      // preserving an approximate map/list experience.
      let bucketed: number;
      let label: string;
      if (km < 0.3) {
        bucketed = 0.2;
        label = '< 300 m';
      } else if (km < 1) {
        bucketed = Math.round(km * 10) / 10; // 0.1km steps under 1km
        label = `${Math.round(bucketed * 1000)} m`;
      } else if (km < 5) {
        bucketed = Math.round(km * 2) / 2; // 0.5km steps
        label = `${bucketed.toFixed(1)} km`;
      } else {
        bucketed = Math.round(km); // 1km steps above 5km
        label = `${bucketed} km`;
      }
      return {
        ...row,
        ...privateMapPoint(
          originLat,
          originLng,
          bucketed,
          `${userId}:${row.id}:${originLat.toFixed(2)}:${originLng.toFixed(2)}:${bucketed}`,
        ),
        distance_km: bucketed.toFixed(2),
        distance_label: label,
      };
    });
  },

  async ensureProfileRow(userId: string) {
    await query(
      `INSERT INTO profiles (user_id, online, last_seen)
       VALUES ($1, false, NOW())
       ON CONFLICT (user_id) DO NOTHING`,
      [userId],
    );
  },

  async getOwnProfile(userId: string) {
    await this.ensureProfileRow(userId);
    const result = await query(
      `SELECT
        u.id, u.email, u.name, u.age, u.bio, u.headline, u.looking_for,
        u.photo_url, u.cover_url, u.cover_position_x, u.cover_position_y, u.cover_zoom, u.interests, u.created_at,
        u.is_verified, u.verification_status,
        u.is_premium, u.premium_tier, u.premium_until,
        p.lat, p.lng, p.online, p.last_seen, p.is_visible, p.available_until,
        p.is_ghost,
        CASE
          WHEN p.mood_set_at IS NOT NULL AND p.mood_set_at > NOW() - INTERVAL '6 hours' THEN p.mood
          ELSE NULL
        END AS mood,
        CASE
          WHEN p.mood_set_at IS NOT NULL AND p.mood_set_at > NOW() - INTERVAL '6 hours' THEN p.mood_set_at
          ELSE NULL
        END AS mood_set_at
       FROM users u
       LEFT JOIN profiles p ON u.id = p.user_id
       WHERE u.id = $1`,
      [userId]
    );
    return result.rows[0];
  },

  async getPublicProfile(viewerId: string, targetId: string) {
    await accessControl.assertProfileView(viewerId, targetId);
    const result = await query(
      `SELECT
        u.id, u.name, u.age, u.bio, u.headline, u.looking_for,
        u.photo_url, u.cover_url, u.cover_position_x, u.cover_position_y, u.cover_zoom, u.interests, u.created_at, u.is_verified,
        p.online, p.last_seen, p.available_until,
        CASE
          WHEN p.mood_set_at IS NOT NULL AND p.mood_set_at > NOW() - INTERVAL '6 hours' THEN p.mood
          ELSE NULL
        END AS mood,
        EXISTS (
          SELECT 1 FROM likes l1
          JOIN likes l2 ON l1.liker_id = l2.liked_id AND l1.liked_id = l2.liker_id
          WHERE l1.liker_id = $2 AND l1.liked_id = $1
        ) AS is_match,
        COALESCE(p.share_live_location_with_matches, TRUE) AS live_location_sharing,
        CASE
          WHEN EXISTS (
            SELECT 1 FROM likes l1
            JOIN likes l2 ON l1.liker_id = l2.liked_id AND l1.liked_id = l2.liker_id
            WHERE l1.liker_id = $2 AND l1.liked_id = $1
          )
          AND COALESCE(p.share_live_location_with_matches, TRUE) = TRUE
          AND p.lat IS NOT NULL AND p.lng IS NOT NULL
          THEN p.lat
          ELSE NULL
        END AS live_lat,
        CASE
          WHEN EXISTS (
            SELECT 1 FROM likes l1
            JOIN likes l2 ON l1.liker_id = l2.liked_id AND l1.liked_id = l2.liker_id
            WHERE l1.liker_id = $2 AND l1.liked_id = $1
          )
          AND COALESCE(p.share_live_location_with_matches, TRUE) = TRUE
          AND p.lat IS NOT NULL AND p.lng IS NOT NULL
          THEN p.lng
          ELSE NULL
        END AS live_lng,
        CASE
          WHEN EXISTS (
            SELECT 1 FROM likes l1
            JOIN likes l2 ON l1.liker_id = l2.liked_id AND l1.liked_id = l2.liker_id
            WHERE l1.liker_id = $2 AND l1.liked_id = $1
          )
          AND COALESCE(p.share_live_location_with_matches, TRUE) = TRUE
          AND p.lat IS NOT NULL AND p.lng IS NOT NULL
          THEN p.updated_at
          ELSE NULL
        END AS live_location_updated_at,
        CASE
          WHEN viewer.lat IS NOT NULL AND viewer.lng IS NOT NULL
           AND EXISTS (
            SELECT 1 FROM likes l1
            JOIN likes l2 ON l1.liker_id = l2.liked_id AND l1.liked_id = l2.liker_id
            WHERE l1.liker_id = $2 AND l1.liked_id = $1
          )
          AND COALESCE(p.share_live_location_with_matches, TRUE) = TRUE
          AND p.lat IS NOT NULL AND p.lng IS NOT NULL
          THEN ROUND(
            (ST_Distance(
              ST_MakePoint(viewer.lng, viewer.lat)::geography,
              ST_MakePoint(p.lng, p.lat)::geography
            ) / 1000.0)::numeric,
            1
          )
          ELSE NULL
        END AS live_distance_km
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       LEFT JOIN profiles viewer ON viewer.user_id = $2
       WHERE u.id = $1`,
      [targetId, viewerId],
    );
    return result.rows[0];
  },

  async getDisplayName(userId: string) {
    const result = await query(`SELECT name FROM users WHERE id = $1`, [userId]);
    return result.rows[0]?.name as string | undefined;
  },

  async updateLocation(userId: string, lat: number, lng: number) {
    await query(
      `INSERT INTO profiles (user_id, location, lat, lng, online, last_seen, share_live_location_with_matches)
       VALUES ($1, ST_MakePoint($3, $2), $2, $3, true, NOW(), TRUE)
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
    if (data.cover_url !== undefined) {
      updates.push(`cover_url = $${values.length + 1}`);
      values.push(data.cover_url || null);
    }
    if (data.cover_position_x !== undefined) {
      updates.push(`cover_position_x = $${values.length + 1}`);
      values.push(data.cover_position_x);
    }
    if (data.cover_position_y !== undefined) {
      updates.push(`cover_position_y = $${values.length + 1}`);
      values.push(data.cover_position_y);
    }
    if (data.cover_zoom !== undefined) {
      updates.push(`cover_zoom = $${values.length + 1}`);
      values.push(data.cover_zoom);
    }
    if (data.interests !== undefined) {
      updates.push(`interests = $${values.length + 1}`);
      values.push(data.interests);
    }

    if (updates.length === 0) {
      const res = await query(
        `SELECT id, name, age, bio, headline, looking_for, photo_url, cover_url, cover_position_x, cover_position_y, cover_zoom, interests FROM users WHERE id = $1`,
        [userId]
      );
      return res.rows[0];
    }

    updates.push(`updated_at = NOW()`);

    const result = await query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $1
       RETURNING id, name, age, bio, headline, looking_for, photo_url, cover_url, cover_position_x, cover_position_y, cover_zoom, interests`,
      values
    );
    return result.rows[0];
  },

  async likeUser(likerId: string, likedId: string) {
    await accessControl.assertProfileView(likerId, likedId);
    await accessControl.assertInteraction(likerId, likedId);
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

  /** Video calls allowed for mutual matches or anyone you've already messaged. */
  async canVideoCall(userId: string, peerId: string): Promise<boolean> {
    if (!peerId || userId === peerId) return false;
    try {
      await accessControl.assertInteraction(userId, peerId, { requireMatch: true });
      return true;
    } catch {
      /* fall through */
    }
    try {
      await accessControl.assertInteraction(userId, peerId, { requireMatch: false });
      const thread = await query(
        `SELECT 1 FROM messages
         WHERE (sender_id = $1 AND receiver_id = $2)
            OR (sender_id = $2 AND receiver_id = $1)
         LIMIT 1`,
        [userId, peerId],
      );
      return thread.rows.length > 0;
    } catch {
      return false;
    }
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

  async searchProfiles(viewerId: string, q: string) {
    await accessControl.requireVerified(viewerId);
    const term = q.trim();
    if (term.length < 2) return [];

    const result = await query(
      `SELECT u.id, u.name, u.age, u.photo_url, u.bio, u.headline
       FROM users u
       JOIN profiles p ON p.user_id = u.id
       WHERE u.id != $1
         AND p.is_visible = true
         AND u.name ILIKE $2
         AND NOT EXISTS (
           SELECT 1 FROM blocks b
           WHERE (b.blocker_id = $1 AND b.blocked_id = u.id)
              OR (b.blocker_id = u.id AND b.blocked_id = $1)
         )
       ORDER BY u.name ASC
       LIMIT 20`,
      [viewerId, `%${term}%`],
    );
    return result.rows;
  },

  async getMatches(userId: string) {
    const result = await query(
      `SELECT
        u.id, u.name, u.age, u.bio, u.photo_url, u.is_verified,
        p.online, p.last_seen,
        COALESCE(p.share_live_location_with_matches, TRUE) AS live_location_sharing,
        CASE
          WHEN COALESCE(p.share_live_location_with_matches, TRUE) = TRUE
           AND p.lat IS NOT NULL AND p.lng IS NOT NULL
          THEN p.lat
          ELSE NULL
        END AS lat,
        CASE
          WHEN COALESCE(p.share_live_location_with_matches, TRUE) = TRUE
           AND p.lat IS NOT NULL AND p.lng IS NOT NULL
          THEN p.lng
          ELSE NULL
        END AS lng,
        CASE
          WHEN COALESCE(p.share_live_location_with_matches, TRUE) = TRUE
           AND p.lat IS NOT NULL AND p.lng IS NOT NULL
          THEN p.updated_at
          ELSE NULL
        END AS location_updated_at,
        CASE
          WHEN viewer.lat IS NOT NULL AND viewer.lng IS NOT NULL
           AND COALESCE(p.share_live_location_with_matches, TRUE) = TRUE
           AND p.lat IS NOT NULL AND p.lng IS NOT NULL
          THEN ROUND(
            (ST_Distance(
              ST_MakePoint(viewer.lng, viewer.lat)::geography,
              ST_MakePoint(p.lng, p.lat)::geography
            ) / 1000.0)::numeric,
            1
          )
          ELSE NULL
        END AS distance_km,
        msg.message as last_message,
        msg.created_at as last_message_at,
        GREATEST(l1.created_at, l2.created_at) AS matched_at
       FROM users u
       JOIN profiles p ON u.id = p.user_id
       JOIN profiles viewer ON viewer.user_id = $1
       JOIN likes l1 ON l1.liker_id = $1 AND l1.liked_id = u.id
       JOIN likes l2 ON l2.liker_id = u.id AND l2.liked_id = $1
       LEFT JOIN LATERAL (
         SELECT message, created_at
         FROM messages
         WHERE (sender_id = u.id AND receiver_id = $1)
            OR (sender_id = $1 AND receiver_id = u.id)
         ORDER BY created_at DESC
         LIMIT 1
       ) msg ON true
       WHERE NOT EXISTS (
         SELECT 1 FROM blocks b
         WHERE (b.blocker_id = $1 AND b.blocked_id = u.id)
            OR (b.blocker_id = u.id AND b.blocked_id = $1)
       )
       ORDER BY p.online DESC, COALESCE(msg.created_at, p.last_seen) DESC`,
      [userId]
    );
    return result.rows;
  },

  async getReceivedLikesSummary(userId: string) {
    const { premiumService } = await import('./premium.service');
    const isPremium = await premiumService.isPremium(userId);

    const countResult = await query(
      `SELECT COUNT(*)::int AS count
       FROM likes l
       WHERE l.liked_id = $1
         AND NOT EXISTS (
           SELECT 1 FROM likes l2
           WHERE l2.liker_id = $1 AND l2.liked_id = l.liker_id
         )`,
      [userId],
    );
    const count = countResult.rows[0]?.count ?? 0;

    let preview: Array<{ id: string; name: string; age: number; photo_url: string | null }> = [];
    if (isPremium && count > 0) {
      const previewResult = await query(
        `SELECT u.id, u.name, u.age, u.photo_url
         FROM likes l
         JOIN users u ON u.id = l.liker_id
         WHERE l.liked_id = $1
           AND NOT EXISTS (
             SELECT 1 FROM likes l2
             WHERE l2.liker_id = $1 AND l2.liked_id = l.liker_id
           )
         ORDER BY l.created_at DESC
         LIMIT 3`,
        [userId],
      );
      preview = previewResult.rows;
    }

    return { count, is_premium: isPremium, preview };
  },
};
