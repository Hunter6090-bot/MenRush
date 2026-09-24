-- Provider-authenticated positive age evidence; no biometric material is stored.
-- Existing/self-attested/legacy approvals remain version 0 and must re-assure.
ALTER TABLE adult_assurance_sessions
  ADD COLUMN IF NOT EXISTS evidence_version smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS account_user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_fixture boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS adult_assurance_redeemed_evidence_idx
  ON adult_assurance_sessions (redeemed_user_id)
  WHERE evidence_version = 1 AND status = 'passed' AND NOT is_fixture;

COMMENT ON COLUMN users.verified_age_18_plus IS
  'Age flag only; access also requires redeemed evidence_version 1 age-estimation session. ID Verified is separate.';
