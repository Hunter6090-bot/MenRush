-- Live location sharing with mutual matches (opt-out via toggle; default on).
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS share_live_location_with_matches BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_profiles_match_live_location
  ON profiles (share_live_location_with_matches)
  WHERE share_live_location_with_matches = TRUE;