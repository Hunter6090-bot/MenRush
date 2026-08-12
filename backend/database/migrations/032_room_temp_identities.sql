-- 032_room_temp_identities.sql
-- Temporary identity inside a specific group/room (MenRush product: Temporary Identity on Group Entry).
-- Never written to users / profiles. Independent of Premium verification axis.
-- Idempotent.

CREATE TABLE IF NOT EXISTS room_temp_identities (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  display_name TEXT
    CHECK (display_name IS NULL OR char_length(trim(display_name)) BETWEEN 1 AND 40),
  photo_url TEXT,
  save_name BOOLEAN NOT NULL DEFAULT FALSE,
  save_photo BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, room_id)
);

COMMENT ON TABLE room_temp_identities IS
  'Per-room temporary display name/photo. Never mutates main profile. Cleared on leave unless save_* flags.';
