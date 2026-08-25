-- 039_community_posts.sql
-- Community Space: short local text posts (≤280 chars), free for all.
-- Complements Rooms (video); no media columns on this table.
-- Idempotent: safe to run multiple times.

CREATE TABLE IF NOT EXISTS community_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body VARCHAR(280) NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT community_posts_body_len CHECK (char_length(trim(body)) >= 1 AND char_length(body) <= 280)
);

CREATE INDEX IF NOT EXISTS idx_community_posts_location
  ON community_posts USING GIST (location);

CREATE INDEX IF NOT EXISTS idx_community_posts_created
  ON community_posts (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_community_posts_user_created
  ON community_posts (user_id, created_at DESC);
