import { query } from '../db';
import { premiumService } from './premium.service';

const ACTIVE_CHECKIN_TTL_HOURS = 4;

export type HotSpotCategory = {
  id: number;
  slug: string;
  name: string;
  icon: string;
  description: string | null;
};

export type HotSpotRow = {
  id: string;
  name: string;
  city: string | null;
  description: string | null;
  latitude: number;
  longitude: number;
  category_id: number;
  category_slug: string;
  category_name: string;
  category_icon: string;
  distance_km: number | null;
  live_count: number | string;
  live_count_exact: number;
  is_checked_in: boolean;
  my_checkin_anonymous: boolean | null;
};

function formatLiveCount(exact: number, isPremium: boolean): number | string {
  if (isPremium) return exact;
  if (exact >= 5) return '5+';
  return exact;
}

function mapSpotRow(row: Record<string, unknown>, isPremium: boolean): HotSpotRow {
  const exact = Number(row.live_count_exact ?? 0);
  return {
    id: row.id as string,
    name: row.name as string,
    city: (row.city as string | null) ?? null,
    description: (row.description as string | null) ?? null,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    category_id: Number(row.category_id),
    category_slug: row.category_slug as string,
    category_name: row.category_name as string,
    category_icon: row.category_icon as string,
    distance_km: row.distance_km != null ? Number(row.distance_km) : null,
    live_count: formatLiveCount(exact, isPremium),
    live_count_exact: exact,
    is_checked_in: Boolean(row.is_checked_in),
    my_checkin_anonymous:
      row.my_checkin_anonymous == null ? null : Boolean(row.my_checkin_anonymous),
  };
}

