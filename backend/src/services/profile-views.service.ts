import { query } from '../db';
import { premiumService } from './premium.service';

export const PROFILE_VIEW_NOTIFY_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export const FREE_PROFILE_VIEWERS_LIMIT = 5;
export const PREMIUM_PROFILE_VIEWERS_LIMIT = 200;

export interface ProfileViewerRow {
  id: string;
  name: string;
  age: number;
  photo_url: string | null;
  online: boolean;
  viewed_at: string;
}

export const profileViewsService = {
  async recordView(viewerId: string, viewedUserId: string): Promise<{ notify: boolean }> {
    if (viewerId === viewedUserId) return { notify: false };

    const ghost = await query(
      `SELECT COALESCE(is_ghost, FALSE) AS is_ghost FROM profiles WHERE user_id = $1`,
      [viewerId],
    );
    if (ghost.rows[0]?.is_ghost) return { notify: false };

    const existing = await query(
      `SELECT viewed_at FROM profile_views WHERE viewer_id = $1 AND viewed_user_id = $2`,
      [viewerId, viewedUserId],
    );
    const previousAt = existing.rows[0]?.viewed_at
      ? new Date(existing.rows[0].viewed_at as string).getTime()
      : null;
    const notify =
      previousAt == null || Date.now() - previousAt >= PROFILE_VIEW_NOTIFY_COOLDOWN_MS;

    await query(
      `INSERT INTO profile_views (viewer_id, viewed_user_id, viewed_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (viewer_id, viewed_user_id)
       DO UPDATE SET viewed_at = EXCLUDED.viewed_at`,
      [viewerId, viewedUserId],
    );

    return { notify };
  },

  async getViewersForUser(userId: string) {
    const isPremium = await premiumService.isPremium(userId);
    const limit = isPremium ? PREMIUM_PROFILE_VIEWERS_LIMIT : FREE_PROFILE_VIEWERS_LIMIT;

    const totalResult = await query(
      `SELECT COUNT(*)::int AS total FROM profile_views WHERE viewed_user_id = $1`,
      [userId],
    );
    const total = (totalResult.rows[0]?.total as number) ?? 0;

    const result = await query(
      `SELECT
         u.id,
         u.name,
         u.age,
         u.photo_url,
         COALESCE(p.online, FALSE) AS online,
         pv.viewed_at
       FROM profile_views pv
       JOIN users u ON u.id = pv.viewer_id
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE pv.viewed_user_id = $1
         AND u.is_verified = TRUE
         AND NOT EXISTS (
           SELECT 1 FROM blocks b
           WHERE (b.blocker_id = $1 AND b.blocked_id = u.id)
              OR (b.blocker_id = u.id AND b.blocked_id = $1)
         )
       ORDER BY pv.viewed_at DESC
       LIMIT $2`,
      [userId, limit],
    );

    const viewers = result.rows.map((row) => ({
      id: row.id as string,
      name: row.name as string,
      age: row.age as number,
      photo_url: (row.photo_url as string | null) ?? null,
      online: Boolean(row.online),
      viewed_at: new Date(row.viewed_at as string).toISOString(),
    })) satisfies ProfileViewerRow[];

    return {
      viewers,
      total,
      limit,
      is_premium: isPremium,
      has_more: !isPremium && total > FREE_PROFILE_VIEWERS_LIMIT,
      hidden_count: !isPremium ? Math.max(0, total - FREE_PROFILE_VIEWERS_LIMIT) : 0,
    };
  },
};
