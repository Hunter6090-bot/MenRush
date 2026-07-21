-- ─────────────────────────────────────────────────────────────────────────────
-- 028_promo_codes.sql
-- Email-locked promotional codes for campaign signups.
--
-- Security model:
--   A code is only redeemable with the exact email it was issued to.
--   Sharing or selling the code is useless because the redemption check
--   is: WHERE code = $1 AND email_hash = sha256($2) AND redeemed_at IS NULL.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS promo_codes (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code            TEXT        NOT NULL UNIQUE,          -- e.g. PRIDE-A3F7B2C1
  email           TEXT        NOT NULL,                 -- plain email for sending
  email_hash      TEXT        NOT NULL,                 -- sha256(lower(email)) for redemption lookup
  campaign        TEXT        NOT NULL DEFAULT 'general', -- e.g. 'brightonpride26'
  months_free     INT         NOT NULL DEFAULT 3,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ,                          -- NULL = never expires
  redeemed_at     TIMESTAMPTZ,
  redeemed_by     UUID        REFERENCES users(id) ON DELETE SET NULL
);

-- Fast lookup by code (redemption path)
CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code);

-- Fast lookup by email_hash (prevent duplicate issuance per campaign)
CREATE UNIQUE INDEX IF NOT EXISTS idx_promo_codes_email_campaign
  ON promo_codes(email_hash, campaign);

-- Admin reporting: codes by campaign
CREATE INDEX IF NOT EXISTS idx_promo_codes_campaign ON promo_codes(campaign);
