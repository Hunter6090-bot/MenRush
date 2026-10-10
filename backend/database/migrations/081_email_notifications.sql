-- Email notification prefs + hourly send log (draft; live send is env-gated).
-- Separate from users.prompt_prefs (074): that JSONB is { "<prompt>": "never" }
-- for in-app banners. These are three server-saved mail ticks, all on by default.
--
-- ADD COLUMN with a constant default is metadata-only on PG 11+, but it still
-- needs a brief ACCESS EXCLUSIVE lock on users. Give up after 5s rather than
-- queue behind a long transaction. The migrate script wraps each file in a
-- transaction, so SET LOCAL ends with it.
SET LOCAL lock_timeout = '5s';

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_notify_messages BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS email_notify_matches BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS email_notify_jerks BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS email_notification_sends (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notify_type TEXT NOT NULL CHECK (notify_type IN ('message', 'match', 'jerk')),
  hour_slot TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, notify_type, hour_slot)
);

CREATE INDEX IF NOT EXISTS idx_email_notification_sends_slot
  ON email_notification_sends (hour_slot);
