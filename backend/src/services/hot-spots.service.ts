import { query } from '../db';
import { premiumService } from './premium.service';

/** Venue check-in pins expire after this many hours (documented product choice). */
export const ACTIVE_CHECKIN_TTL_HOURS = 4;
/** Outdoor cruising check-in pins expire after 2 hours (live signal). */
export const OUTDOOR_CHECKIN_TTL_HOURS = 2;

/** Public Cruise commercial filters (licensed premises). */
export const COMMERCIAL_HOT_SPOT_CATEGORY_SLUGS = [
  'saunas',
  'nightlife',
  'bars',
  'cinema',
] as const;

/**
 * Outdoor categories (ops-curated parks/open-spaces/parking).
 * Commercial importer must keep rejecting these slugs.
 * Public map: active commercial OR active ops-curated outdoor (Al residual-risk
 * override 2026-09-12). Soft-inactive Batch 1 (`ops-curated-batch1-2026-09:*`)
 * stays off until Product seeds/reactivates rows that appear in the override list.
 */
export const OUTDOOR_HOT_SPOT_CATEGORY_SLUGS = [
  'parks-trails',
  'open-spaces',
  'parking',
] as const;

/**
 * Cruising categories (outdoor cruising spots + licensed commercial saunas).
 */
export const CRUISING_HOT_SPOT_CATEGORY_SLUGS = [
  ...OUTDOOR_HOT_SPOT_CATEGORY_SLUGS,
  'saunas',
] as const;

/**
 * SQL predicate for public Cruise list/get/check-in/comment:
 * active commercial venues OR active ops-curated outdoor (non-UGC).
 * Call sites already require `hs.is_active = TRUE`, so soft-inactive Batch 1
 * rows remain hidden unless Product reactivates them via override seed.
 */
export function isPublicHotSpotVisibilitySql(
  categoryAlias = 'c',
  spotAlias = 'hs',
): string {
  return `(
          ${categoryAlias}.is_commercial = TRUE
          OR (
            ${spotAlias}.source = 'ops-curated'
            AND ${spotAlias}.is_user_generated = FALSE
            AND ${categoryAlias}.slug IN ('parks-trails', 'open-spaces', 'parking')
          )
        )`;
}

export type HotSpotCategory = {
  id: number;
  slug: string;
  name: string;
  icon: string;
  description: string | null;
  is_commercial?: boolean;
};

export type HotSpotReviewRow = {
  id: string;
  spot_id: string;
  user_id: string;
  rating: number;
  body: string;
  is_anonymous: boolean;
  created_at: string;
  updated_at: string;
  author_name: string;
  author_photo_url: string | null;
  is_mine: boolean;
};

export type HotSpotReviewsResult = {
  reviews: HotSpotReviewRow[];
  rating_avg: number | null;
  review_count: number;
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
  /** Short-lived check-in window in hours (2h for outdoor cruising, 4h for commercial). */
  checkin_ttl_hours: number;
  /** True when at least one non-expired check-in is present. */
  has_active_checkins: boolean;
  nation: string | null;
  venue_type: string | null;
  source_url: string | null;
  verified_at: string | null;
  last_activity_at: string | null;
  claimed_by_user_id?: string | null;
  claim_status?: string;
  is_calendar_managed?: boolean;
  can_manage_calendar?: boolean;
  rating_avg: number | null;
  review_count: number;
};

function formatLiveCount(exact: number, isPremium: boolean): number | string {
  if (isPremium) return exact;
  if (exact >= 5) return '5+';
  return exact;
}

function mapSpotRow(row: Record<string, unknown>, isPremium: boolean, currentUserId?: string): HotSpotRow {
  const exact = Number(row.live_count_exact ?? 0);
  const claimedBy = (row.claimed_by_user_id as string | null) ?? null;
  const claimStatus = (row.claim_status as string | null) ?? 'unclaimed';
  const isCalendarManaged = Boolean(row.is_calendar_managed);
  const isOutdoor = OUTDOOR_HOT_SPOT_CATEGORY_SLUGS.includes(row.category_slug as any);
  const ttlHours = isOutdoor ? OUTDOOR_CHECKIN_TTL_HOURS : ACTIVE_CHECKIN_TTL_HOURS;
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
    checkin_ttl_hours: ttlHours,
    has_active_checkins: exact > 0,
    nation: (row.nation as string | null) ?? null,
    venue_type: (row.venue_type as string | null) ?? null,
    source_url: (row.source_url as string | null) ?? null,
    verified_at: row.verified_at != null ? String(row.verified_at) : null,
    last_activity_at: row.last_activity_at != null ? new Date(row.last_activity_at as string | Date).toISOString() : null,
    claimed_by_user_id: claimedBy,
    claim_status: claimStatus,
    is_calendar_managed: isCalendarManaged,
    can_manage_calendar: Boolean(currentUserId && claimedBy === currentUserId && claimStatus === 'approved'),
    rating_avg: row.rating_avg != null ? Number(row.rating_avg) : null,
    review_count: Number(row.review_count ?? 0),
  };
}

