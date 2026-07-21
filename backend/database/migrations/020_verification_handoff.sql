-- 020_verification_handoff.sql
-- Short-lived sessions for scanning ID documents on a phone while verifying on desktop.

CREATE TABLE IF NOT EXISTS verification_handoff_sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting', 'doc_captured', 'consumed', 'expired')),
  nationality TEXT NOT NULL,
  id_type TEXT NOT NULL CHECK (id_type IN ('passport', 'driving_license')),
  id_front_key TEXT,
  id_back_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  captured_at TIMESTAMPTZ,
  consumed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_verification_handoff_user
  ON verification_handoff_sessions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_verification_handoff_status
  ON verification_handoff_sessions(status, expires_at);
