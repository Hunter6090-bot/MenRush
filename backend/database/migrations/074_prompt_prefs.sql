-- "Don't remind me again" follows the member across devices (Al, 10 Oct 2026).
-- Shape: { "<prompt>": "never" } where <prompt> is one of install, alerts, profile
-- (allowlist enforced in the API, not here). Additive and safe to re-run.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS prompt_prefs JSONB NOT NULL DEFAULT '{}'::jsonb;
