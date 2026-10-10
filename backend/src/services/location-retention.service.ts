import { query } from '../db';
import {
  COMMUNITY_VISIBLE_HOURS,
  LocationRetentionConfig,
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
  staleLiveCleared: number;
  mapFeedStripped: number;
  communityStripped: number;
};

export const locationRetentionService = {
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

  async runPurge(now: Date = new Date(), cfg: LocationRetentionConfig = locationRetentionConfig()): Promise<LocationPurgeResult> {
    const staleLiveCleared = await this.clearStaleLiveLocations(now, cfg);
    const mapFeedStripped = await this.stripExpiredMapFeedCoords(now, cfg);
    const communityStripped = await this.stripExpiredCommunityCoords(now, cfg);
    return { staleLiveCleared, mapFeedStripped, communityStripped };
  },

  /**
   * Account deletion: remove every location row the member owns before the
   * user row goes (the FKs cascade too; this keeps it explicit and covers rooms,
   * whose created_by is SET NULL rather than cascaded).
   */
  async eraseAccountLocationData(userId: string) {
    await query(`DELETE FROM map_feed_messages WHERE sender_id = $1`, [userId]);
    await query(`DELETE FROM community_posts WHERE user_id = $1`, [userId]);
    // Chat location shares sent or received by the member.
    await query(
      `DELETE FROM messages WHERE media_type = 'location' AND (sender_id = $1 OR receiver_id = $1)`,
      [userId],
    );
    // Member-made rooms survive for the other members, without the point the
    // creator set. Official, venue and event rooms keep their venue location.
    await query(
      `UPDATE rooms SET location = NULL, lat = NULL, lng = NULL
        WHERE created_by = $1
          AND is_official = FALSE
          AND is_venue_managed = FALSE
          AND venue_claim_id IS NULL
          AND kind <> 'event'`,
      [userId],
    );
    await query(
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
  if (!cfg.enabled) {
    console.log('[location-retention] off (LOCATION_PURGE_ENABLED is not true)');
    return null;
  }
  if (handle) return handle;
  const run = () =>
    locationRetentionService
      .runPurge(new Date(), locationRetentionConfig())
      .then((r) => {
        if (r.staleLiveCleared || r.mapFeedStripped || r.communityStripped) {
          console.log(
            `[location-retention] stale live cleared=${r.staleLiveCleared} map feed stripped=${r.mapFeedStripped} community stripped=${r.communityStripped}`,
          );
        }
      })
      .catch((err) => console.error('[location-retention] purge failed:', err));
  void run();
  handle = setInterval(run, cfg.purgeIntervalMinutes * 60 * 1000);
  handle.unref?.();
  return handle;
}
