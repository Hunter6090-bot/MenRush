-- Migration 064: MenRush launch ad campaign promo code MR3FREE.
-- Code: MR3FREE (accept mr3free; case-insensitive, no spaces).
-- Campaign: MenRush launch.
-- Live from 17 September 2026 until 23:59 Europe/London on 5 October 2026.
-- Valid registrations receive 3 months of Premium free, unlocked from day one.
-- One use per account. Stored in shared_promo_redemptions.

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
