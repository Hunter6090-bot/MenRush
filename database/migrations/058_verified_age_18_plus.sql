-- Adult assurance via Veriff liveness / age-estimation at signup (UK 18+ lock).
-- verified_age_18_plus is set after liveness pass (or later identity adult DOB).
-- adult_assurance_sessions hold pre-account Veriff sessions — no DOB/PII stored.
-- See also 059_adult_assurance_liveness_id.sql for optional ID → Verified tick.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS verified_age_18_plus BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN users.verified_age_18_plus IS
  'True after Veriff liveness / age-estimation proves 18+ (or later identity DOB adult). Self-attested DOB never sets this. Not the Verified badge.';

CREATE TABLE IF NOT EXISTS adult_assurance_sessions (
  id UUID PRIMARY KEY,
  session_url TEXT,
  status TEXT NOT NULL DEFAULT 'created'
    CHECK (status IN (
      'created',
      'started',
      'submitted',
      'passed',
      'underage',
      'declined',
      'resubmission_requested',
      'expired',
      'abandoned',
      'review',
      'failed'
    )),
  -- One-time redeem token (hashed). Issued only when status = passed. Never store DOB.
  assurance_token_hash TEXT,
  token_expires_at TIMESTAMPTZ,
  redeemed_at TIMESTAMPTZ,
  redeemed_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  decision_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_adult_assurance_sessions_status
  ON adult_assurance_sessions (status, created_at DESC);

COMMENT ON TABLE adult_assurance_sessions IS
  'Pre-signup Veriff age-assurance sessions. Store session id + outcome only — never DOB, name, email, or document numbers for rejected underage attempts.';
