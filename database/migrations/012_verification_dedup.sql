-- 012_verification_dedup.sql
-- Provider-agnostic verification audit + one-account-per-document dedup.
-- Stores hashed document fingerprints only — never raw ID images or numbers.
-- Idempotent: safe to run multiple times.

DO $$ BEGIN
  ALTER TABLE users ADD COLUMN verification_provider VARCHAR(30);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS verification_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(30) NOT NULL,
  document_fingerprint TEXT NOT NULL,
  issuing_country VARCHAR(3),
  document_type VARCHAR(30),
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (document_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_verification_identities_user
  ON verification_identities(user_id);

CREATE INDEX IF NOT EXISTS idx_users_verification_provider
  ON users(verification_provider)
  WHERE verification_provider IS NOT NULL;