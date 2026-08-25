-- Community text posts, SENTINEL safety queue, nightlife venue check-ins.

CREATE TABLE IF NOT EXISTS community_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT community_posts_body_len CHECK (char_length(body) BETWEEN 1 AND 280)
);

CREATE INDEX IF NOT EXISTS idx_community_posts_created
  ON community_posts (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_community_posts_location
  ON community_posts USING GIST ((ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography))
  WHERE lat IS NOT NULL AND lng IS NOT NULL;

ALTER TABLE reports
  ALTER COLUMN reported_id DROP NOT NULL;

ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS conversation_id TEXT,
  ADD COLUMN IF NOT EXISTS room_id UUID,
  ADD COLUMN IF NOT EXISTS source VARCHAR(40) NOT NULL DEFAULT 'profile';

CREATE TABLE IF NOT EXISTS sentinel_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reported_id UUID REFERENCES users(id) ON DELETE SET NULL,
  conversation_id TEXT,
  room_id UUID,
  source VARCHAR(40) NOT NULL,
  reason VARCHAR(50) NOT NULL,
  details TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (status IN ('open', 'reviewing', 'actioned', 'dismissed'))
);

CREATE INDEX IF NOT EXISTS idx_sentinel_queue_status
  ON sentinel_queue (status, created_at DESC)
  WHERE status <> 'dismissed';

CREATE INDEX IF NOT EXISTS idx_sentinel_queue_created
  ON sentinel_queue (created_at DESC);

INSERT INTO hot_spot_categories (slug, name, icon, description, sort_order)
VALUES ('nightlife', 'Nightlife', '🪩', 'Clubs, bars and live events', 7)
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE hot_spots
  ADD COLUMN IF NOT EXISTS event_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS idx_hot_spots_event
  ON hot_spots (event_id)
  WHERE event_id IS NOT NULL;
