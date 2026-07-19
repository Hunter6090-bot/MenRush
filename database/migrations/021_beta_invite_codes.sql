-- Beta invite codes gate registration during closed beta.

CREATE TABLE IF NOT EXISTS beta_invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  code_normalized TEXT NOT NULL UNIQUE,
  max_uses INT NOT NULL DEFAULT 1 CHECK (max_uses > 0),
  use_count INT NOT NULL DEFAULT 0 CHECK (use_count >= 0),
  expires_at TIMESTAMPTZ,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  CHECK (use_count <= max_uses)
);

CREATE INDEX IF NOT EXISTS idx_beta_invite_codes_normalized
  ON beta_invite_codes (code_normalized);

CREATE TABLE IF NOT EXISTS beta_invite_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_code_id UUID NOT NULL REFERENCES beta_invite_codes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (invite_code_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_beta_invite_redemptions_user
  ON beta_invite_redemptions (user_id);