export const hotSpotsService = {
  async listCategories(): Promise<HotSpotCategory[]> {
    const res = await query(
      `SELECT id, slug, name, icon, description
         FROM hot_spot_categories
        ORDER BY sort_order ASC, name ASC`,
    );
    return res.rows;
  },

  async listNearby(opts: {
    userId: string;
    lat: number;
    lng: number;
    radiusKm?: number;
    categorySlug?: string;
    limit?: number;
  }): Promise<HotSpotRow[]> {
    const radiusMeters = (opts.radiusKm ?? 50) * 1000;
    const limit = opts.limit ?? 40;
    const isPremium = await premiumService.isPremium(opts.userId);

    const values: unknown[] = [
      opts.lat,
      opts.lng,
      radiusMeters,
      limit,
      opts.userId,
      String(ACTIVE_CHECKIN_TTL_HOURS),
    ];
    let categoryFilter = '';
    if (opts.categorySlug) {
      values.push(opts.categorySlug);
      categoryFilter = ` AND c.slug = $${values.length}`;
    }

    const res = await query(
      `SELECT
          hs.id,
          hs.name,
          hs.city,
          hs.description,
          hs.latitude,
          hs.longitude,
          hs.category_id,
          c.slug AS category_slug,
          c.name AS category_name,
          c.icon AS category_icon,
          ROUND((ST_Distance(
            ST_SetSRID(ST_MakePoint(hs.longitude, hs.latitude), 4326)::geography,
            ST_MakePoint($2, $1)::geography
          ) / 1000.0)::numeric, 1) AS distance_km,
          (
            SELECT COUNT(*)::int
              FROM hot_spot_checkins ci
             WHERE ci.spot_id = hs.id
               AND ci.checked_out_at IS NULL
               AND ci.checked_in_at > NOW() - ($6 || ' hours')::interval
          ) AS live_count_exact,
          EXISTS (
            SELECT 1 FROM hot_spot_checkins mine
             WHERE mine.spot_id = hs.id
               AND mine.user_id = $5
               AND mine.checked_out_at IS NULL
               AND mine.checked_in_at > NOW() - ($6 || ' hours')::interval
          ) AS is_checked_in,
          (
            SELECT mine.is_anonymous FROM hot_spot_checkins mine
             WHERE mine.spot_id = hs.id
               AND mine.user_id = $5
               AND mine.checked_out_at IS NULL
               AND mine.checked_in_at > NOW() - ($6 || ' hours')::interval
             LIMIT 1
          ) AS my_checkin_anonymous
         FROM hot_spots hs
         JOIN hot_spot_categories c ON c.id = hs.category_id
        WHERE hs.is_active = TRUE
          AND ST_DWithin(
            ST_SetSRID(ST_MakePoint(hs.longitude, hs.latitude), 4326)::geography,
            ST_MakePoint($2, $1)::geography,
            $3
          )
          ${categoryFilter}
        ORDER BY live_count_exact DESC, distance_km ASC NULLS LAST, hs.name ASC
        LIMIT $4`,
      values,
    );

    return res.rows.map((row) => mapSpotRow(row, isPremium));
  },

  async getSpot(userId: string, spotId: string): Promise<HotSpotRow | null> {
    const isPremium = await premiumService.isPremium(userId);
    const res = await query(
      `SELECT
          hs.id,
          hs.name,
          hs.city,
          hs.description,
          hs.latitude,
          hs.longitude,
          hs.category_id,
          c.slug AS category_slug,
          c.name AS category_name,
          c.icon AS category_icon,
          NULL::numeric AS distance_km,
          (
            SELECT COUNT(*)::int
              FROM hot_spot_checkins ci
             WHERE ci.spot_id = hs.id
               AND ci.checked_out_at IS NULL
               AND ci.checked_in_at > NOW() - ($3 || ' hours')::interval
          ) AS live_count_exact,
          EXISTS (
            SELECT 1 FROM hot_spot_checkins mine
             WHERE mine.spot_id = hs.id
               AND mine.user_id = $2
               AND mine.checked_out_at IS NULL
               AND mine.checked_in_at > NOW() - ($3 || ' hours')::interval
          ) AS is_checked_in,
          (
            SELECT mine.is_anonymous FROM hot_spot_checkins mine
             WHERE mine.spot_id = hs.id
               AND mine.user_id = $2
               AND mine.checked_out_at IS NULL
               AND mine.checked_in_at > NOW() - ($3 || ' hours')::interval
             LIMIT 1
          ) AS my_checkin_anonymous
         FROM hot_spots hs
         JOIN hot_spot_categories c ON c.id = hs.category_id
        WHERE hs.id = $1 AND hs.is_active = TRUE`,
      [spotId, userId, String(ACTIVE_CHECKIN_TTL_HOURS)],
    );
    if (!res.rows[0]) return null;
    return mapSpotRow(res.rows[0], isPremium);
  },

  async checkIn(userId: string, spotId: string, anonymous: boolean) {
    const spot = await query(`SELECT id FROM hot_spots WHERE id = $1 AND is_active = TRUE`, [spotId]);
    if (!spot.rows[0]) {
      throw new Error('Spot not found');
    }

    await query(
      `UPDATE hot_spot_checkins
          SET checked_out_at = NOW()
        WHERE user_id = $1 AND checked_out_at IS NULL`,
      [userId],
    );

    const existing = await query(
      `SELECT id FROM hot_spot_checkins
        WHERE user_id = $1 AND spot_id = $2 AND checked_out_at IS NULL
          AND checked_in_at > NOW() - ($3 || ' hours')::interval`,
      [userId, spotId, String(ACTIVE_CHECKIN_TTL_HOURS)],
    );
    if (existing.rows[0]) {
      return this.getSpot(userId, spotId);
    }

    await query(
      `INSERT INTO hot_spot_checkins (spot_id, user_id, is_anonymous)
       VALUES ($1, $2, $3)`,
      [spotId, userId, anonymous],
    );

    await query(
      `UPDATE hot_spots SET last_activity_at = NOW() WHERE id = $1`,
      [spotId],
    );

    return this.getSpot(userId, spotId);
  },

  /** Record a comment and bump spot freshness (used by ops / future UI). */
  async addComment(userId: string, spotId: string, body: string, anonymous = true) {
    const spot = await query(`SELECT id FROM hot_spots WHERE id = $1 AND is_active = TRUE`, [spotId]);
    if (!spot.rows[0]) {
      throw new Error('Spot not found');
    }
    const trimmed = body.trim();
    if (trimmed.length < 1 || trimmed.length > 500) {
      throw new Error('Comment must be 1–500 characters');
    }
    await query(
      `INSERT INTO hot_spot_comments (spot_id, user_id, body, is_anonymous)
       VALUES ($1, $2, $3, $4)`,
      [spotId, userId, trimmed, anonymous],
    );
    await query(`UPDATE hot_spots SET last_activity_at = NOW() WHERE id = $1`, [spotId]);
    return this.getSpot(userId, spotId);
  },

  async checkOut(userId: string, spotId?: string) {
    if (spotId) {
      await query(
        `UPDATE hot_spot_checkins
            SET checked_out_at = NOW()
          WHERE user_id = $1 AND spot_id = $2 AND checked_out_at IS NULL`,
        [userId, spotId],
      );
    } else {
      await query(
        `UPDATE hot_spot_checkins
            SET checked_out_at = NOW()
          WHERE user_id = $1 AND checked_out_at IS NULL`,
        [userId],
      );
    }
    return { ok: true };
  },

  async getMyCheckIn(userId: string) {
    const res = await query(
      `SELECT ci.spot_id, ci.is_anonymous, ci.checked_in_at, hs.name, hs.city, c.name AS category_name
         FROM hot_spot_checkins ci
         JOIN hot_spots hs ON hs.id = ci.spot_id
         JOIN hot_spot_categories c ON c.id = hs.category_id
        WHERE ci.user_id = $1
          AND ci.checked_out_at IS NULL
          AND ci.checked_in_at > NOW() - ($2 || ' hours')::interval
        ORDER BY ci.checked_in_at DESC
        LIMIT 1`,
      [userId, String(ACTIVE_CHECKIN_TTL_HOURS)],
    );
    return res.rows[0] ?? null;
  },
};