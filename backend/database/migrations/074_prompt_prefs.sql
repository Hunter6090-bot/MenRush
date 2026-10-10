-- "Don't show again" follows the member across devices (Al, 10 Oct 2026).
-- Shape: { "<prompt>": "never" } where <prompt> is one of install, alerts, profile
-- (allowlist enforced in the API, not here). Additive and safe to re-run.
--
-- ADD COLUMN with a constant default is metadata-only on PG 11+, but it still
-- needs a brief ACCESS EXCLUSIVE lock on users. Give up after 5s rather than
-- queue behind a long transaction and block every login behind us. The migrate
-- script wraps each file in a transaction, so SET LOCAL ends with it.
SET LOCAL lock_timeout = '5s';

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS prompt_prefs JSONB NOT NULL DEFAULT '{}'::jsonb;
