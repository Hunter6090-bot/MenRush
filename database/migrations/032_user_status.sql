-- 032_user_status.sql
-- MenRush 2.0 §25 Status — structured, lightweight discovery signal.
-- Completely separate from Pulse (users.is_pulsing) and Mood (profiles.mood).
-- Idempotent: safe to run multiple times.

DO $$ BEGIN
  ALTER TABLE profiles ADD COLUMN status TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE profiles ADD COLUMN status_expires_at TIMESTAMPTZ;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Active statuses for nearby filter / sort. Expired rows are ignored at read time.
CREATE INDEX IF NOT EXISTS idx_profiles_status_active
  ON profiles (status, status_expires_at)
  WHERE status IS NOT NULL AND status_expires_at IS NOT NULL;

COMMENT ON COLUMN profiles.status IS
  'MenRush Status (§25): structured availability signal; independent of Pulse/Mood.';
COMMENT ON COLUMN profiles.status_expires_at IS
  'When the active Status expires; NULL means unset/cleared.';
