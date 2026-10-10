import { query } from '../db';
import { ACTIVE_CHECKIN_TTL_HOURS, OUTDOOR_CHECKIN_TTL_HOURS } from './hot-spots.service';
import {
  COMMUNITY_VISIBLE_HOURS,
  LOCATION_HOME_DECIMALS,
  LocationRetentionConfig,
  anyLocationPurgeEnabled,
  MAP_FEED_VISIBLE_MINUTES,
  REPORT_HOLD_STATUSES,
  locationRetentionConfig,
} from '../config/locationRetention';

/**
 * Location retention purge. Every function takes `now` so the real-PG tests
 * can drive it with a fake clock; nothing here reads NOW().
 *
 * Never run against prod until the periods are approved: the boot worker only
 * starts with LOCATION_PURGE_ENABLED=true.
 */

const HOLD_STATUSES = [...REPORT_HOLD_STATUSES];

// Reports are per member (reports.reported_id), not per post, so a post is
// held while any open or in-review report names its author.
const notHeldByReportSql = (userCol: string) => `NOT EXISTS (
  SELECT 1 FROM reports r
   WHERE r.reported_id = ${userCol}
     AND r.status = ANY($2::text[])
)`;

export type LocationPurgeResult = {
  locationUpdatedBackfilled: number;
  homeRounded: number;
  staleLiveCleared: number;
  mapFeedStripped: number;
  communityStripped: number;
  chatSharesCleared: number;
  checkinsDeleted: number;
};

/** What a cleared chat location share holds: valid JSON, no coordinates. */
export const CLEARED_CHAT_SHARE_PAYLOAD = '{"cleared":true}';

/** A check-in that was never checked out ends when its TTL runs out; use the longest TTL. */
const CHECKIN_MAX_TTL_HOURS = Math.max(ACTIVE_CHECKIN_TTL_HOURS, OUTDOOR_CHECKIN_TTL_HOURS);

