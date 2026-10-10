-- 035_brightonpride_enter_by_finance_lock.sql
-- SUPERSEDED (Legal grandfather): do NOT shorten already-issued brightonpride26
-- codes to 5 September. Personal emailed codes keep redeem-by 31 October 2026.
-- See 037_brightonpride_restore_redeem_by_31_oct.sql.
-- This file is intentionally a no-op so environments that already applied the
-- old cut still recover via 037, and fresh applies never cut expiries.

SELECT 1;
