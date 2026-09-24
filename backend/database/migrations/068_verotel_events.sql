-- No legacy unverified subscription is trusted or backfilled by this migration.
CREATE TABLE IF NOT EXISTS verotel_orders (
  reference UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  shop_id TEXT NOT NULL,
  environment TEXT NOT NULL CHECK (environment IN ('sandbox', 'production')),
  price_pence INTEGER NOT NULL CHECK (price_pence = 699),
  currency TEXT NOT NULL CHECK (currency = 'GBP'),
  period TEXT NOT NULL CHECK (period = 'P30D'),
  sale_id TEXT,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (shop_id, sale_id)
);
CREATE INDEX IF NOT EXISTS verotel_orders_user ON verotel_orders(user_id);
CREATE TABLE IF NOT EXISTS verotel_events (
  shop_id TEXT NOT NULL,
  event_key TEXT NOT NULL,
  digest TEXT NOT NULL,
  reference UUID NOT NULL REFERENCES verotel_orders(reference),
  sale_id TEXT NOT NULL,
  event TEXT NOT NULL CHECK (event IN ('initial','rebill','cancel','expiry','credit','chargeback')),
  transaction_id TEXT,
  parent_id TEXT,
  period_end DATE,
  amount_pence INTEGER,
  terminal BOOLEAN NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (shop_id, event_key)
);
CREATE INDEX IF NOT EXISTS verotel_events_reference ON verotel_events(reference);
-- Retain independent grants when projecting paid access onto legacy user flags.
CREATE TABLE IF NOT EXISTS verotel_entitlement_projection (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  independent JSONB NOT NULL,
  projected JSONB NOT NULL
);
