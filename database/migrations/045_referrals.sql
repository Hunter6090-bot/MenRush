-- ─────────────────────────────────────────────────────────────────────────────
-- 045_referrals.sql
-- User referral codes + referral attribution / payout tracking.
--
-- Rules (product):
--   - Every user gets a stable unique referral_code (MR + 8 chars).
--   - Attribution only at signup; immutable; no self-referral.
--   - Counts toward the 3-for-1-month Premium unlock only after
--     is_verified / verification_status = verified.
--   - Paid Premium upgrade records 20% as pending payout (no money send).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS referral_code TEXT;

-- Unique when present (lazy backfill for legacy rows).
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code
  ON users (referral_code)
  WHERE referral_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS referrals (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- pending → verified → credited (paid upgrade recorded; payout still pending)
  status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'verified', 'credited')),
  payout_amount     NUMERIC(12, 2) NOT NULL DEFAULT 0,
  -- none | pending (owed, not sent) | paid (future — never auto-set here)
  payout_status     TEXT NOT NULL DEFAULT 'none'
                      CHECK (payout_status IN ('none', 'pending', 'paid')),
  payment_amount    NUMERIC(12, 2),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at       TIMESTAMPTZ,
  credited_at       TIMESTAMPTZ,
  CONSTRAINT referrals_no_self CHECK (referrer_id <> referred_user_id),
  CONSTRAINT referrals_referred_unique UNIQUE (referred_user_id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer_status
  ON referrals (referrer_id, status);

CREATE INDEX IF NOT EXISTS idx_referrals_payout_pending
  ON referrals (referrer_id)
  WHERE payout_status = 'pending';

-- One row per unlock milestone (every 3 verified referrals → 1 month Premium).
CREATE TABLE IF NOT EXISTS referral_premium_grants (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  milestone                INT NOT NULL CHECK (milestone >= 1),
  verified_count_at_grant  INT NOT NULL,
  months_granted           INT NOT NULL DEFAULT 1,
  granted_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT referral_premium_grants_user_milestone UNIQUE (user_id, milestone)
);

CREATE INDEX IF NOT EXISTS idx_referral_premium_grants_user
  ON referral_premium_grants (user_id);
