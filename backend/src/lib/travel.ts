/**
 * Travel (Premium): Look around another town or city, and Plan a trip there.
 *
 * Safety rules (must hold):
 *  - Look around never writes a location and never changes the point anyone's
 *    distance is measured from. It reads the destination only.
 *  - A visitor shows at the destination's city centre, rounded to 2 decimal
 *    places (about 1 km). Never their GPS, never a precise point.
 *  - Distance to a visitor is never a number: it reads "Visiting <city>".
 *  - While a trip is live the member shows in one place only: the destination.
 *  - locationJumpGate is untouched: a trip does not move the stored location.
 */
import type { UkIePlace } from './ukIePlace';

/** A trip can start today or up to this many days ahead. */
export const TRAVEL_MAX_LEAD_DAYS = 7;
/** Longest trip, counting the first and last day. */
export const TRAVEL_MAX_TRIP_DAYS = 14;
/** Locals within this distance of the city centre see a visitor in Nearby. */
export const TRAVEL_VISIBLE_RADIUS_M = 25_000;
/** Dates are UK calendar days. */
export const TRAVEL_TIME_ZONE = 'Europe/London';

export const TRAVEL_PREMIUM_FEATURE = 'travel' as const;

export type TravelErrorCode =
  | 'premium_required'
  | 'invalid_city'
  | 'invalid_dates'
  | 'starts_too_late'
  | 'trip_too_long'
  | 'starts_in_past';

export class TravelError extends Error {
  constructor(
    public readonly code: TravelErrorCode,
    public readonly status: number,
  ) {
    super(code);
    this.name = 'TravelError';
  }
}

