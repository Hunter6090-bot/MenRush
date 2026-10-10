-- One-time 2FA pending tokens. Only a SHA-256 of the jti (or token) is stored.
CREATE TABLE IF NOT EXISTS two_factor_pending_used (
  jti_hash TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  consumed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_two_factor_pending_used_expires
  ON two_factor_pending_used (expires_at);
