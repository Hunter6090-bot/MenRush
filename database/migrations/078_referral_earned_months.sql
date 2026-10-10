-- #355: earned referral months get their own explicit record so renewals,
-- cancellations and open-ended Premium never wipe or shorten them.
--   banked  = saved, not started (free Premium for everyone, open-ended Premium)
--   stacked = on top of an active paid subscription (moves with renewals)
--   applied = folded into a fixed premium_until (applied_until)
-- Existing rows already changed premium_until, so they are 'applied'.
ALTER TABLE referral_premium_grants
  ADD COLUMN IF NOT EXISTS state TEXT NOT NULL DEFAULT 'applied',
  ADD COLUMN IF NOT EXISTS applied_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS applied_until TIMESTAMPTZ;

DO $$
BEGIN
  ALTER TABLE referral_premium_grants
    ADD CONSTRAINT referral_premium_grants_state_chk
    CHECK (state IN ('banked', 'stacked', 'applied'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_referral_premium_grants_user_state
  ON referral_premium_grants (user_id, state);
CREATE INDEX IF NOT EXISTS idx_referral_premium_grants_user_granted
  ON referral_premium_grants (user_id, granted_at);
