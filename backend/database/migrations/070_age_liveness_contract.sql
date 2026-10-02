-- No historical approvals are upgraded: a new hosted session is required.
ALTER TABLE adult_assurance_sessions ADD COLUMN IF NOT EXISTS liveness_contract text;
DROP INDEX IF EXISTS adult_assurance_redeemed_evidence_idx;
CREATE INDEX adult_assurance_redeemed_evidence_idx
  ON adult_assurance_sessions (redeemed_user_id)
  WHERE evidence_version = 2 AND status = 'passed' AND NOT is_fixture AND liveness_contract IS NOT NULL;
COMMENT ON COLUMN users.verified_age_18_plus IS
  'Access also requires redeemed version 2 age evidence from an integration with a reviewed liveness contract. Optional ID is separate.';
