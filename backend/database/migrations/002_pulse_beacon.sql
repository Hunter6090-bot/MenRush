-- Pulse: a 90-minute "I'm around right now" beacon.
-- When available_until > NOW(), the user is on Pulse and surfaces on the live map.

DO $$ BEGIN
  ALTER TABLE profiles ADD COLUMN available_until TIMESTAMPTZ;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_available_until ON profiles(available_until)
  WHERE available_until IS NOT NULL;
