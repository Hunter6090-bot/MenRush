import { query } from '../db';
import { discoveryPhotoUrl } from '../lib/discoveryPhoto';
import { isPublicHotSpotVisibilitySql } from './hot-spots.service';

export type CommunityPostRow = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  author_name: string;
  author_photo_url: string | null;
  distance_m: number;
  comment_count?: number | string;
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
  comment_count: number;
};

export type CommunityCommentRow = {
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  created_at: string;
  author_name: string;
  author_photo_url: string | null;
};

export type CommunityCommentDTO = {
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  created_at: string;
  author_name: string;
  author_photo_url: string | null;
};

export type CommunityMentionSuggestionDTO = {
  id: string;
  type: 'hot_spot' | 'match';
  name: string;
  subtitle?: string | null;
  photo_url?: string | null;
  icon?: string | null;
  category_name?: string | null;
  category_slug?: string | null;
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
    comment_count: Math.max(0, Number(row.comment_count) || 0),
  };
}

function toCommentDto(row: CommunityCommentRow): CommunityCommentDTO {
  const created =
    typeof row.created_at === 'string'
      ? row.created_at
      : new Date(row.created_at as unknown as string).toISOString();
  return {
    id: row.id,
    post_id: row.post_id,
    user_id: row.user_id,
    body: row.body,
    created_at: created,
    author_name: row.author_name,
    author_photo_url: row.author_photo_url,
  };
}

