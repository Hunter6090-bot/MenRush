-- Migration 067: Manual / invoice Premium stopgap while Verotel MID is pending.
-- Allows manual creation, tracking, user viewing, and confirmation of Premium invoices.
-- Does not store processor-specific tokens or fake live checkouts.

CREATE TABLE IF NOT EXISTS premium_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number VARCHAR(64) NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_tier VARCHAR(20) NOT NULL DEFAULT 'premium',
  plan_days INTEGER NOT NULL DEFAULT 30,
  amount_pence INTEGER NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'GBP',
  status VARCHAR(20) NOT NULL DEFAULT 'unpaid',
  payment_method VARCHAR(50) NOT NULL DEFAULT 'bank_transfer',
  payment_reference VARCHAR(64) NOT NULL,
  notes TEXT,
  paid_at TIMESTAMPTZ,
  confirmed_by_admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
  cancelled_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  ALTER TABLE premium_invoices
    ADD CONSTRAINT premium_invoices_status_check
    CHECK (status IN ('unpaid', 'paid', 'cancelled'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN invalid_column_reference THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE premium_invoices
    ADD CONSTRAINT premium_invoices_plan_tier_check
    CHECK (plan_tier IN ('premium', 'premium_plus'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN invalid_column_reference THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_premium_invoices_user ON premium_invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_premium_invoices_status ON premium_invoices(status);
CREATE INDEX IF NOT EXISTS idx_premium_invoices_invoice_number ON premium_invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_premium_invoices_payment_ref ON premium_invoices(payment_reference);
