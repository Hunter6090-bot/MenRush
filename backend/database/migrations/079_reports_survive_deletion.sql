-- Mirror of database/migrations/079_reports_survive_deletion.sql for backend migrate path.
-- Reports survive when the REPORTED member deletes their account.
-- Before: reports.reported_id was ON DELETE CASCADE, so deleting the reported
-- member deleted every report about them (and its details / thread marker).
-- After: reported_id is nullable and ON DELETE SET NULL. A trigger stamps
-- reported_account_deleted_at so moderators can see the account was deleted.
-- No name, email or other identifying copy of the deleted member is kept.
-- Reporter side is unchanged (reporter_id still cascades).
-- Idempotent: safe to run more than once.

ALTER TABLE reports ADD COLUMN IF NOT EXISTS reported_account_deleted_at TIMESTAMPTZ;

ALTER TABLE reports ALTER COLUMN reported_id DROP NOT NULL;

DO $$
DECLARE
  con RECORD;
BEGIN
  -- Drop whatever FK(s) reported_id -> users currently has (name may vary by env).
  FOR con IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
    WHERE c.conrelid = 'reports'::regclass
      AND c.contype = 'f'
      AND a.attname = 'reported_id'
  LOOP
    EXECUTE format('ALTER TABLE reports DROP CONSTRAINT %I', con.conname);
  END LOOP;

  ALTER TABLE reports
    ADD CONSTRAINT reports_reported_id_fkey
    FOREIGN KEY (reported_id) REFERENCES users(id) ON DELETE SET NULL;
END $$;

-- BEFORE DELETE on users: stamp the reports about this member before the FK
-- nulls reported_id, so moderators still know the reported account was deleted.
CREATE OR REPLACE FUNCTION reports_mark_reported_deleted() RETURNS trigger AS $$
BEGIN
  UPDATE reports
     SET reported_account_deleted_at = COALESCE(reported_account_deleted_at, NOW())
   WHERE reported_id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_reports_mark_reported_deleted ON users;
CREATE TRIGGER trg_reports_mark_reported_deleted
  BEFORE DELETE ON users
  FOR EACH ROW EXECUTE FUNCTION reports_mark_reported_deleted();

-- Closed-report purge (REPORT_RETENTION_MONTHS_AFTER_CLOSE) scans by resolved_at.
CREATE INDEX IF NOT EXISTS idx_reports_closed_resolved
  ON reports (resolved_at)
  WHERE status IN ('actioned', 'dismissed');
