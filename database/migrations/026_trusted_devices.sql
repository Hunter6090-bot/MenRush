-- Trusted devices for skipping 2FA on known browsers (30-day expiry)
CREATE TABLE IF NOT EXISTS trusted_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL,
  label TEXT,
  user_agent TEXT,
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT trusted_devices_token_hash_unique UNIQUE (token_hash)
);

CREATE INDEX IF NOT EXISTS idx_trusted_devices_user_active
  ON trusted_devices (user_id)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_trusted_devices_lookup
  ON trusted_devices (user_id, token_hash)
  WHERE revoked_at IS NULL;
