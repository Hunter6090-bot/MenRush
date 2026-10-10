-- Per-user unsubscribe token version. Bumped on one-click opt-out so a
-- leaked activity-mail token can be revoked without rotating JWT_SECRET.
SET LOCAL lock_timeout = '5s';

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_unsub_version INTEGER NOT NULL DEFAULT 1;
