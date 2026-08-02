-- 014_native_verification.sql
-- In-house ID + selfie verification (replaces Stripe Identity).
-- Stores private file keys only — images are never served publicly.

CREATE TABLE IF NOT EXISTS verification_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id_front_key TEXT NOT NULL,
  selfie_key TEXT NOT NULL,
  face_match_distance NUMERIC,
  face_match_passed BOOLEAN,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  reviewed_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_verification_submissions_user
  ON verification_submissions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_verification_submissions_pending
  ON verification_submissions(status, created_at DESC)
  WHERE status = 'pending';