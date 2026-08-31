-- Veriff identity sessions (ID + selfie). Decision webhook is the source of truth
-- for is_verified / Identity checked badge — never trust the client SDK alone.
CREATE TABLE IF NOT EXISTS veriff_sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_url TEXT,
  status TEXT NOT NULL DEFAULT 'created'
    CHECK (status IN (
      'created',
      'submitted',
      'approved',
      'declined',
      'resubmission_requested',
      'expired',
      'abandoned',
      'review'
    )),
  decision_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_veriff_sessions_user_id ON veriff_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_veriff_sessions_status ON veriff_sessions (status);

COMMENT ON TABLE veriff_sessions IS 'Maps Veriff session ids to MenRush users for decision webhooks.';
