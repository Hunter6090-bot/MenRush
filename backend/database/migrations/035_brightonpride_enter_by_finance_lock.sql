-- 035_brightonpride_enter_by_finance_lock.sql
-- Finance lock (current spec): Pride personal codes must be entered by
-- 5 September 2026. Benefit still clocks from 1 October 2026 (90 days).
-- Align unredeemed brightonpride26 rows issued under the old 31 Oct expiry.

UPDATE promo_codes
SET expires_at = TIMESTAMPTZ '2026-09-05 23:59:59+00'
WHERE campaign = 'brightonpride26'
  AND redeemed_at IS NULL
  AND (expires_at IS NULL OR expires_at > TIMESTAMPTZ '2026-09-05 23:59:59+00');
