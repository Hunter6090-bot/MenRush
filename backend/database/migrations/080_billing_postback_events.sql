-- Billing postback idempotency (#298, QC). A captured Verotel postback URL
-- replayed later must do nothing: each (processor, saleID, event, transaction)
-- is applied once. transaction_key = transactionID, else nextChargeOn /
-- expiresOn, else '' (events that happen once per sale, e.g. expiry).
CREATE TABLE IF NOT EXISTS billing_postback_events (
  id BIGSERIAL PRIMARY KEY,
  processor TEXT NOT NULL,
  sale_id TEXT NOT NULL,
  event TEXT NOT NULL,
  transaction_key TEXT NOT NULL DEFAULT '',
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT billing_postback_events_once UNIQUE (processor, sale_id, event, transaction_key)
);
