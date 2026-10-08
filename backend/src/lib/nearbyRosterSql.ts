import { AGE_FILTER_MIN } from './age';
import { notLocationHiddenFromViewerSql } from './locationHiddenSql';
import { MAP_PIN_FUZZ_DEFAULT_M } from './mapPinFuzz';
import { PRESENCE_LIVE_SQL } from './presence';
import { nearbyLocationPredicate } from './ukIrelandBounds';

export type DiscoveryScope = 'radius' | 'uk_ie';

/** Always four binds: lat, lng, userId, radiusMeters (0 on All). */
export function nearbyRosterBaseValues(
  lat: number,
  lng: number,
  userId: string,
  radiusMeters: number,
): [number, number, string, number] {
  return [lat, lng, userId, radiusMeters];
}

export function nearbyRosterSelectSql(): string {
  return `
      SELECT
        u.id, u.name, CASE WHEN COALESCE(u.show_age, TRUE) THEN u.age ELSE NULL END AS age,
        u.bio, u.headline, u.looking_for, u.photo_url, u.cover_url, u.map_photo_url, u.interests,
        CASE WHEN COALESCE(u.show_height, TRUE) THEN u.height_cm ELSE NULL END AS height_cm,
        CASE WHEN COALESCE(u.show_weight, TRUE) THEN u.weight_kg ELSE NULL END AS weight_kg,
        CASE WHEN COALESCE(u.show_relationship, TRUE) THEN u.relationship_status ELSE NULL END AS relationship_status,
        u.hosting_status, COALESCE(u.is_verified AND u.verification_provider = 'veriff', FALSE) AS is_verified, u.authenticity_status,
        u.created_at,
        (p.visitor_expires_at IS NOT NULL AND p.visitor_expires_at > NOW()) AS is_visitor,
        CASE
          WHEN p.visitor_expires_at IS NOT NULL AND p.visitor_expires_at > NOW()
          THEN p.visitor_expires_at
          ELSE NULL
        END AS visitor_expires_at,
        ${PRESENCE_LIVE_SQL} AS online,
        p.last_seen, p.available_until,
        (u.is_pulsing AND u.pulse_expires_at IS NOT NULL AND u.pulse_expires_at > NOW()) AS is_pulsing,
        CASE
          WHEN u.is_pulsing AND u.pulse_expires_at > NOW() THEN u.pulse_expires_at
          ELSE NULL
        END AS pulse_expires_at,
        CASE
          WHEN p.mood_set_at IS NOT NULL AND p.mood_set_at > NOW() - INTERVAL '6 hours' THEN p.mood
          ELSE NULL
        END AS mood,
        p.lat AS real_lat,
        p.lng AS real_lng,
        COALESCE(p.map_pin_fuzz_m, ${MAP_PIN_FUZZ_DEFAULT_M}) AS map_pin_fuzz_m,
        ST_Distance(p.location, ST_MakePoint($2, $1)::geography) as distance_m
      FROM users u
      JOIN profiles p ON u.id = p.user_id
    `;
}

export function nearbyRosterWhereSql(
  scope: DiscoveryScope,
  includeE2eFixtures: boolean,
): string {
  let whereClause = `
      WHERE u.id != $3
        AND u.photo_url IS NOT NULL
        AND TRIM(u.photo_url) <> ''
        ${nearbyLocationPredicate(scope)}
        AND p.is_visible = true
        AND p.is_ghost = false
        AND p.lat IS NOT NULL
        AND p.lng IS NOT NULL
        AND u.age >= ${AGE_FILTER_MIN}
        AND NOT EXISTS (
          SELECT 1 FROM blocks b
          WHERE (b.blocker_id = $3 AND b.blocked_id = u.id)
             OR (b.blocker_id = u.id AND b.blocked_id = $3)
        )
        -- Hide my location from: owner u is left out of this viewer's roster + map.
        AND ${notLocationHiddenFromViewerSql('u.id', '$3')}
    `;
  if (!includeE2eFixtures) {
    whereClause += ` AND u.email NOT LIKE '%@example.com'`;
  }
  return whereClause;
}

export function nearbyRosterCountSql(whereClause: string): string {
  return `
      SELECT COUNT(*)::int AS total
      FROM users u
      JOIN profiles p ON u.id = p.user_id
      ${whereClause}
    `;
}

export function nearbyRosterListSql(
  whereClause: string,
  limitIndex: number,
  offsetIndex: number,
): string {
  return `
      ${nearbyRosterSelectSql()}
      ${whereClause}
      ORDER BY
        (u.is_pulsing AND u.pulse_expires_at > NOW()) DESC,
        (p.available_until IS NOT NULL AND p.available_until > NOW()) DESC,
        (p.visitor_expires_at IS NOT NULL AND p.visitor_expires_at > NOW()) DESC,
        ${PRESENCE_LIVE_SQL} DESC,
        (u.photo_url IS NOT NULL AND u.photo_url NOT LIKE '/avatars/generic/%') DESC,
        p.last_seen DESC NULLS LAST
      LIMIT $${limitIndex} OFFSET $${offsetIndex}
    `;
}

/** Default All queries (no extra filters) — same SQL getNearbyUsers runs for scope=uk_ie. */
export function buildUkIeNearbyQueries(): {
  countSql: string;
  listSql: string;
  values: [number, number, string, number];
  listValues: [number, number, string, number, number, number];
} {
  const values = nearbyRosterBaseValues(51.5074, -0.1278, '00000000-0000-4000-8000-000000000001', 0);
  const whereClause = nearbyRosterWhereSql('uk_ie', false);
  return {
    countSql: nearbyRosterCountSql(whereClause),
    listSql: nearbyRosterListSql(whereClause, 5, 6),
    values,
    listValues: [...values, 1, 0],
  };
}
