-- Live nearby map feed (ephemeral geo messages for Discover chat dock).
-- Room temp identities / official rooms already landed in 032–034 — do not recreate here.
CREATE TABLE IF NOT EXISTS map_feed_messages (
  id UUID PRIMARY KEY,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL CHECK (char_length(trim(message)) BETWEEN 1 AND 280),
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_map_feed_messages_location
  ON map_feed_messages USING GIST (location);

CREATE INDEX IF NOT EXISTS idx_map_feed_messages_created
  ON map_feed_messages (created_at DESC);
