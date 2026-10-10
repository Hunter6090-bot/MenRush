-- Location retention (draft, periods TBD pending Legal / Al).
-- Schema only. NO data changes on deploy: the home rounding and the
-- location_updated_at backfill run from the app (location-retention worker),
-- which is OFF unless LOCATION_PURGE_ENABLED=true. Periods are config values,
-- see backend/src/config/locationRetention.ts.
--
-- 1. profiles.location_updated_at: when the live location was last written.
--    New location writes set it. Existing rows stay NULL until the gated
--    worker backfills them from last_seen; until then the stale sweep falls
--    back to last_seen itself.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS location_updated_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_profiles_location_updated_at
  ON profiles (location_updated_at) WHERE lat IS NOT NULL OR location IS NOT NULL;

-- 2. Map feed and Community posts: coordinates can be removed after the post
--    expires (the text stays). Every read is inside the visible window, so a
--    NULL point is never read. Dropping NOT NULL changes no rows.
ALTER TABLE map_feed_messages ALTER COLUMN lat DROP NOT NULL;
ALTER TABLE map_feed_messages ALTER COLUMN lng DROP NOT NULL;
ALTER TABLE map_feed_messages ALTER COLUMN location DROP NOT NULL;
CREATE INDEX IF NOT EXISTS idx_map_feed_messages_coords_created
  ON map_feed_messages (created_at) WHERE location IS NOT NULL;

ALTER TABLE community_posts ALTER COLUMN lat DROP NOT NULL;
ALTER TABLE community_posts ALTER COLUMN lng DROP NOT NULL;
ALTER TABLE community_posts ALTER COLUMN location DROP NOT NULL;
CREATE INDEX IF NOT EXISTS idx_community_posts_coords_created
  ON community_posts (created_at) WHERE location IS NOT NULL;

-- 3. Optional check-in purge (CHECKIN_PURGE_ENABLED, default off) finds
--    ended check-ins by time.
CREATE INDEX IF NOT EXISTS idx_hot_spot_checkins_checked_in_at
  ON hot_spot_checkins (checked_in_at);

-- (rooms.created_by NULL fix moved to its own PR, migration 077.)
