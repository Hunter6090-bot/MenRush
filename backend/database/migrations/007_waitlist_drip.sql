-- 007_waitlist_drip.sql
-- Self-hosted waitlist drip campaign columns + sends ledger.
-- Idempotent: safe to run on databases where 001_waitlist already ran.

ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS unsubscribe_token TEXT UNIQUE;
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS unsubscribed_at TIMESTAMP;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'waitlist_status_chk'
  ) THEN
    ALTER TABLE waitlist ADD CONSTRAINT waitlist_status_chk
      CHECK (status IN ('active', 'unsubscribed', 'bounced'));
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_waitlist_status_created
  ON waitlist(status, created_at)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS waitlist_drip_sends (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id   INTEGER NOT NULL REFERENCES waitlist(id) ON DELETE CASCADE,
  template_key    TEXT NOT NULL,
  sent_at         TIMESTAMP NOT NULL DEFAULT NOW(),
  smtp_message_id TEXT,
  UNIQUE (subscriber_id, template_key)
);

CREATE INDEX IF NOT EXISTS idx_drip_sends_subscriber
  ON waitlist_drip_sends(subscriber_id);
