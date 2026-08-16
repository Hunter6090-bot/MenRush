-- 031_adult_assurance_sessions.sql
-- Adult Assurance attempt ledger (issue #50).
--
-- Privacy / data minimisation:
--   - Stores session operational state only (ids, provider name, status, timestamps).
--   - Never stores DOB, government ID numbers, selfies, or raw provider payloads.
--   - users.age_assurance_status / age_assured_at remain the only durable member fields.
--
-- Enforcement itself is application middleware (ON by default). This table supports
-- start/retry/complete flows and audit without expanding the PII surface.

CREATE TABLE IF NOT EXISTS adult_assurance_sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'failed', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_adult_assurance_sessions_user
  ON adult_assurance_sessions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_adult_assurance_sessions_pending
  ON adult_assurance_sessions(status, expires_at)
  WHERE status = 'pending';
