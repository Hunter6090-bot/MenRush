-- 025_layered_verification.sql
-- Separate adult assurance, live-person authenticity, and government-ID identity checks.
-- The legacy users.is_verified flag remains the compatibility signal for the
-- strongest (identity_checked) tier.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS age_assurance_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS age_assured_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS authenticity_status TEXT NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS authenticity_verified_at TIMESTAMPTZ;

ALTER TABLE verification_submissions
  ADD COLUMN IF NOT EXISTS sensitive_files_deleted_at TIMESTAMPTZ;

DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT users_age_assurance_status_check
    CHECK (age_assurance_status IN ('pending', 'self_attested', 'confirmed', 'failed'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT users_authenticity_status_check
    CHECK (authenticity_status IN ('unverified', 'pending', 'verified', 'rejected'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Existing DOB/age entry is recorded honestly. It is not promoted to the
-- legally stronger "confirmed" state without a real age-assurance check.
UPDATE users
SET age_assurance_status = 'self_attested'
WHERE age >= 18 AND age_assurance_status = 'pending';

CREATE TABLE IF NOT EXISTS authenticity_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  prompts JSONB NOT NULL,
  frame_keys TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'issued'
    CHECK (status IN ('issued', 'pending', 'approved', 'rejected', 'expired')),
  rejection_reason TEXT,
  reviewed_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ
);

ALTER TABLE authenticity_challenges
  ADD COLUMN IF NOT EXISTS sensitive_files_deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_authenticity_challenges_user
  ON authenticity_challenges(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_authenticity_challenges_pending
  ON authenticity_challenges(status, submitted_at)
  WHERE status = 'pending';
