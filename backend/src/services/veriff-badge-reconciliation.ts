/** Inventory only. Candidates still need a fresh authenticated Veriff decision.
 * Never infer adult assurance or create user/session links from these counts. */
export const badgeReconciliationInventorySql = `
SELECT
 COUNT(*) FILTER (WHERE s.status = 'approved' AND s.decision_code = '9001'
   AND NOT COALESCE(u.is_verified AND u.verification_provider = 'veriff' AND u.verification_status = 'verified', FALSE))::int AS approval_recheck_candidates,
 COUNT(*) FILTER (WHERE s.status = 'approved' AND s.decision_code IS DISTINCT FROM '9001')::int AS approval_missing_valid_code,
 COUNT(*) FILTER (WHERE s.status IN ('created','started','submitted','review','resubmission_requested'))::int AS pending_checks,
 COUNT(*) FILTER (WHERE s.status IN ('declined','expired','abandoned'))::int AS ineligible_checks,
 COUNT(*) FILTER (WHERE s.id IS NULL AND COALESCE(u.is_verified,FALSE))::int AS unlinked_legacy_flags
FROM users u LEFT JOIN veriff_sessions s
 ON s.user_id=u.id AND s.id::text=u.verification_session_id`;
