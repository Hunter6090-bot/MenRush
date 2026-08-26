-- Pride-flagged beta invites (21–31 Aug 2026 /pride): one MENRUSH code =
-- beta access + booked 3-month Premium from launch. Not a second code family.

ALTER TABLE beta_invite_codes
  ADD COLUMN IF NOT EXISTS pride_months_free INT
    CHECK (pride_months_free IS NULL OR pride_months_free > 0),
  ADD COLUMN IF NOT EXISTS issued_email TEXT;

CREATE INDEX IF NOT EXISTS idx_beta_invite_codes_pride_email
  ON beta_invite_codes (LOWER(issued_email))
  WHERE issued_email IS NOT NULL AND pride_months_free IS NOT NULL;

-- Booked Pride / launch-gated Premium: entitlement clocks from this moment.
-- Null = legacy / paid / immediately active when is_premium.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS premium_starts_at TIMESTAMPTZ;
