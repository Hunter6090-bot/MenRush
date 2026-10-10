/**
 * Location retention periods. ALL VALUES TBD pending Legal and Al's approval:
 * the defaults below are placeholders, set per environment with the env vars.
 *
 * The purge worker is OFF unless LOCATION_PURGE_ENABLED=true, so merging this
 * changes nothing in prod until Zoul turns it on. Read at call time so tests
 * (and a restart with new env) pick up changes.
 */

/** Map feed posts are shown for 15 minutes (map-feed.service listNearby). */
export const MAP_FEED_VISIBLE_MINUTES = 15;
/** Community posts are shown for 24 hours (community.service). */
export const COMMUNITY_VISIBLE_HOURS = 24;
/** Home and visit anchor are stored at 2 decimal places (about 1 km). */
export const LOCATION_HOME_DECIMALS = 2;
/** Report statuses that hold a member's post coordinates for moderation. */
export const REPORT_HOLD_STATUSES = ['open', 'reviewing'] as const;

function numEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (raw == null || raw.trim() === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

export type LocationRetentionConfig = {
  /** LOCATION_PURGE_ENABLED (default false): start the purge worker at boot. */
  enabled: boolean;
  /** LOCATION_LIVE_STALE_DAYS (default 30, TBD): clear live location after this long without an update. */
  liveStaleDays: number;
  /** LOCATION_MAP_FEED_COORDS_GRACE_HOURS (default 24, TBD): remove map feed post coordinates this long after the post expires. */
  mapFeedCoordsGraceHours: number;
  /** LOCATION_COMMUNITY_COORDS_GRACE_HOURS (default 24, TBD): remove Community post coordinates this long after the post expires. */
  communityCoordsGraceHours: number;
  /** LOCATION_PURGE_INTERVAL_MINUTES (default 60): how often the worker runs. */
  purgeIntervalMinutes: number;
};

export function locationRetentionConfig(): LocationRetentionConfig {
  return {
    enabled: String(process.env.LOCATION_PURGE_ENABLED || '').toLowerCase() === 'true',
    liveStaleDays: numEnv('LOCATION_LIVE_STALE_DAYS', 30, 1, 3650),
    mapFeedCoordsGraceHours: numEnv('LOCATION_MAP_FEED_COORDS_GRACE_HOURS', 24, 0, 24 * 365),
    communityCoordsGraceHours: numEnv('LOCATION_COMMUNITY_COORDS_GRACE_HOURS', 24, 0, 24 * 365),
    purgeIntervalMinutes: numEnv('LOCATION_PURGE_INTERVAL_MINUTES', 60, 5, 24 * 60),
  };
}

/** Round a coordinate to LOCATION_HOME_DECIMALS (about 1 km). */
export function coarsenCoord(value: number, decimals: number = LOCATION_HOME_DECIMALS): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}
