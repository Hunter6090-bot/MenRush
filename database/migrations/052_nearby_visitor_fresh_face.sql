-- Nearby visitor fresh-face boost (Zoul / owner lock Sep 2026).
-- Honest dwell: seed home from first GPS; leave home radius → visitor window with TTL.
-- Never invent users. Home coords never leave this table to other clients.

-- Home area (private — not exposed on /users/nearby).
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS home_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS home_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS home_set_at TIMESTAMPTZ;

-- Active visit into a non-home cell/town.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS visitor_since TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS visitor_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS visitor_anchor_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS visitor_anchor_lng DOUBLE PRECISION;

COMMENT ON COLUMN profiles.home_lat IS 'Inferred home latitude (first dwell / private). Never returned to other users.';
COMMENT ON COLUMN profiles.visitor_expires_at IS 'Nearby fresh-face boost ends at this time (VISITOR_TTL_HOURS).';

CREATE INDEX IF NOT EXISTS idx_profiles_visitor_active
  ON profiles (visitor_expires_at)
  WHERE visitor_expires_at IS NOT NULL;
