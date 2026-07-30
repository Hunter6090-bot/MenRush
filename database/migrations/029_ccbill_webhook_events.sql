-- 029_ccbill_webhook_events.sql
-- Idempotency and audit trail for CCBill payment webhooks.
-- Prevents duplicate or replayed activation, renewal, cancellation,
-- expiry, refund, and chargeback processing. Stores only the minimum
-- needed to detect duplicates and support an audit trail: no card
-- numbers, no raw webhook payloads, no payment account details.

CREATE TABLE IF NOT EXISTS processed_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL DEFAULT 'ccbill',
    provider_event_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    event_category TEXT NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    subscription_id TEXT,
    occurred_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'processing',
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

DO $$ BEGIN
  ALTER TABLE processed_webhook_events
    ADD CONSTRAINT processed_webhook_events_category_check
    CHECK (event_category IN ('activation', 'renewal', 'cancellation', 'expiry', 'refund', 'chargeback', 'other'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE processed_webhook_events
    ADD CONSTRAINT processed_webhook_events_status_check
    CHECK (status IN ('processing', 'processed', 'ignored_out_of_order', 'failed'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- One-time processing guarantee per provider event id. This is the
-- idempotency boundary: a second insert for the same (provider,
-- provider_event_id) is rejected by the database, not just the app.
CREATE UNIQUE INDEX IF NOT EXISTS idx_processed_webhook_events_provider_event
  ON processed_webhook_events(provider, provider_event_id);

CREATE INDEX IF NOT EXISTS idx_processed_webhook_events_subscription
  ON processed_webhook_events(subscription_id, occurred_at DESC)
  WHERE subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_processed_webhook_events_category
  ON processed_webhook_events(event_category, created_at DESC);
