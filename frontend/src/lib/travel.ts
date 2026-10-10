/**
 * Travel (Premium): Look around another town or city, or Plan a trip there.
 * Mirrors backend/src/lib/travel.ts. Copy stays short and true: Look around
 * does not move you; a trip shows you as "Visiting <city>" during its dates.
 */
export const TRAVEL_MAX_LEAD_DAYS = 7;
export const TRAVEL_MAX_TRIP_DAYS = 14;
export const TRAVEL_TIME_ZONE = 'Europe/London';

export type TravelPlace = {
  name: string;
  country_code: 'gb' | 'ie';
  centre: { lat: number; lng: number };
  bounds: { south: number; north: number; west: number; east: number };
};

export type TravelVisiting = { city: string; starts_at: string | null; ends_at: string | null };

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
  distance_label?: string;
  visiting?: TravelVisiting;
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
  status: 'planned' | 'live' | 'over';
};

export const TRAVEL_COPY = {
  title: 'Travel',
  intro: 'Look around another town or city, or plan a visit.',
  lookAroundHelp: "Looking around doesn't move your pin.",
  planHelp: `Pick dates up to ${TRAVEL_MAX_TRIP_DAYS} days long, starting within ${TRAVEL_MAX_LEAD_DAYS} days. During your dates, members there see you as Visiting.`,
  premiumTitle: 'Travel is part of Premium',
  premiumBody: 'Look around any UK or Ireland town or city, and plan a visit so you show as Visiting there during your dates.',
  premiumCta: 'See Premium',
  nearMe: 'Near me',
  endTrip: 'End trip',
} as const;

export function lookingAroundLabel(city: string): string {
  return `Looking around: ${city}`;
}

export function visitingLabel(city: string): string {
  return `Visiting ${city}`;
}

export function lookAroundPath(city: string): string {
  return `/travel/look?city=${encodeURIComponent(city)}`;
}

/** Today in the UK as YYYY-MM-DD. */
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

export function addDaysIso(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/** "12 Oct" from YYYY-MM-DD, no time zone drift. */
export function shortDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  if (!Number.isFinite(d.getTime())) return iso;
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(d);
}

/** "12 Oct" from an ISO timestamp, in UK time. */
export function shortDateFromTimestamp(ts: string | null | undefined, endExclusive = false): string | null {
  if (!ts) return null;
  const ms = Date.parse(ts);
  if (!Number.isFinite(ms)) return null;
  const d = new Date(endExclusive ? ms - 60_000 : ms);
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: TRAVEL_TIME_ZONE }).format(d);
}

/** "12 Oct" or "12 to 15 Oct" style range. */
export function dateRangeLabel(from: string | null, to: string | null): string | null {
  if (!from) return null;
  if (!to || from === to) return from;
  return `${from} to ${to}`;
}

/** "Visiting Manchester, 12 to 15 Oct" for profiles. */
export function visitingWithDates(v: TravelVisiting): string {
  const range = dateRangeLabel(
    shortDateFromTimestamp(v.starts_at),
    shortDateFromTimestamp(v.ends_at, true),
  );
  return range ? `${visitingLabel(v.city)}, ${range}` : visitingLabel(v.city);
}

/** Trip summary for the Travel sheet. */
export function tripSummary(trip: TravelTrip): string {
  const range = dateRangeLabel(shortDate(trip.starts_on), shortDate(trip.ends_on));
  return trip.status === 'live'
    ? `${visitingLabel(trip.city)} until ${shortDate(trip.ends_on)}`
    : `${trip.city}, ${range}`;
}

/** Client-side mirror of the server date rules. Returns an error line or null. */
export function tripDatesError(startsOn: string, endsOn: string, now: Date = new Date()): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startsOn) || !/^\d{4}-\d{2}-\d{2}$/.test(endsOn)) {
    return 'Pick a start and end date.';
  }
  const today = ukToday(now);
  if (startsOn < today) return 'Pick a start date from today.';
  if (startsOn > addDaysIso(today, TRAVEL_MAX_LEAD_DAYS)) {
    return `Trips can start up to ${TRAVEL_MAX_LEAD_DAYS} days ahead.`;
  }
  if (endsOn < startsOn) return 'The end date is before the start.';
  if (endsOn > addDaysIso(startsOn, TRAVEL_MAX_TRIP_DAYS - 1)) {
    return `Trips can be up to ${TRAVEL_MAX_TRIP_DAYS} days long.`;
  }
  return null;
}

/**
 * Client hint only; the server decides (402 shows the same Premium card).
 * Owner accounts are set on the server by id and arrive as `travel_owner`.
 */
export function hasTravelAccess(
  user: { is_premium?: boolean | null; travel_owner?: boolean | null } | null | undefined,
): boolean {
  if (!user) return false;
  return Boolean(user.is_premium || user.travel_owner);
}
