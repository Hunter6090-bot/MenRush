-- 038_pride_waitlist_invite_premium.sql
-- Attach 3-month-from-launch Premium to the usual beta invite (MENRUSH-XXXX)
-- for the /pride waitlist path. Does NOT invent a second Pride promo code family.

ALTER TABLE beta_invite_codes
  ADD COLUMN IF NOT EXISTS premium_months_from_launch INT,
  ADD COLUMN IF NOT EXISTS issued_to_email TEXT,
  ADD COLUMN IF NOT EXISTS issued_to_email_hash TEXT,
  ADD COLUMN IF NOT EXISTS campaign TEXT;

-- One active Pride-waitlist invite per email (campaign = pride26).
CREATE UNIQUE INDEX IF NOT EXISTS idx_beta_invite_email_campaign
  ON beta_invite_codes (issued_to_email_hash, campaign)
  WHERE issued_to_email_hash IS NOT NULL
    AND campaign IS NOT NULL
    AND revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_beta_invite_campaign
  ON beta_invite_codes (campaign)
  WHERE campaign IS NOT NULL;
