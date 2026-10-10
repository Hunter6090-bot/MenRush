-- 033_room_temp_identity_ttl.sql
-- Soft TTL for saved room-scoped temporary identities (30 days inactivity).
-- Idempotent. Never touches users/profiles.

DO $$ BEGIN
  ALTER TABLE room_temp_identities
    ADD COLUMN last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Backfill any pre-TTL rows from updated_at if present.
UPDATE room_temp_identities
   SET last_used_at = COALESCE(last_used_at, updated_at, NOW())
 WHERE last_used_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_room_temp_identities_last_used
  ON room_temp_identities (last_used_at);

COMMENT ON COLUMN room_temp_identities.last_used_at IS
  'Last successful use/save of this room temp identity. Soft TTL purge after 30 days of inactivity.';