/** Short, honest copy for each error. */
export const TRAVEL_ERROR_COPY: Record<TravelErrorCode, string> = {
  premium_required: 'Travel is part of Premium.',
  invalid_city: 'Pick a UK or Ireland town or city.',
  invalid_dates: 'Pick a start and end date.',
  starts_too_late: `Trips can start up to ${TRAVEL_MAX_LEAD_DAYS} days ahead.`,
  trip_too_long: `Trips can be up to ${TRAVEL_MAX_TRIP_DAYS} days long.`,
  starts_in_past: 'Pick a start date from today.',
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Today's date in the UK as YYYY-MM-DD. */
export function ukToday(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TRAVEL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function dayNumber(isoDate: string): number | null {
  if (!DATE_RE.test(isoDate)) return null;
  const ms = Date.UTC(
    Number(isoDate.slice(0, 4)),
    Number(isoDate.slice(5, 7)) - 1,
    Number(isoDate.slice(8, 10)),
  );
  if (!Number.isFinite(ms)) return null;
  // Reject 2026-02-31 style dates that Date.UTC rolls over.
  if (new Date(ms).toISOString().slice(0, 10) !== isoDate) return null;
  return Math.round(ms / 86_400_000);
}

/** Validate trip dates (UK calendar days). Throws TravelError. */
export function validateTripDates(
  startsOn: unknown,
  endsOn: unknown,
  now: Date = new Date(),
): { startsOn: string; endsOn: string; days: number } {
  if (typeof startsOn !== 'string' || typeof endsOn !== 'string') {
    throw new TravelError('invalid_dates', 400);
  }
  const s = dayNumber(startsOn);
  const e = dayNumber(endsOn);
  const today = dayNumber(ukToday(now))!;
  if (s == null || e == null || e < s) throw new TravelError('invalid_dates', 400);
  if (s < today) throw new TravelError('starts_in_past', 400);
  if (s - today > TRAVEL_MAX_LEAD_DAYS) throw new TravelError('starts_too_late', 400);
  const days = e - s + 1;
  if (days > TRAVEL_MAX_TRIP_DAYS) throw new TravelError('trip_too_long', 400);
  return { startsOn, endsOn, days };
}

/** Coarse city centre: middle of the city's bounding box, 2 decimal places. */
export function coarseCityCentre(place: Pick<UkIePlace, 'south' | 'north' | 'west' | 'east'>): {
  lat: number;
  lng: number;
} {
  const round2 = (n: number) => Math.round(n * 100) / 100;
  return {
    lat: round2((place.south + place.north) / 2),
    lng: round2((place.west + place.east) / 2),
  };
}

/** Short city name for labels: "Manchester", not the full OSM display name. */
export function shortCityName(displayName: string): string {
  const first = String(displayName || '').split(',')[0]?.trim();
  return first || 'that city';
}

export function visitingLabel(city: string): string {
  return `Visiting ${city}`;
}

export type TripWindow = {
  starts_at: Date | string;
  ends_at: Date | string;
  ended_at?: Date | string | null;
};

function ms(v: Date | string | null | undefined): number | null {
  if (v == null) return null;
  const t = v instanceof Date ? v.getTime() : new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
}

/** Live right now: not ended, start passed, end not passed. */
export function isTripLive(trip: TripWindow, nowMs: number = Date.now()): boolean {
  if (ms(trip.ended_at ?? null) != null) return false;
  const s = ms(trip.starts_at);
  const e = ms(trip.ends_at);
  return s != null && e != null && s <= nowMs && nowMs < e;
}

export type TripStatus = 'planned' | 'live' | 'over';

export function tripStatus(trip: TripWindow, nowMs: number = Date.now()): TripStatus {
  if (ms(trip.ended_at ?? null) != null) return 'over';
  const e = ms(trip.ends_at);
  if (e == null || nowMs >= e) return 'over';
  return isTripLive(trip, nowMs) ? 'live' : 'planned';
}

/**
 * "Premium is included for everyone" switch, read at query-build time so a
 * change applies at once. premium.service registers its own check on load
 * (no import from here to the service, so no cycle). Default: not included.
 */
let premiumIncludedNow: () => boolean = () => false;
export function registerTravelPremiumIncluded(fn: () => boolean): void {
  premiumIncludedNow = fn;
}

/** Owner accounts that never lose Premium (lower-case), same as lib/always-premium. */
const ALWAYS_PREMIUM_SQL_LIST = "('boa90', 'bigbear25', 'hantsbear')";

/**
 * SQL: member `${userExpr}` has Premium right now. Same rule as
 * premiumService.getStatus (is_premium, started, not expired), plus the
 * always-Premium owners. A lapsed member's trip stops showing immediately.
 */
export function travelPremiumSql(userExpr: string): string {
  if (premiumIncludedNow()) return 'TRUE';
  return `EXISTS (
          SELECT 1 FROM users tpu
          WHERE tpu.id = ${userExpr}
            AND (
              (COALESCE(tpu.is_premium, FALSE)
                AND (tpu.premium_starts_at IS NULL OR tpu.premium_starts_at <= NOW())
                AND (tpu.premium_until IS NULL OR tpu.premium_until > NOW()))
              OR LOWER(TRIM(tpu.name)) IN ${ALWAYS_PREMIUM_SQL_LIST}
            )
        )`;
}

/** SQL: member `${userExpr}` has a live trip (inside its dates, not ended, Premium now). */
export function liveTripExistsSql(userExpr: string): string {
  return `EXISTS (
          SELECT 1 FROM travel_trips ltt
          WHERE ltt.user_id = ${userExpr}
            AND ltt.ended_at IS NULL
            AND ltt.starts_at <= NOW()
            AND ltt.ends_at > NOW()
            AND ${travelPremiumSql('ltt.user_id')}
        )`;
}

/** JOIN alias `tt` on the member's live trip (needs users alias `u`). */
export function liveTripJoinSql(): string {
  return `
      JOIN travel_trips tt
        ON tt.user_id = u.id
       AND tt.ended_at IS NULL
       AND tt.starts_at <= NOW()
       AND tt.ends_at > NOW()
       AND ${travelPremiumSql('tt.user_id')}`;
}