async function assertPostVisible(
  viewerId: string,
  postId: string,
): Promise<{ id: string; user_id: string }> {
  const result = await query(
    `SELECT cp.id, cp.user_id
     FROM community_posts cp
     WHERE cp.id = $1
       AND cp.created_at > NOW() - INTERVAL '24 hours'
       AND NOT EXISTS (
         SELECT 1 FROM blocks b
         WHERE (b.blocker_id = $2 AND b.blocked_id = cp.user_id)
            OR (b.blocker_id = cp.user_id AND b.blocked_id = $2)
       )`,
    [postId, viewerId],
  );
  if (result.rows.length === 0) {
    throw new Error('post_not_found');
  }
  return result.rows[0] as { id: string; user_id: string };
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
      comment_count: 0,
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
         ) AS distance_m,
         (
           SELECT COUNT(*)::int FROM community_post_comments c
           WHERE c.post_id = cp.id
         ) AS comment_count
       FROM community_posts cp
       JOIN users u ON u.id = cp.user_id
       WHERE cp.created_at > NOW() - INTERVAL '24 hours'
       AND ST_DWithin(
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

  /**
   * Comments on a Community post. Viewer must be able to see the post
   * (exists + not blocked). Oldest first. Free — no premium gate.
   */
  async listComments(viewerId: string, postId: string): Promise<CommunityCommentDTO[]> {
    await assertPostVisible(viewerId, postId);
    const result = await query(
      `SELECT
         c.id,
         c.post_id,
         c.user_id,
         c.body,
         c.created_at,
         u.name AS author_name,
         u.photo_url AS author_photo_url
       FROM community_post_comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.post_id = $1
         AND NOT EXISTS (
           SELECT 1 FROM blocks b
           WHERE (b.blocker_id = $2 AND b.blocked_id = c.user_id)
              OR (b.blocker_id = c.user_id AND b.blocked_id = $2)
         )
       ORDER BY c.created_at ASC
       LIMIT 100`,
      [postId, viewerId],
    );
    return result.rows.map((row: CommunityCommentRow) => toCommentDto(row));
  },

  async createComment(
    viewerId: string,
    postId: string,
    body: string,
  ): Promise<CommunityCommentDTO> {
    const trimmed = body.trim();
    if (!trimmed || trimmed.length > 280) {
      throw new Error('invalid_body');
    }
    await assertPostVisible(viewerId, postId);

    const inserted = await query(
      `INSERT INTO community_post_comments (post_id, user_id, body)
       VALUES ($1, $2, $3)
       RETURNING id, post_id, user_id, body, created_at`,
      [postId, viewerId, trimmed],
    );
    const row = inserted.rows[0];
    const author = await query(`SELECT name, photo_url FROM users WHERE id = $1`, [viewerId]);
    const authorRow = author.rows[0] ?? { name: 'Member', photo_url: null };
    return toCommentDto({
      id: row.id,
      post_id: row.post_id,
      user_id: row.user_id,
      body: row.body,
      created_at: row.created_at,
      author_name: authorRow.name,
      author_photo_url: authorRow.photo_url,
    });
  },

  /**
   * Edit author's own Community post (≤280).
   * Enforces author ownership and 24h expiry (expired post fails with post_not_found).
   */
  async updatePost(
    userId: string,
    postId: string,
    body: string,
  ): Promise<CommunityPostDTO> {
    const trimmed = body.trim();
    if (!trimmed || trimmed.length > 280) {
      throw new Error('invalid_body');
    }

    // Check post exists, not expired (24h), and check ownership
    const existing = await query(
      `SELECT id, user_id, lat, lng, created_at
       FROM community_posts
       WHERE id = $1
         AND created_at > NOW() - INTERVAL '24 hours'`,
      [postId],
    );
    if (existing.rows.length === 0) {
      throw new Error('post_not_found');
    }
    const postRow = existing.rows[0];
    if (postRow.user_id !== userId) {
      throw new Error('forbidden');
    }

    const updated = await query(
      `UPDATE community_posts
       SET body = $2
       WHERE id = $1
       RETURNING id, user_id, body, created_at, lat, lng`,
      [postId, trimmed],
    );
    const updatedPost = updated.rows[0];

    const author = await query(`SELECT name, photo_url FROM users WHERE id = $1`, [userId]);
    const authorRow = author.rows[0] ?? { name: 'Member', photo_url: null };

    const commentCountRes = await query(
      `SELECT COUNT(*)::int AS count FROM community_post_comments WHERE post_id = $1`,
      [postId],
    );
    const commentCount = Number(commentCountRes.rows[0]?.count ?? 0);

    return toDto({
      id: updatedPost.id,
      user_id: updatedPost.user_id,
      body: updatedPost.body,
      created_at: updatedPost.created_at,
      author_name: authorRow.name,
      author_photo_url: authorRow.photo_url,
      distance_m: 0,
      comment_count: commentCount,
    });
  },

  /**
   * Delete author's own Community post.
   * Cascades comments via DB foreign key constraint.
   */
  async deletePost(
    userId: string,
    postId: string,
  ): Promise<{ ok: boolean }> {
    const existing = await query(
      `SELECT id, user_id FROM community_posts WHERE id = $1`,
      [postId],
    );
    if (existing.rows.length === 0) {
      throw new Error('post_not_found');
    }
    if (existing.rows[0].user_id !== userId) {
      throw new Error('forbidden');
    }

    await query(`DELETE FROM community_posts WHERE id = $1`, [postId]);
    return { ok: true };
  },

  /**
   * Edit author's own comment on a Community post (≤280).
   * Enforces comment ownership and post visibility / 24h expiry.
   */
  async updateComment(
    userId: string,
    postId: string,
    commentId: string,
    body: string,
  ): Promise<CommunityCommentDTO> {
    const trimmed = body.trim();
    if (!trimmed || trimmed.length > 280) {
      throw new Error('invalid_body');
    }

    // Verify parent post is visible and not expired
    await assertPostVisible(userId, postId);

    const existing = await query(
      `SELECT id, post_id, user_id FROM community_post_comments WHERE id = $1 AND post_id = $2`,
      [commentId, postId],
    );
    if (existing.rows.length === 0) {
      throw new Error('comment_not_found');
    }
    if (existing.rows[0].user_id !== userId) {
      throw new Error('forbidden');
    }

    const updated = await query(
      `UPDATE community_post_comments
       SET body = $2
       WHERE id = $1
       RETURNING id, post_id, user_id, body, created_at`,
      [commentId, trimmed],
    );
    const row = updated.rows[0];

    const author = await query(`SELECT name, photo_url FROM users WHERE id = $1`, [userId]);
    const authorRow = author.rows[0] ?? { name: 'Member', photo_url: null };

    return toCommentDto({
      id: row.id,
      post_id: row.post_id,
      user_id: row.user_id,
      body: row.body,
      created_at: row.created_at,
      author_name: authorRow.name,
      author_photo_url: authorRow.photo_url,
    });
  },

  /**
   * Delete author's own comment on a Community post.
   */
  async deleteComment(
    userId: string,
    postId: string,
    commentId: string,
  ): Promise<{ ok: boolean }> {
    const existing = await query(
      `SELECT id, post_id, user_id FROM community_post_comments WHERE id = $1 AND post_id = $2`,
      [commentId, postId],
    );
    if (existing.rows.length === 0) {
      throw new Error('comment_not_found');
    }
    if (existing.rows[0].user_id !== userId) {
      throw new Error('forbidden');
    }

    await query(`DELETE FROM community_post_comments WHERE id = $1`, [commentId]);
    return { ok: true };
  },

  /**
   * Mention suggestions for Community posts and comments.
   * Strictly limited to:
   * 1. Hot Spots that appear on the Discover/map Hot Spots set (live public Hot Spots)
   * 2. Users you already Match with (mutual like relationship)
   * Never strangers, never all nearby, never all DB users.
   */
  async getMentionSuggestions(
    viewerId: string,
    queryStr: string = '',
    limit: number = 10,
  ): Promise<CommunityMentionSuggestionDTO[]> {
    const cleanQuery = queryStr.trim();
    const cappedLimit = Math.min(Math.max(limit, 1), 20);

    const matchValues: unknown[] = [viewerId];
    let matchQueryFilter = '';
    if (cleanQuery) {
      matchValues.push(`%${cleanQuery.toLowerCase()}%`);
      matchQueryFilter = ` AND lower(u.name) LIKE $${matchValues.length}`;
    }
    matchValues.push(cappedLimit);
    const matchLimitIdx = matchValues.length;

    const matchesPromise = query(
      `SELECT
         u.id,
         u.name,
         u.photo_url,
         u.map_photo_url
       FROM users u
       JOIN likes l1 ON l1.liker_id = $1 AND l1.liked_id = u.id
       JOIN likes l2 ON l2.liker_id = u.id AND l2.liked_id = $1
       WHERE NOT EXISTS (
         SELECT 1 FROM blocks b
         WHERE (b.blocker_id = $1 AND b.blocked_id = u.id)
            OR (b.blocker_id = u.id AND b.blocked_id = $1)
       )
       ${matchQueryFilter}
       ORDER BY u.name ASC
       LIMIT $${matchLimitIdx}`,
      matchValues,
    );

    const spotValues: unknown[] = [];
    let spotQueryFilter = '';
    if (cleanQuery) {
      spotValues.push(`%${cleanQuery.toLowerCase()}%`);
      const qIdx = spotValues.length;
      spotQueryFilter = ` AND (
        lower(hs.name) LIKE $${qIdx}
        OR lower(COALESCE(hs.city, '')) LIKE $${qIdx}
      )`;
    }
    spotValues.push(cappedLimit);
    const spotLimitIdx = spotValues.length;

    const validCoordsFilter = `
      AND hs.latitude IS NOT NULL
      AND hs.longitude IS NOT NULL
      AND hs.latitude != 0
      AND hs.longitude != 0
      AND hs.latitude BETWEEN -90 AND 90
      AND hs.longitude BETWEEN -180 AND 180
    `;

    const spotsPromise = query(
      `SELECT
         hs.id,
         hs.name,
         hs.city,
         c.name AS category_name,
         c.slug AS category_slug,
         c.icon AS category_icon
       FROM hot_spots hs
       JOIN hot_spot_categories c ON c.id = hs.category_id
       WHERE hs.is_active = TRUE
         AND ${isPublicHotSpotVisibilitySql('c', 'hs')}
         ${validCoordsFilter}
         ${spotQueryFilter}
       ORDER BY hs.name ASC
       LIMIT $${spotLimitIdx}`,
      spotValues,
    );

    const [matchesRes, spotsRes] = await Promise.all([matchesPromise, spotsPromise]);

    const spotSuggestions: CommunityMentionSuggestionDTO[] = spotsRes.rows.map((row: any) => ({
      id: row.id,
      type: 'hot_spot',
      name: row.name,
      subtitle: row.city || row.category_name || 'Hot Spot',
      photo_url: null,
      icon: row.category_icon || null,
      category_name: row.category_name || null,
      category_slug: row.category_slug || null,
    }));

    const matchSuggestions: CommunityMentionSuggestionDTO[] = matchesRes.rows.map((row: any) => {
      const photo =
        discoveryPhotoUrl(
          row.map_photo_url as string | null | undefined,
          row.photo_url as string | null | undefined,
        ) ?? row.photo_url;
      return {
        id: row.id,
        type: 'match',
        name: row.name,
        subtitle: 'Match',
        photo_url: photo || null,
        icon: null,
      };
    });

    const combined: CommunityMentionSuggestionDTO[] = [];
    const maxItems = cappedLimit;
    let sIdx = 0;
    let mIdx = 0;

    // Interleave or combine Hot Spots and Matches up to maxItems
    while (combined.length < maxItems && (sIdx < spotSuggestions.length || mIdx < matchSuggestions.length)) {
      if (sIdx < spotSuggestions.length) {
        combined.push(spotSuggestions[sIdx++]);
      }
      if (combined.length < maxItems && mIdx < matchSuggestions.length) {
        combined.push(matchSuggestions[mIdx++]);
      }
    }

    return combined;
  },
};
