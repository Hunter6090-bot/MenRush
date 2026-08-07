-- 011_premium.sql
-- Premium subscriptions (CCBill / high-risk processors — not Stripe billing).
-- Idempotent: safe to run multiple times.

DO $$ BEGIN
  ALTER TABLE users ADD COLUMN premium_tier VARCHAR(20) NOT NULL DEFAULT 'free';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE users ADD COLUMN is_premium BOOLEAN NOT NULL DEFAULT FALSE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE users ADD COLUMN premium_until TIMESTAMPTZ;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE users
    ADD CONSTRAINT users_premium_tier_check
    CHECK (premium_tier IN ('free', 'premium', 'premium_plus'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN invalid_column_reference THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier VARCHAR(20) NOT NULL DEFAULT 'premium',
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  processor VARCHAR(30) NOT NULL DEFAULT 'ccbill',
  processor_subscription_id TEXT,
  processor_customer_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  ALTER TABLE subscriptions
    ADD CONSTRAINT subscriptions_tier_check
    CHECK (tier IN ('premium', 'premium_plus'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN invalid_column_reference THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE subscriptions
    ADD CONSTRAINT subscriptions_status_check
    CHECK (status IN ('active', 'canceled', 'expired', 'past_due'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN invalid_column_reference THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS premium_features_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feature VARCHAR(50) NOT NULL,
  used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_processor_ref
  ON subscriptions(processor_subscription_id)
  WHERE processor_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_premium_features_usage_user_day
  ON premium_features_usage(user_id, feature, used_at);
CREATE INDEX IF NOT EXISTS idx_users_is_premium ON users(is_premium);

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_one_active_per_user
  ON subscriptions(user_id)
  WHERE status = 'active';