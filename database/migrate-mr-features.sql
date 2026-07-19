-- migrate-mr-features.sql
--
-- MenRush feature pack: mood, ghost mode, private albums, After Hours events,
-- and message media (voice / disappearing) groundwork.
--
-- Idempotent: every statement uses IF NOT EXISTS, DO $$ EXCEPTION blocks, or
-- ON CONFLICT DO NOTHING. Safe to re-run.
--
-- Usage:
--   psql "$DATABASE_URL" -f database/migrate-mr-features.sql

-- ============================================================
-- profiles: mood + mood_set_at (auto-clear after 6h on read)
-- ============================================================

DO $$ BEGIN
  ALTER TABLE profiles ADD COLUMN mood TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE profiles ADD COLUMN mood_set_at TIMESTAMP;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Free-form for now; product-side enum lives in the frontend so we can ship new
-- moods without a migration. If needed, add a CHECK later.
CREATE INDEX IF NOT EXISTS idx_profiles_mood ON profiles(mood) WHERE mood IS NOT NULL;

-- ============================================================
-- profiles: ghost mode (premium — see-but-not-be-seen)
-- ============================================================

DO $$ BEGIN
  ALTER TABLE profiles ADD COLUMN is_ghost BOOLEAN NOT NULL DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_ghost ON profiles(is_ghost);

-- ============================================================
-- albums (private galleries)
-- ============================================================

CREATE TABLE IF NOT EXISTS albums (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        VARCHAR(80) NOT NULL,
  description TEXT,
  is_locked   BOOLEAN NOT NULL DEFAULT true,
  cover_url   TEXT,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_albums_user ON albums(user_id);

CREATE TABLE IF NOT EXISTS album_photos (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id   UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  photo_url  TEXT NOT NULL,
  position   INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_album_photos_album ON album_photos(album_id, position);
CREATE INDEX IF NOT EXISTS idx_album_photos_user ON album_photos(user_id);

-- Per-viewer grants (user A unlocks album X for user B)
CREATE TABLE IF NOT EXISTS album_grants (
  album_id    UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  viewer_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  granted_at  TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (album_id, viewer_id)
);

CREATE INDEX IF NOT EXISTS idx_album_grants_viewer ON album_grants(viewer_id);

-- ============================================================
-- rooms: After Hours event fields
-- ============================================================

DO $$ BEGIN
  ALTER TABLE rooms ADD COLUMN kind TEXT NOT NULL DEFAULT 'room';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
-- 'room' or 'event'; product-level enum.

DO $$ BEGIN
  ALTER TABLE rooms ADD COLUMN starts_at TIMESTAMP;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE rooms ADD COLUMN ends_at TIMESTAMP;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE rooms ADD COLUMN venue_name TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_rooms_kind_time ON rooms(kind, starts_at, ends_at);

-- ============================================================
-- messages: media (voice / disappearing) groundwork
-- ============================================================

DO $$ BEGIN
  ALTER TABLE messages ADD COLUMN media_type TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
-- Values: 'image' | 'voice' | NULL (text only).

DO $$ BEGIN
  ALTER TABLE messages ADD COLUMN media_url TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE messages ADD COLUMN audio_duration_ms INT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE messages ADD COLUMN expires_at TIMESTAMP;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
-- Disappearing-image / view-once: server hides + unlinks blob after this.

DO $$ BEGIN
  ALTER TABLE messages ADD COLUMN viewed_at TIMESTAMP;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
-- Set on first read for view-once media.

DO $$ BEGIN
  ALTER TABLE messages ADD COLUMN is_disappearing BOOLEAN NOT NULL DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_messages_expires ON messages(expires_at) WHERE expires_at IS NOT NULL;

-- ============================================================
-- moderation: blocks + reports (defensive — may already exist)
-- ============================================================

CREATE TABLE IF NOT EXISTS blocks (
  blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON blocks(blocked_id);

CREATE TABLE IF NOT EXISTS reports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reported_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  message_id   UUID REFERENCES messages(id) ON DELETE SET NULL,
  reason       TEXT NOT NULL,
  details      TEXT,
  created_at   TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_reported ON reports(reported_id);
CREATE INDEX IF NOT EXISTS idx_reports_message ON reports(message_id);

-- ============================================================
-- waitlist (defensive — server.ts inserts into it)
-- ============================================================

CREATE TABLE IF NOT EXISTS waitlist (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