const SPOT_SELECT_COLS = `
          hs.id,
          hs.name,
          hs.city,
          hs.description,
          hs.latitude,
          hs.longitude,
          hs.category_id,
          hs.nation,
          hs.venue_type,
          hs.source_url,
          hs.verified_at,
          hs.last_activity_at,
          hs.claimed_by_user_id,
          hs.claim_status,
          hs.is_calendar_managed,
          c.slug AS category_slug,
          c.name AS category_name,
          c.icon AS category_icon`;

const CHECKIN_INTERVAL_SQL = `(
  CASE WHEN c.slug IN ('parks-trails', 'open-spaces', 'parking') THEN '${OUTDOOR_CHECKIN_TTL_HOURS} hours'::interval
       ELSE '${ACTIVE_CHECKIN_TTL_HOURS} hours'::interval END
)`;

export const hotSpotsService = {
  async listCategories(): Promise<HotSpotCategory[]> {
    const res = await query(
      `SELECT id, slug, name, icon, description, is_commercial
         FROM hot_spot_categories
        WHERE is_commercial = TRUE
           OR slug IN ('parks-trails', 'open-spaces', 'parking')
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
    outdoorOnly?: boolean;
    cruisingOnly?: boolean;
    query?: string;
    sortBy?: 'live' | 'closest';
    limit?: number;
  }): Promise<HotSpotRow[]> {
    const limit = opts.limit ?? 40;
    const isPremium = await premiumService.isPremium(opts.userId);

    const values: unknown[] = [
      opts.lat,
      opts.lng,
      opts.userId,
    ];

    let categoryFilter = '';
    if (opts.categorySlug) {
      const slug = opts.categorySlug === 'sauna' ? 'saunas' : opts.categorySlug;
      values.push(slug);
      categoryFilter = ` AND c.slug = $${values.length}`;
    } else if (opts.cruisingOnly) {
      values.push([...CRUISING_HOT_SPOT_CATEGORY_SLUGS]);
      categoryFilter = ` AND c.slug = ANY($${values.length})`;
    } else if (opts.outdoorOnly) {
      values.push([...OUTDOOR_HOT_SPOT_CATEGORY_SLUGS]);
      categoryFilter = ` AND c.slug = ANY($${values.length})`;
    }

    let searchFilter = '';
    const hasQuery = Boolean(opts.query && opts.query.trim());
    if (hasQuery) {
      values.push(`%${opts.query!.trim().toLowerCase()}%`);
      const qIdx = values.length;
      searchFilter = ` AND (
        lower(hs.name) LIKE $${qIdx}
        OR lower(COALESCE(hs.city, '')) LIKE $${qIdx}
        OR lower(COALESCE(hs.description, '')) LIKE $${qIdx}
        OR lower(c.name) LIKE $${qIdx}
      )`;
    }

    let distanceFilter = '';
    if (opts.radiusKm) {
      values.push(opts.radiusKm * 1000);
      distanceFilter = ` AND ST_DWithin(
        ST_SetSRID(ST_MakePoint(hs.longitude, hs.latitude), 4326)::geography,
        ST_MakePoint($2, $1)::geography,
        $${values.length}
      )`;
    } else if (!hasQuery) {
      const defaultRadiusM = (opts.outdoorOnly || opts.cruisingOnly ? 100 : 50) * 1000;
      values.push(defaultRadiusM);
      distanceFilter = ` AND ST_DWithin(
        ST_SetSRID(ST_MakePoint(hs.longitude, hs.latitude), 4326)::geography,
        ST_MakePoint($2, $1)::geography,
        $${values.length}
      )`;
    }

    // Only spots with real valid coords (finite, non-zero, within range)
    const validCoordsFilter = `
      AND hs.latitude IS NOT NULL
      AND hs.longitude IS NOT NULL
      AND hs.latitude != 0
      AND hs.longitude != 0
      AND hs.latitude BETWEEN -90 AND 90
      AND hs.longitude BETWEEN -180 AND 180
    `;

    values.push(limit);
    const limitIdx = values.length;

    const orderSql =
      opts.sortBy === 'closest' || hasQuery
        ? `ORDER BY distance_km ASC NULLS LAST, hs.name ASC`
        : `ORDER BY live_count_exact DESC, distance_km ASC NULLS LAST, hs.name ASC`;

    const res = await query(
      `SELECT
          ${SPOT_SELECT_COLS},
          ROUND((ST_Distance(
            ST_SetSRID(ST_MakePoint(hs.longitude, hs.latitude), 4326)::geography,
            ST_MakePoint($2, $1)::geography
          ) / 1000.0)::numeric, 1) AS distance_km,
          (
            SELECT COUNT(*)::int
              FROM hot_spot_checkins ci
             WHERE ci.spot_id = hs.id
               AND ci.checked_out_at IS NULL
               AND ci.checked_in_at > NOW() - ${CHECKIN_INTERVAL_SQL}
          ) AS live_count_exact,
          EXISTS (
            SELECT 1 FROM hot_spot_checkins mine
             WHERE mine.spot_id = hs.id
               AND mine.user_id = $3
               AND mine.checked_out_at IS NULL
               AND mine.checked_in_at > NOW() - ${CHECKIN_INTERVAL_SQL}
          ) AS is_checked_in,
          (
            SELECT mine.is_anonymous FROM hot_spot_checkins mine
             WHERE mine.spot_id = hs.id
               AND mine.user_id = $3
               AND mine.checked_out_at IS NULL
               AND mine.checked_in_at > NOW() - ${CHECKIN_INTERVAL_SQL}
             LIMIT 1
          ) AS my_checkin_anonymous,
          (
            SELECT ROUND(AVG(r.rating)::numeric, 1)
              FROM hot_spot_reviews r
             WHERE r.spot_id = hs.id
          ) AS rating_avg,
          (
            SELECT COUNT(*)::int
              FROM hot_spot_reviews r
             WHERE r.spot_id = hs.id
          ) AS review_count
         FROM hot_spots hs
         JOIN hot_spot_categories c ON c.id = hs.category_id
        WHERE hs.is_active = TRUE
          AND ${isPublicHotSpotVisibilitySql('c', 'hs')}
          ${validCoordsFilter}
          ${distanceFilter}
          ${categoryFilter}
          ${searchFilter}
        ${orderSql}
        LIMIT $${limitIdx}`,
      values,
    );

    return res.rows.map((row) => mapSpotRow(row, isPremium, opts.userId));
  },

  async getSpot(userId: string, spotId: string): Promise<HotSpotRow | null> {
    const isPremium = await premiumService.isPremium(userId);
    const res = await query(
      `SELECT
          ${SPOT_SELECT_COLS},
          NULL::numeric AS distance_km,
          (
            SELECT COUNT(*)::int
              FROM hot_spot_checkins ci
             WHERE ci.spot_id = hs.id
               AND ci.checked_out_at IS NULL
               AND ci.checked_in_at > NOW() - ${CHECKIN_INTERVAL_SQL}
          ) AS live_count_exact,
          EXISTS (
            SELECT 1 FROM hot_spot_checkins mine
             WHERE mine.spot_id = hs.id
               AND mine.user_id = $2
               AND mine.checked_out_at IS NULL
               AND mine.checked_in_at > NOW() - ${CHECKIN_INTERVAL_SQL}
          ) AS is_checked_in,
          (
            SELECT mine.is_anonymous FROM hot_spot_checkins mine
             WHERE mine.spot_id = hs.id
               AND mine.user_id = $2
               AND mine.checked_out_at IS NULL
               AND mine.checked_in_at > NOW() - ${CHECKIN_INTERVAL_SQL}
             LIMIT 1
          ) AS my_checkin_anonymous,
          (
            SELECT ROUND(AVG(r.rating)::numeric, 1)
              FROM hot_spot_reviews r
             WHERE r.spot_id = hs.id
          ) AS rating_avg,
          (
            SELECT COUNT(*)::int
              FROM hot_spot_reviews r
             WHERE r.spot_id = hs.id
          ) AS review_count
         FROM hot_spots hs
         JOIN hot_spot_categories c ON c.id = hs.category_id
        WHERE hs.id = $1 AND hs.is_active = TRUE
          AND ${isPublicHotSpotVisibilitySql('c', 'hs')}`,
      [spotId, userId],
    );
    if (!res.rows[0]) return null;
    return mapSpotRow(res.rows[0], isPremium, userId);
  },

  async checkIn(userId: string, spotId: string, anonymous: boolean) {
    const spot = await query(
      `SELECT hs.id, c.slug AS category_slug
         FROM hot_spots hs
         JOIN hot_spot_categories c ON c.id = hs.category_id
        WHERE hs.id = $1 AND hs.is_active = TRUE
          AND ${isPublicHotSpotVisibilitySql('c', 'hs')}`,
      [spotId],
    );
    if (!spot.rows[0]) {
      throw new Error('Spot not found');
    }

    const catSlug = spot.rows[0].category_slug as string;
    const isOutdoor = OUTDOOR_HOT_SPOT_CATEGORY_SLUGS.includes(catSlug as any);
    const ttlHours = isOutdoor ? OUTDOOR_CHECKIN_TTL_HOURS : ACTIVE_CHECKIN_TTL_HOURS;

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
      [userId, spotId, String(ttlHours)],
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
    const spot = await query(
      `SELECT hs.id
         FROM hot_spots hs
         JOIN hot_spot_categories c ON c.id = hs.category_id
        WHERE hs.id = $1 AND hs.is_active = TRUE
          AND ${isPublicHotSpotVisibilitySql('c', 'hs')}`,
      [spotId],
    );
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
      `SELECT ci.spot_id, ci.is_anonymous, ci.checked_in_at, hs.name, hs.city, c.name AS category_name, c.slug AS category_slug
         FROM hot_spot_checkins ci
         JOIN hot_spots hs ON hs.id = ci.spot_id
         JOIN hot_spot_categories c ON c.id = hs.category_id
        WHERE ci.user_id = $1
          AND ci.checked_out_at IS NULL
          AND ci.checked_in_at > NOW() - ${CHECKIN_INTERVAL_SQL}
        ORDER BY ci.checked_in_at DESC
        LIMIT 1`,
      [userId],
    );
    return res.rows[0] ?? null;
  },

  async listReviews(spotId: string, currentUserId?: string): Promise<HotSpotReviewsResult> {
    const spot = await query(
      `SELECT hs.id
         FROM hot_spots hs
         JOIN hot_spot_categories c ON c.id = hs.category_id
        WHERE hs.id = $1 AND hs.is_active = TRUE
          AND ${isPublicHotSpotVisibilitySql('c', 'hs')}`,
      [spotId],
    );
    if (!spot.rows[0]) {
      throw new Error('Spot not found');
    }

    const reviewsRes = await query(
      `SELECT r.id, r.spot_id, r.user_id, r.rating, r.body, r.is_anonymous,
              r.created_at, r.updated_at,
              CASE WHEN r.is_anonymous = TRUE THEN 'Anonymous' ELSE u.name END AS author_name,
              CASE WHEN r.is_anonymous = TRUE THEN NULL ELSE u.photo_url END AS author_photo_url
         FROM hot_spot_reviews r
         JOIN users u ON u.id = r.user_id
        WHERE r.spot_id = $1
        ORDER BY r.created_at DESC
        LIMIT 50`,
      [spotId],
    );

    const statsRes = await query(
      `SELECT ROUND(AVG(rating)::numeric, 1) AS rating_avg, COUNT(*)::int AS review_count
         FROM hot_spot_reviews
        WHERE spot_id = $1`,
      [spotId],
    );

    const stats = statsRes.rows[0];
    const reviews: HotSpotReviewRow[] = reviewsRes.rows.map((row) => ({
      id: row.id as string,
      spot_id: row.spot_id as string,
      user_id: row.user_id as string,
      rating: Number(row.rating),
      body: row.body as string,
      is_anonymous: Boolean(row.is_anonymous),
      created_at: new Date(row.created_at as string | Date).toISOString(),
      updated_at: new Date(row.updated_at as string | Date).toISOString(),
      author_name: row.author_name as string,
      author_photo_url: (row.author_photo_url as string | null) ?? null,
      is_mine: currentUserId ? (row.user_id as string) === currentUserId : false,
    }));

    return {
      reviews,
      rating_avg: stats?.rating_avg != null ? Number(stats.rating_avg) : null,
      review_count: Number(stats?.review_count ?? 0),
    };
  },

  async addOrUpdateReview(
    userId: string,
    spotId: string,
    rating: number,
    body: string,
    anonymous = true,
  ) {
    const spot = await query(
      `SELECT hs.id
         FROM hot_spots hs
         JOIN hot_spot_categories c ON c.id = hs.category_id
        WHERE hs.id = $1 AND hs.is_active = TRUE
          AND ${isPublicHotSpotVisibilitySql('c', 'hs')}`,
      [spotId],
    );
    if (!spot.rows[0]) {
      throw new Error('Spot not found');
    }

    const roundedRating = Math.round(rating);
    if (roundedRating < 1 || roundedRating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    const trimmedBody = body.trim();
    if (trimmedBody.length < 1 || trimmedBody.length > 500) {
      throw new Error('Review text must be between 1 and 500 characters');
    }

    const res = await query(
      `INSERT INTO hot_spot_reviews (spot_id, user_id, rating, body, is_anonymous, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       ON CONFLICT (spot_id, user_id)
       DO UPDATE SET
         rating = EXCLUDED.rating,
         body = EXCLUDED.body,
         is_anonymous = EXCLUDED.is_anonymous,
         updated_at = NOW()
       RETURNING id, spot_id, user_id, rating, body, is_anonymous, created_at, updated_at`,
      [spotId, userId, roundedRating, trimmedBody, anonymous],
    );

    const updatedSpot = await this.getSpot(userId, spotId);
    return {
      review: res.rows[0],
      spot: updatedSpot,
    };
  },

  async deleteReview(userId: string, spotId: string, reviewId?: string) {
    let sql = `DELETE FROM hot_spot_reviews WHERE user_id = $1 AND spot_id = $2`;
    const params: unknown[] = [userId, spotId];
    if (reviewId) {
      sql += ` AND id = $3`;
      params.push(reviewId);
    }
    await query(sql, params);
    const updatedSpot = await this.getSpot(userId, spotId);
    return { ok: true, spot: updatedSpot };
  },

  /**
   * Nightlife Integration: find or create a Hot Spot pin for an event venue,
   * then check in. Pin activity uses the same 4-hour TTL as other Hot Spots.
   * Check-in is free (no premium gate).
   */
  async checkInAtEvent(
    userId: string,
    event: {
      id: string;
      name: string;
      venue_name: string | null;
      lat: number | null | string;
      lng: number | null | string;
    },
    anonymous = false,
  ) {
    const lat = event.lat == null ? NaN : Number(event.lat);
    const lng = event.lng == null ? NaN : Number(event.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new Error('Event has no venue location');
    }

    const existing = await query(
      `SELECT id FROM hot_spots WHERE event_id = $1 AND is_active = TRUE`,
      [event.id],
    );
    let spotId = existing.rows[0]?.id as string | undefined;

    if (!spotId) {
      const nearby = await query(
        `SELECT id FROM hot_spots
          WHERE is_active = TRUE
            AND ST_DWithin(
              ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
              ST_MakePoint($2, $1)::geography,
              80
            )
          ORDER BY name = $3 DESC
          LIMIT 1`,
        [lat, lng, event.venue_name ?? event.name],
      );
      spotId = nearby.rows[0]?.id as string | undefined;
    }

    if (!spotId) {
      const cat = await query(`SELECT id FROM hot_spot_categories WHERE slug = 'nightlife'`);
      const categoryId = cat.rows[0]?.id;
      if (!categoryId) throw new Error('Nightlife category missing');
      const venueLabel = (event.venue_name || event.name).slice(0, 120);
      const created = await query(
        `INSERT INTO hot_spots (
           category_id, name, city, description, latitude, longitude,
           is_user_generated, event_id, venue_type, source
         )
         VALUES ($1, $2, NULL, $3, $4, $5, TRUE, $6, 'club', 'event-checkin')
         RETURNING id`,
        [
          categoryId,
          venueLabel,
          `Commercial venue pin for ${event.name}. Follow the venue's rules. MenRush does not run this place.`.slice(
            0,
            240,
          ),
          lat,
          lng,
          event.id,
        ],
      );
      spotId = created.rows[0].id as string;
    } else {
      await query(`UPDATE hot_spots SET event_id = COALESCE(event_id, $2) WHERE id = $1`, [
        spotId,
        event.id,
      ]);
    }

    return this.checkIn(userId, spotId, anonymous);
  },
};