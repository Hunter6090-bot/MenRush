-- Location retention (draft, periods TBD pending Legal / Al).
-- Schema only: the purge itself runs from the app (location-retention worker),
-- which is OFF unless LOCATION_PURGE_ENABLED=true. Periods are config values,
-- see backend/src/config/locationRetention.ts.
--
-- 1. profiles.location_updated_at: when the live location was last written.
--    The stale-location sweep clears lat/lng/location after
--    LOCATION_LIVE_STALE_DAYS without an update. Backfilled from last_seen,
--    which every location write also sets, so it is never earlier than the
--    real last fix.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS location_updated_at TIMESTAMPTZ;
UPDATE profiles
   SET location_updated_at = COALESCE(last_seen, updated_at, NOW())
 WHERE location_updated_at IS NULL
   AND (lat IS NOT NULL OR location IS NOT NULL);
ALTER TABLE profiles ALTER COLUMN location_updated_at SET DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_profiles_location_updated_at
  ON profiles (location_updated_at) WHERE lat IS NOT NULL OR location IS NOT NULL;

-- 2. Home and visit anchor at about 1 km (2 decimal places). Their only reader
--    is the visitor fresh-face check, which works at a 40 km radius.
--    Backfill of existing rows; new writes are rounded in userService.updateLocation.
UPDATE profiles
   SET home_lat = ROUND(home_lat::numeric, 2)::double precision,
       home_lng = ROUND(home_lng::numeric, 2)::double precision
 WHERE home_lat IS NOT NULL
   AND (home_lat <> ROUND(home_lat::numeric, 2)::double precision
        OR home_lng <> ROUND(home_lng::numeric, 2)::double precision);
UPDATE profiles
   SET visitor_anchor_lat = ROUND(visitor_anchor_lat::numeric, 2)::double precision,
       visitor_anchor_lng = ROUND(visitor_anchor_lng::numeric, 2)::double precision
 WHERE visitor_anchor_lat IS NOT NULL
   AND (visitor_anchor_lat <> ROUND(visitor_anchor_lat::numeric, 2)::double precision
        OR visitor_anchor_lng <> ROUND(visitor_anchor_lng::numeric, 2)::double precision);

-- 3. Map feed and Community posts: coordinates can be removed after the post
--    expires (the text stays). Every read is inside the visible window, so a
--    NULL point is never read.
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

-- 4. Account deletion: rooms.created_by is ON DELETE SET NULL but NOT NULL, so
--    deleting any member who ever created a room failed. Allow NULL (the FK
--    already intends it); deleteAccount clears the location of their own rooms.
ALTER TABLE rooms ALTER COLUMN created_by DROP NOT NULL;
