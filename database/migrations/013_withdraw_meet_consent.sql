-- Withdraw media + mutual meet consent (idempotent).

DO $$ BEGIN
  ALTER TABLE messages ADD COLUMN withdrawn_at TIMESTAMPTZ;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_messages_withdrawn ON messages(withdrawn_at) WHERE withdrawn_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS meet_agreements (
  user_a UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_a_confirmed_at TIMESTAMPTZ,
  user_b_confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_a, user_b),
  CHECK (user_a <> user_b)
);

CREATE INDEX IF NOT EXISTS idx_meet_agreements_user_a ON meet_agreements(user_a);
CREATE INDEX IF NOT EXISTS idx_meet_agreements_user_b ON meet_agreements(user_b);
