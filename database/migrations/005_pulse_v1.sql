-- 005_pulse_v1.sql
-- Pulse v1 (per specs/pulse-spec.md)
--
-- Adds the canonical pulse-state columns to users. The earlier
-- 002_pulse_beacon.sql added profiles.available_until (the "beacon" model);
-- the v1 spec moves the source-of-truth onto users so we can:
--   1. include is_pulsing/pulse_expires_at in /api/users/nearby cheaply, and
--   2. enforce server-side cooldown via last_pulse_ended_at.
-- The legacy profiles.available_until column is left in place so the
-- existing /api/users/pulse/* legacy endpoints keep working until removed.
--
-- Idempotent: safe to run multiple times.

DO $$ BEGIN
  ALTER TABLE users ADD COLUMN is_pulsing BOOLEAN NOT NULL DEFAULT FALSE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE users ADD COLUMN pulse_started_at TIMESTAMPTZ;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE users ADD COLUMN pulse_expires_at TIMESTAMPTZ;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE users ADD COLUMN last_pulse_ended_at TIMESTAMPTZ;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Partial index used by:
--   - the 60s cron sweep:    WHERE is_pulsing = TRUE AND pulse_expires_at < NOW()
--   - the nearby query sort: ORDER BY is_pulsing DESC ...
CREATE INDEX IF NOT EXISTS idx_users_pulsing
  ON users (is_pulsing, pulse_expires_at)
  WHERE is_pulsing = TRUE;
