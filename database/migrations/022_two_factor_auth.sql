-- TOTP two-factor authentication (authenticator app)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS totp_secret_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS totp_enabled_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_totp_enabled ON users (totp_enabled) WHERE totp_enabled = TRUE;