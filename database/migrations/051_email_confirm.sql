-- Email confirmation gate + welcome pack (Al / Brand signed 8 Sep 2026).
-- Existing accounts stay live (DEFAULT TRUE). New register rows set FALSE.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_confirmed BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS welcome_email_sent_at TIMESTAMP;

CREATE TABLE IF NOT EXISTS email_confirm_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_confirm_tokens_active
  ON email_confirm_tokens (token_hash)
  WHERE used_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_email_confirm_tokens_user
  ON email_confirm_tokens (user_id);
