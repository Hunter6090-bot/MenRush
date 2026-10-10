-- Per-type unsubscribe token versions. Bumped on one-click opt-out for that
-- type only, so a messages unsub does not revoke the matches or jerks links.
SET LOCAL lock_timeout = '5s';

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_unsub_version_message INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS email_unsub_version_match INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS email_unsub_version_jerk INTEGER NOT NULL DEFAULT 1;

ALTER TABLE users DROP COLUMN IF EXISTS email_unsub_version;
