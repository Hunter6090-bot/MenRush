-- 036_shared_promo_redemptions.sql
-- One-redemption-per-user tracking for public shared promos (e.g. Pride QR).
-- Separate from email-locked promo_codes used by /brightonpride.

CREATE TABLE IF NOT EXISTS shared_promo_redemptions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign        TEXT        NOT NULL,
  code_normalized TEXT        NOT NULL,
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email_hash      TEXT        NOT NULL,
  redeemed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT shared_promo_redemptions_user_unique UNIQUE (campaign, user_id),
  CONSTRAINT shared_promo_redemptions_email_unique UNIQUE (campaign, email_hash)
);

CREATE INDEX IF NOT EXISTS idx_shared_promo_redemptions_campaign
  ON shared_promo_redemptions(campaign);
