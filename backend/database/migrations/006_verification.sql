-- 006_verification.sql
-- Stripe Identity verification (per agents/stripe-identity-spec.md).
--
-- Adds gating columns to users so the app can enforce
-- "100% government-ID verified" before exposing other users.
--
-- Idempotent: safe to run multiple times.

DO $$ BEGIN
  ALTER TABLE users ADD COLUMN is_verified BOOLEAN NOT NULL DEFAULT FALSE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE users ADD COLUMN verification_status TEXT NOT NULL DEFAULT 'unverified';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE users ADD COLUMN verification_session_id TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE users ADD COLUMN verified_at TIMESTAMPTZ;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE users ADD COLUMN rejection_reason TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Constrain status to the four allowed values. Keep it a CHECK rather than
-- an enum so we can edit values without a hard schema migration.
DO $$ BEGIN
  ALTER TABLE users
    ADD CONSTRAINT users_verification_status_check
    CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN invalid_column_reference THEN NULL;
END $$;

-- Used for admin filtering ("show me all pending"/"all rejected") and for
-- the per-user lookup in the webhook handler.
CREATE INDEX IF NOT EXISTS idx_users_verification_status
  ON users (verification_status);

CREATE INDEX IF NOT EXISTS idx_users_verification_session_id
  ON users (verification_session_id)
  WHERE verification_session_id IS NOT NULL;