export const locationRetentionService = {
  /**
   * Gated (LOCATION_PURGE_ENABLED): set location_updated_at from last_seen on
   * rows written before the column existed. Never earlier than the real last
   * fix, because every location write also sets last_seen.
   */
  async backfillLocationUpdatedAt(now: Date) {
    const r = await query(
      `UPDATE profiles
          SET location_updated_at = COALESCE(last_seen, updated_at, $1)
        WHERE location_updated_at IS NULL
          AND (lat IS NOT NULL OR location IS NOT NULL)`,
      [now],
    );
    return r.rowCount ?? 0;
  },

  /** Gated (LOCATION_PURGE_ENABLED): round stored home and visit anchor to about 1 km. */
  async roundHomeAndAnchors() {
    const d = LOCATION_HOME_DECIMALS;
    const round = (col: string) => `ROUND(${col}::numeric, ${d})::double precision`;
    const home = await query(
      `UPDATE profiles
          SET home_lat = ${round('home_lat')}, home_lng = ${round('home_lng')}
        WHERE home_lat IS NOT NULL
          AND (home_lat <> ${round('home_lat')} OR home_lng <> ${round('home_lng')})`,
    );
    const anchor = await query(
      `UPDATE profiles
          SET visitor_anchor_lat = ${round('visitor_anchor_lat')},
              visitor_anchor_lng = ${round('visitor_anchor_lng')}
        WHERE visitor_anchor_lat IS NOT NULL
          AND (visitor_anchor_lat <> ${round('visitor_anchor_lat')}
               OR visitor_anchor_lng <> ${round('visitor_anchor_lng')})`,
    );
    return (home.rowCount ?? 0) + (anchor.rowCount ?? 0);
  },

  /**
   * Optional rule (LOCATION_CHAT_SHARE_PURGE_ENABLED): clear the coordinates of
   * a chat location share chatShareDays after it was sent. The message stays
   * ("Shared location" with no map), held while a report on the sender is open.
   */
  async clearOldChatShareCoords(now: Date, cfg: LocationRetentionConfig = locationRetentionConfig()) {
    const cutoff = new Date(now.getTime() - cfg.chatShareDays * 24 * 60 * 60 * 1000);
    const r = await query(
      `UPDATE messages m
          SET message = $3
        WHERE m.media_type = 'location'
          AND m.created_at < $1
          AND m.message IS DISTINCT FROM $3
          AND m.withdrawn_at IS NULL
          AND ${notHeldByReportSql('m.sender_id')}`,
      [cutoff, HOLD_STATUSES, CLEARED_CHAT_SHARE_PAYLOAD],
    );
    return r.rowCount ?? 0;
  },

  /**
   * Optional rule (CHECKIN_PURGE_ENABLED): delete a Hot Spot check-in
   * checkinPurgeHours after it ended (check-out, or the longest TTL when the
   * member never checked out). hot_spots.last_activity_at is stored on the
   * spot, so it is not affected.
   */
  async deleteEndedCheckins(now: Date, cfg: LocationRetentionConfig = locationRetentionConfig()) {
    const r = await query(
      `DELETE FROM hot_spot_checkins
        WHERE COALESCE(checked_out_at, checked_in_at + make_interval(hours => $2::int))
              < $1::timestamptz - make_interval(hours => $3::int)`,
      [now, CHECKIN_MAX_TTL_HOURS, Math.round(cfg.checkinPurgeHours)],
    );
    return r.rowCount ?? 0;
  },

  /** Clear live location (and visit anchor) after liveStaleDays without an update. */
  async clearStaleLiveLocations(now: Date, cfg: LocationRetentionConfig = locationRetentionConfig()) {
    const cutoff = new Date(now.getTime() - cfg.liveStaleDays * 24 * 60 * 60 * 1000);
    const r = await query(
      `UPDATE profiles
          SET lat = NULL,
              lng = NULL,
              location = NULL,
              visitor_anchor_lat = NULL,
              visitor_anchor_lng = NULL,
              visitor_since = NULL,
              visitor_expires_at = NULL
        WHERE (lat IS NOT NULL OR location IS NOT NULL OR visitor_anchor_lat IS NOT NULL)
          AND COALESCE(location_updated_at, last_seen) < $1`,
      [cutoff],
    );
    return r.rowCount ?? 0;
  },

  /** Remove map feed post coordinates graceHours after the post expires, unless held by a report. */
  async stripExpiredMapFeedCoords(now: Date, cfg: LocationRetentionConfig = locationRetentionConfig()) {
    const cutoff = new Date(
      now.getTime() - MAP_FEED_VISIBLE_MINUTES * 60 * 1000 - cfg.mapFeedCoordsGraceHours * 60 * 60 * 1000,
    );
    const r = await query(
      `UPDATE map_feed_messages mf
          SET lat = NULL, lng = NULL, location = NULL
        WHERE mf.location IS NOT NULL
          AND mf.created_at < $1
          AND ${notHeldByReportSql('mf.sender_id')}`,
      [cutoff, HOLD_STATUSES],
    );
    return r.rowCount ?? 0;
  },

  /** Same for Community posts. */
  async stripExpiredCommunityCoords(now: Date, cfg: LocationRetentionConfig = locationRetentionConfig()) {
    const cutoff = new Date(
      now.getTime() - COMMUNITY_VISIBLE_HOURS * 60 * 60 * 1000 - cfg.communityCoordsGraceHours * 60 * 60 * 1000,
    );
    const r = await query(
      `UPDATE community_posts cp
          SET lat = NULL, lng = NULL, location = NULL
        WHERE cp.location IS NOT NULL
          AND cp.created_at < $1
          AND ${notHeldByReportSql('cp.user_id')}`,
      [cutoff, HOLD_STATUSES],
    );
    return r.rowCount ?? 0;
  },

  /** Each group runs only when its own flag is on; with every flag off this changes nothing. */
  async runPurge(now: Date = new Date(), cfg: LocationRetentionConfig = locationRetentionConfig()): Promise<LocationPurgeResult> {
    const out: LocationPurgeResult = {
      locationUpdatedBackfilled: 0,
      homeRounded: 0,
      staleLiveCleared: 0,
      mapFeedStripped: 0,
      communityStripped: 0,
      chatSharesCleared: 0,
      checkinsDeleted: 0,
    };
    if (cfg.enabled) {
      out.locationUpdatedBackfilled = await this.backfillLocationUpdatedAt(now);
      out.homeRounded = await this.roundHomeAndAnchors();
      out.staleLiveCleared = await this.clearStaleLiveLocations(now, cfg);
      out.mapFeedStripped = await this.stripExpiredMapFeedCoords(now, cfg);
      out.communityStripped = await this.stripExpiredCommunityCoords(now, cfg);
    }
    if (cfg.chatSharePurgeEnabled) out.chatSharesCleared = await this.clearOldChatShareCoords(now, cfg);
    if (cfg.checkinPurgeEnabled) out.checkinsDeleted = await this.deleteEndedCheckins(now, cfg);
    return out;
  },

  /**
   * Account deletion: remove every location row the member owns before the
   * user row goes (the FKs cascade too; this keeps it explicit and covers rooms,
   * whose created_by is SET NULL rather than cascaded).
   */
  async eraseAccountLocationData(
    userId: string,
    q: (text: string, params?: unknown[]) => Promise<unknown> = (text, params) => query(text, params as any[]),
  ) {
    await q(`DELETE FROM map_feed_messages WHERE sender_id = $1`, [userId]);
    await q(`DELETE FROM community_posts WHERE user_id = $1`, [userId]);
    // Chat location shares sent or received by the member.
    await q(
      `DELETE FROM messages WHERE media_type = 'location' AND (sender_id = $1 OR receiver_id = $1)`,
      [userId],
    );
    // Member-made rooms survive for the other members, without the point the
    // creator set. Official, venue and event rooms keep their venue location.
    await q(
      `UPDATE rooms SET location = NULL, lat = NULL, lng = NULL
        WHERE created_by = $1
          AND is_official = FALSE
          AND is_venue_managed = FALSE
          AND venue_claim_id IS NULL
          AND kind <> 'event'`,
      [userId],
    );
    await q(
      `UPDATE profiles
          SET lat = NULL, lng = NULL, location = NULL,
              home_lat = NULL, home_lng = NULL, home_set_at = NULL,
              visitor_anchor_lat = NULL, visitor_anchor_lng = NULL,
              visitor_since = NULL, visitor_expires_at = NULL
        WHERE user_id = $1`,
      [userId],
    );
  },
};

