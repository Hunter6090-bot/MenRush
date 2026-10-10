-- 084_report_evidence_retention.sql
-- Follow-up to 079 (reports survive when the reported member deletes).
--
-- 1. Snapshot of the reported messages/media at report time (report_evidence).
--    Chats still cascade with the account; only this copy remains. Rows go
--    when the report is deleted (ON DELETE CASCADE).
-- 2. Reporter deletes their account: keep the report, null reporter_id and
--    stamp reporter_account_deleted_at, except while the case is open/reviewing
--    or legal_hold — then the reporter_id link is kept until close/release.
-- 3. closed_at + legal_hold for the gated retention purge
--    (REPORT_PURGE_ENABLED, default off; REPORT_RETENTION_MONTHS, default 12).
--
-- Idempotent. The runner wraps this file in one transaction. Give up after 5 s
-- instead of queueing behind a long-held lock on reports/users.
SET LOCAL lock_timeout = '5s';

ALTER TABLE reports ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS legal_hold BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS reporter_account_deleted_at TIMESTAMPTZ;

UPDATE reports
   SET closed_at = resolved_at
 WHERE closed_at IS NULL
   AND resolved_at IS NOT NULL
   AND status IN ('actioned', 'dismissed');

ALTER TABLE reports ALTER COLUMN reporter_id DROP NOT NULL;

-- reporter_id must be able to survive user deletion on open / legal_hold cases,
-- so this FK cannot be ON DELETE SET NULL or CASCADE. Integrity for live
-- reporters is enforced in application code; the delete trigger decides
-- whether to keep or null the id.
DO $$
DECLARE
  con RECORD;
BEGIN
  FOR con IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
    WHERE c.conrelid = 'reports'::regclass
      AND c.contype = 'f'
      AND a.attname = 'reporter_id'
  LOOP
    EXECUTE format('ALTER TABLE reports DROP CONSTRAINT %I', con.conname);
  END LOOP;
END $$;

CREATE TABLE IF NOT EXISTS report_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('message', 'room_message')),
  body TEXT,
  media_type TEXT,
  media_ref TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_evidence_report
  ON report_evidence (report_id);

CREATE INDEX IF NOT EXISTS idx_reports_purge_closed
  ON reports (closed_at)
  WHERE status IN ('actioned', 'dismissed') AND legal_hold = FALSE;

-- Combined BEFORE DELETE: stamp both sides; keep reporter_id only while the
-- case is still open/reviewing or on legal hold.
CREATE OR REPLACE FUNCTION reports_on_account_delete() RETURNS trigger AS $$
BEGIN
  -- Null reported_id here. A BEFORE DELETE UPDATE of the referencing row
  -- makes Postgres skip the FK ON DELETE SET NULL, and a later reporter
  -- update would then fail the FK against the already-deleted user.
  UPDATE reports
     SET reported_account_deleted_at = COALESCE(reported_account_deleted_at, NOW()),
         reported_id = NULL
   WHERE reported_id = OLD.id;

  UPDATE reports
     SET reporter_account_deleted_at = COALESCE(reporter_account_deleted_at, NOW()),
         reporter_id = CASE
           WHEN legal_hold OR status IN ('open', 'reviewing') THEN reporter_id
           ELSE NULL
         END
   WHERE reporter_id = OLD.id;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_reports_mark_reported_deleted ON users;
DROP TRIGGER IF EXISTS trg_reports_on_account_delete ON users;
CREATE TRIGGER trg_reports_on_account_delete
  BEFORE DELETE ON users
  FOR EACH ROW EXECUTE FUNCTION reports_on_account_delete();

-- Once a deleted reporter's case is closed and not on hold, drop the link.
CREATE OR REPLACE FUNCTION reports_anonymise_reporter_if_eligible() RETURNS trigger AS $$
BEGIN
  IF NEW.reporter_account_deleted_at IS NOT NULL
     AND NEW.legal_hold IS NOT TRUE
     AND NEW.status NOT IN ('open', 'reviewing')
  THEN
    NEW.reporter_id := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_reports_anonymise_reporter ON reports;
CREATE TRIGGER trg_reports_anonymise_reporter
  BEFORE UPDATE OF status, legal_hold ON reports
  FOR EACH ROW EXECUTE FUNCTION reports_anonymise_reporter_if_eligible();
