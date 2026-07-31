-- 030_adult_assurance_enforcement.sql
-- Mandatory adult-assurance enforcement configuration (issue #50).
--
-- enforcement_started_at is fixed the first time this migration runs
-- (i.e. at deploy time) and is NOT recomputed on every process restart.
-- It is the cutover point that separates "existing" accounts, who receive
-- a grace period to complete Adult Assurance, from "new" accounts created
-- after cutover, who must complete Adult Assurance immediately.
--
-- grace_period_days is configurable by updating this row; it is read at
-- request time, not baked into application code.

CREATE TABLE IF NOT EXISTS adult_assurance_config (
    singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton IS TRUE),
    enforcement_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    grace_period_days INT NOT NULL DEFAULT 14 CHECK (grace_period_days >= 0)
  );

INSERT INTO adult_assurance_config (singleton)
VALUES (TRUE)
ON CONFLICT (singleton) DO NOTHING;