let handle: NodeJS.Timeout | null = null;

/** setInterval-at-boot, like the room and verification retention workers. Off unless enabled. */
export function startLocationRetentionWorker(): NodeJS.Timeout | null {
  const cfg = locationRetentionConfig();
  if (!anyLocationPurgeEnabled(cfg)) {
    console.log(
      '[location-retention] off (LOCATION_PURGE_ENABLED, LOCATION_CHAT_SHARE_PURGE_ENABLED and CHECKIN_PURGE_ENABLED are not true)',
    );
    return null;
  }
  if (handle) return handle;
  const run = () =>
    locationRetentionService
      .runPurge(new Date(), locationRetentionConfig())
      .then((r) => {
        if (Object.values(r).some((n) => n > 0)) {
          // Counts only, never member ids or coordinates.
          console.log(
            `[location-retention] backfilled=${r.locationUpdatedBackfilled} home rounded=${r.homeRounded} stale live cleared=${r.staleLiveCleared} map feed stripped=${r.mapFeedStripped} community stripped=${r.communityStripped} chat shares cleared=${r.chatSharesCleared} check-ins deleted=${r.checkinsDeleted}`,
          );
        }
      })
      .catch((err) => console.error('[location-retention] purge failed:', err));
  void run();
  handle = setInterval(run, cfg.purgeIntervalMinutes * 60 * 1000);
  handle.unref?.();
  return handle;
}
