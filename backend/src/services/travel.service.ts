/**
 * Travel (Premium, Al 10 Oct 2026). See lib/travel.ts for the safety rules.
 *
 * Look around: browse a UK or Ireland town or city. Read-only. It never reads
 * or writes the viewer's own location, so it cannot move the point anyone's
 * distance is measured from, and it returns no distances at all.
 *
 * Plan a trip: one trip at a time. While live, locals see the member as
 * "Visiting <city>" at the coarse city centre, and the member is left out at
 * home (Nearby, map, search by town). Ends when the member ends it or when the
 * end date passes.
 */
import pool, { query } from '../db';
import { accessControl } from '../security/access';
import { premiumService } from './premium.service';
import { isAlwaysPremiumName } from '../lib/always-premium';
import { discoveryPhotoUrl } from '../lib/discoveryPhoto';
import { AGE_FILTER_MIN } from '../lib/age';
import { MAP_PIN_FUZZ_DEFAULT_M, MAP_PIN_FUZZ_MAX_M, privateMapPointAround } from '../lib/mapPinFuzz';
import { notLocationHiddenFromViewerSql } from '../lib/locationHiddenSql';
import { PRESENCE_LIVE_SQL } from '../lib/presence';
import { lookupUkIePlace, placeContainsPoint, type UkIePlace } from '../lib/ukIePlace';
import {
  LIVE_TRIP_JOIN_SQL,
  TRAVEL_PREMIUM_FEATURE,
  TRAVEL_TIME_ZONE,
  TravelError,
  coarseCityCentre,
  liveTripExistsSql,
  shortCityName,
  tripStatus,
  validateTripDates,
  visitingLabel,
  type TripStatus,
} from '../lib/travel';

const includeE2eFixtures = () =>
  process.env.INCLUDE_E2E_FIXTURES === 'true' || process.env.INCLUDE_E2E_FIXTURES === '1';

export const LOOK_AROUND_LIMIT = 120;

export type TravelPlace = {
  name: string;
  country_code: 'gb' | 'ie';
  centre: { lat: number; lng: number };
  bounds: { south: number; north: number; west: number; east: number };
};

export type LookAroundMember = {
  id: string;
  name: string;
  age: number | null;
  headline: string | null;
  photo_url: string | null;
  is_verified: boolean;
  online: boolean;
  lat: number;
  lng: number;
  /** Only for visitors: "Visiting <city>". Locals have no distance at all. */
  distance_label?: string;
  visiting?: { city: string; starts_at: string | null; ends_at: string | null };
};

export type TravelTrip = {
  id: string;
  city: string;
  country_code: 'gb' | 'ie';
  centre: { lat: number; lng: number };
  starts_on: string;
  ends_on: string;
  starts_at: string;
  ends_at: string;
  status: TripStatus;
};

function toPlace(place: UkIePlace): TravelPlace {
  return {
    name: shortCityName(place.displayName),
    country_code: place.countryCode,
    centre: coarseCityCentre(place),
    bounds: { south: place.south, north: place.north, west: place.west, east: place.east },
  };
}

function iso(v: unknown): string | null {
  if (v instanceof Date) return v.toISOString();
  return typeof v === 'string' ? v : null;
}

function tripFromRow(row: Record<string, any>, nowMs = Date.now()): TravelTrip {
  return {
    id: String(row.id),
    city: String(row.city_name),
    country_code: row.country_code === 'ie' ? 'ie' : 'gb',
    centre: { lat: Number(row.centre_lat), lng: Number(row.centre_lng) },
    starts_on: String(row.starts_on),
    ends_on: String(row.ends_on),
    starts_at: iso(row.starts_at) ?? '',
    ends_at: iso(row.ends_at) ?? '',
    status: tripStatus({ starts_at: row.starts_at, ends_at: row.ends_at, ended_at: row.ended_at }, nowMs),
  };
}

const TRIP_COLUMNS = `
  id, city_name, country_code, centre_lat, centre_lng, starts_at, ends_at, ended_at,
  to_char(starts_at AT TIME ZONE '${TRAVEL_TIME_ZONE}', 'YYYY-MM-DD') AS starts_on,
  to_char((ends_at AT TIME ZONE '${TRAVEL_TIME_ZONE}') - INTERVAL '1 day', 'YYYY-MM-DD') AS ends_on`;

/** Shared roster rules: visible, not Ghost, photo, adult, no block, not hidden from viewer, opted in. */
function lookAroundBaseWhere(viewerExpr: string): string {
  let sql = `
        u.id != ${viewerExpr}
        AND u.photo_url IS NOT NULL
        AND TRIM(u.photo_url) <> ''
        AND p.is_visible = true
        AND COALESCE(p.is_ghost, FALSE) = false
        AND u.age >= ${AGE_FILTER_MIN}
        AND COALESCE(p.show_in_look_around, TRUE) = true
        AND NOT EXISTS (
          SELECT 1 FROM blocks b
          WHERE (b.blocker_id = ${viewerExpr} AND b.blocked_id = u.id)
             OR (b.blocker_id = u.id AND b.blocked_id = ${viewerExpr})
        )
        AND ${notLocationHiddenFromViewerSql('u.id', viewerExpr)}`;
  if (!includeE2eFixtures()) sql += ` AND u.email NOT LIKE '%@example.com'`;
  return sql;
}

