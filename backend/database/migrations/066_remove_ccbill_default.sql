-- 066_remove_ccbill_default.sql
-- Update default processor on subscriptions from legacy ccbill to verotel.

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'processor'
  ) THEN
    ALTER TABLE subscriptions ALTER COLUMN processor SET DEFAULT 'verotel';
    UPDATE subscriptions SET processor = 'verotel' WHERE processor = 'ccbill';
  END IF;
END $$;
