-- Mirror of database/migrations/030 for backend migrate path.
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

CREATE TABLE IF NOT EXISTS room_temp_identities (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL CHECK (char_length(trim(display_name)) BETWEEN 1 AND 40),
  photo_url TEXT,
  save_name BOOLEAN NOT NULL DEFAULT FALSE,
  save_photo BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, room_id)
);

ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS is_official BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS theme_slug TEXT;

CREATE INDEX IF NOT EXISTS idx_rooms_official
  ON rooms (is_official) WHERE is_official = TRUE;