const MEMBER_SELECT = `
        u.id, u.name,
        CASE WHEN COALESCE(u.show_age, TRUE) THEN u.age ELSE NULL END AS age,
        u.headline, u.photo_url, u.map_photo_url,
        COALESCE(u.is_verified AND u.verification_provider = 'veriff', FALSE) AS is_verified,
        ${PRESENCE_LIVE_SQL} AS online`;

export const travelService = {
  /** Premium, or one of the always-Premium owner accounts (BOA90, Bigbear25, HantsBear). */
  async hasTravel(userId: string): Promise<boolean> {
    if (await premiumService.hasFeature(userId, TRAVEL_PREMIUM_FEATURE)) return true;
    const res = await query(`SELECT name FROM users WHERE id = $1`, [userId]);
    return isAlwaysPremiumName(res.rows[0]?.name);
  },

  async assertPremium(userId: string): Promise<void> {
    if (!(await this.hasTravel(userId))) throw new TravelError('premium_required', 402);
  },

  async resolvePlace(q: unknown): Promise<TravelPlace> {
    const term = typeof q === 'string' ? q.trim() : '';
    if (term.length < 2 || term.length > 80) throw new TravelError('invalid_city', 400);
    const place = await lookupUkIePlace(term);
    if (!place) throw new TravelError('invalid_city', 404);
    return toPlace(place);
  },

  /** Premium. Read-only: never touches the viewer's location or anyone's distance origin. */
  async lookAround(
    viewerId: string,
    cityQuery: unknown,
  ): Promise<{ place: TravelPlace; members: LookAroundMember[] }> {
    await accessControl.requireVerified(viewerId);
    await this.assertPremium(viewerId);
    const term = typeof cityQuery === 'string' ? cityQuery.trim() : '';
    if (term.length < 2 || term.length > 80) throw new TravelError('invalid_city', 400);
    const raw = await lookupUkIePlace(term);
    if (!raw) throw new TravelError('invalid_city', 404);
    const place = toPlace(raw);

    const placeValues: unknown[] = [viewerId, MAP_PIN_FUZZ_MAX_M];
    let placeGeogSql: string;
    if (raw.geojson) {
      placeValues.push(JSON.stringify(raw.geojson));
      placeGeogSql = `ST_SetSRID(ST_GeomFromGeoJSON($3), 4326)::geography`;
    } else {
      placeValues.push(raw.west, raw.south, raw.east, raw.north);
      placeGeogSql = `ST_MakeEnvelope($3, $4, $5, $6, 4326)::geography`;
    }

    // Locals: stored location in the place (buffered by max fuzz), then the
    // final match is on the fuzzed public pin, same as search by town.
    const localsRes = await query(
      `SELECT ${MEMBER_SELECT},
              p.lat AS real_lat, p.lng AS real_lng,
              COALESCE(p.map_pin_fuzz_m, ${MAP_PIN_FUZZ_DEFAULT_M}) AS map_pin_fuzz_m
         FROM users u
         JOIN profiles p ON p.user_id = u.id
        WHERE ${lookAroundBaseWhere('$1')}
          AND p.location IS NOT NULL AND p.lat IS NOT NULL AND p.lng IS NOT NULL
          AND ST_DWithin(p.location, ${placeGeogSql}, $2)
          AND NOT ${liveTripExistsSql('u.id')}
        ORDER BY ${PRESENCE_LIVE_SQL} DESC, p.last_seen DESC NULLS LAST
        LIMIT ${LOOK_AROUND_LIMIT * 2}`,
      placeValues,
    );

    // Visitors: live trips whose coarse centre is in this place.
    const visitorsRes = await query(
      `SELECT ${MEMBER_SELECT},
              tt.city_name AS visit_city, tt.centre_lat AS visit_lat, tt.centre_lng AS visit_lng,
              tt.starts_at AS visit_starts_at, tt.ends_at AS visit_ends_at
         FROM users u
         JOIN profiles p ON p.user_id = u.id
         ${LIVE_TRIP_JOIN_SQL}
        WHERE ${lookAroundBaseWhere('$1')}
          AND tt.centre_lat BETWEEN $2 AND $3
          AND tt.centre_lng BETWEEN $4 AND $5
        ORDER BY ${PRESENCE_LIVE_SQL} DESC, p.last_seen DESC NULLS LAST
        LIMIT ${LOOK_AROUND_LIMIT}`,
      [viewerId, raw.south, raw.north, raw.west, raw.east],
    );

    const base = (row: Record<string, any>) => ({
      id: String(row.id),
      name: String(row.name ?? 'Member'),
      age: row.age != null ? Number(row.age) : null,
      headline: (row.headline as string | null) ?? null,
      photo_url: discoveryPhotoUrl(row.map_photo_url, row.photo_url) ?? row.photo_url ?? null,
      is_verified: Boolean(row.is_verified),
      online: Boolean(row.online),
    });

    const locals: LookAroundMember[] = [];
    for (const row of localsRes.rows) {
      const realLat = Number(row.real_lat);
      const realLng = Number(row.real_lng);
      if (!Number.isFinite(realLat) || !Number.isFinite(realLng)) continue;
      const fuzz = Number(row.map_pin_fuzz_m);
      const pin = privateMapPointAround(
        realLat,
        realLng,
        `map:${row.id}`,
        Number.isFinite(fuzz) ? fuzz : MAP_PIN_FUZZ_DEFAULT_M,
      );
      if (!placeContainsPoint(raw, pin.lat, pin.lng)) continue;
      locals.push({ ...base(row), lat: pin.lat, lng: pin.lng });
    }

    const visitors: LookAroundMember[] = visitorsRes.rows.map((row: Record<string, any>) => ({
      ...base(row),
      lat: Number(row.visit_lat),
      lng: Number(row.visit_lng),
      distance_label: visitingLabel(String(row.visit_city)),
      visiting: {
        city: String(row.visit_city),
        starts_at: iso(row.visit_starts_at),
        ends_at: iso(row.visit_ends_at),
      },
    }));

    return { place, members: [...visitors, ...locals].slice(0, LOOK_AROUND_LIMIT) };
  },

  /** The member's open trip (planned or live), or null. Closes a trip whose end date passed. */
  async getTrip(userId: string): Promise<TravelTrip | null> {
    await query(
      `UPDATE travel_trips SET ended_at = ends_at
        WHERE user_id = $1 AND ended_at IS NULL AND ends_at <= NOW()`,
      [userId],
    );
    const res = await query(
      `SELECT ${TRIP_COLUMNS} FROM travel_trips
        WHERE user_id = $1 AND ended_at IS NULL AND ends_at > NOW()
        LIMIT 1`,
      [userId],
    );
    return res.rows[0] ? tripFromRow(res.rows[0]) : null;
  },

  /** Premium. Replaces any open trip: one place at a time. */
  async planTrip(
    userId: string,
    input: { city?: unknown; startsOn?: unknown; endsOn?: unknown },
    now: Date = new Date(),
  ): Promise<TravelTrip> {
    await accessControl.requireVerified(userId);
    await this.assertPremium(userId);
    const dates = validateTripDates(input.startsOn, input.endsOn, now);
    const term = typeof input.city === 'string' ? input.city.trim() : '';
    if (term.length < 2 || term.length > 80) throw new TravelError('invalid_city', 400);
    const raw = await lookupUkIePlace(term);
    if (!raw) throw new TravelError('invalid_city', 404);
    const place = toPlace(raw);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE travel_trips SET ended_at = NOW() WHERE user_id = $1 AND ended_at IS NULL`,
        [userId],
      );
      const res = await client.query(
        `INSERT INTO travel_trips
           (user_id, city_name, country_code, centre_lat, centre_lng,
            south, north, west, east, starts_at, ends_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9,
                 ($10::date)::timestamp AT TIME ZONE '${TRAVEL_TIME_ZONE}',
                 (($11::date) + 1)::timestamp AT TIME ZONE '${TRAVEL_TIME_ZONE}')
         RETURNING ${TRIP_COLUMNS}`,
        [
          userId,
          place.name,
          place.country_code,
          place.centre.lat,
          place.centre.lng,
          raw.south,
          raw.north,
          raw.west,
          raw.east,
          dates.startsOn,
          dates.endsOn,
        ],
      );
      await client.query('COMMIT');
      return tripFromRow(res.rows[0], now.getTime());
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  },

  /** Always allowed, Premium or not. */
  async endTrip(userId: string): Promise<{ ended: boolean }> {
    const res = await query(
      `UPDATE travel_trips SET ended_at = NOW() WHERE user_id = $1 AND ended_at IS NULL`,
      [userId],
    );
    return { ended: (res.rowCount ?? 0) > 0 };
  },

  async getShowInLookAround(userId: string): Promise<boolean> {
    const res = await query(
      `SELECT COALESCE(show_in_look_around, TRUE) AS v FROM profiles WHERE user_id = $1`,
      [userId],
    );
    return res.rows[0] ? Boolean(res.rows[0].v) : true;
  },

  /** Always allowed. */
  async setShowInLookAround(userId: string, value: boolean): Promise<boolean> {
    await query(`UPDATE profiles SET show_in_look_around = $2 WHERE user_id = $1`, [userId, value]);
    return value;
  },
};
