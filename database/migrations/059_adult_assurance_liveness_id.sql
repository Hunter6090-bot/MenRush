-- Adult assurance dual-path (Al 2026-09-12 / #97):
-- Required: Veriff liveness / age-estimation selfie → verified_age_18_plus
-- Optional: Veriff ID document during same signup → Verified tick (is_verified)
-- Never store ID images, DOB, or document numbers on our side.

COMMENT ON COLUMN users.verified_age_18_plus IS
  'True after signup Veriff liveness / age-estimation proves 18+ (or later identity DOB adult). Self-attested DOB never sets this. Not the Verified badge.';

ALTER TABLE adult_assurance_sessions
  ADD COLUMN IF NOT EXISTS check_kind TEXT NOT NULL DEFAULT 'liveness',
  ADD COLUMN IF NOT EXISTS parent_session_id UUID REFERENCES adult_assurance_sessions(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS id_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS id_session_id UUID;

-- Existing rows are liveness (document-DOB era sessions treated as age gate).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'adult_assurance_sessions_check_kind_check'
  ) THEN
    ALTER TABLE adult_assurance_sessions
      ADD CONSTRAINT adult_assurance_sessions_check_kind_check
      CHECK (check_kind IN ('liveness', 'id'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_adult_assurance_sessions_parent
  ON adult_assurance_sessions (parent_session_id)
  WHERE parent_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_adult_assurance_sessions_id_session
  ON adult_assurance_sessions (id_session_id)
  WHERE id_session_id IS NOT NULL;

COMMENT ON COLUMN adult_assurance_sessions.check_kind IS
  'liveness = required selfie / age-estimation gate; id = optional document session for Verified tick.';
COMMENT ON COLUMN adult_assurance_sessions.id_verified IS
  'True when optional ID check approved for this liveness parent session. Never stores document PII.';
COMMENT ON TABLE adult_assurance_sessions IS
  'Pre-signup Veriff sessions. Store session id + outcome only — never DOB, ID images, name, email, or document numbers.';
