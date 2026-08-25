-- 037_brightonpride_restore_redeem_by_31_oct.sql
-- Live Brighton Pride offer: personal emailed codes redeem by 31 October 2026.
-- Restores expiry if migration 035 shortened unredeemed rows to 5 September.

UPDATE promo_codes
SET expires_at = TIMESTAMPTZ '2026-10-31 23:59:59+00'
WHERE campaign = 'brightonpride26'
  AND redeemed_at IS NULL;
