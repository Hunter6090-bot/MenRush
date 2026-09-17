-- Migration 063: Venue claims and venue calendar management
-- P0 venue calendar MVP:
-- - Claim existing commercial Hot Spot pin only (no invent-a-venue)
-- - Ops human approve gate (A)
-- - Dual-proof stub fields (domain email OTP, phone OTP, Companies House) for future without rewrite
-- - Attestation + false-claim ban/freeze path
-- - Dispute/freeze path
-- - Venue calendar events (linked to commercial hot spot and approved claim)
-- - Quiet face copy: "Venue claimed" / "Calendar managed by venue" (NEVER Verified Business / partner / sponsored / endorsed)
-- - Venue posts = UGC

-- 1. Venue Claims table
CREATE TABLE IF NOT EXISTS venue_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spot_id UUID NOT NULL REFERENCES hot_spots(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(30) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'disputed', 'frozen')),
  venue_role VARCHAR(80) NOT NULL,
  contact_name VARCHAR(120) NOT NULL,
  contact_email VARCHAR(255) NOT NULL,
  contact_phone VARCHAR(40),
  website_or_social_proof TEXT,
  attestation_agreed BOOLEAN NOT NULL DEFAULT FALSE,
  attestation_text TEXT NOT NULL,
  attested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by VARCHAR(100),
  review_notes TEXT,
  dispute_reason TEXT,
  disputed_at TIMESTAMPTZ,
  disputed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  frozen_reason TEXT,
  frozen_at TIMESTAMPTZ,
  -- Dual-proof hooks/stubs for future (plugs in without schema rewrite)
  domain_email VARCHAR(255),
  domain_email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  phone_otp VARCHAR(20),
  phone_otp_verified BOOLEAN NOT NULL DEFAULT FALSE,
  companies_house_num VARCHAR(30),
  companies_house_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_venue_claims_spot_status ON venue_claims (spot_id, status);
CREATE INDEX IF NOT EXISTS idx_venue_claims_user_status ON venue_claims (user_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_venue_claims_one_approved ON venue_claims (spot_id) WHERE status = 'approved';
CREATE UNIQUE INDEX IF NOT EXISTS idx_venue_claims_one_pending_per_user ON venue_claims (spot_id, user_id) WHERE status = 'pending';

-- 2. Hot Spots claim metadata
ALTER TABLE hot_spots
  ADD COLUMN IF NOT EXISTS claimed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS active_claim_id UUID REFERENCES venue_claims(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS claim_status VARCHAR(30) NOT NULL DEFAULT 'unclaimed'
    CHECK (claim_status IN ('unclaimed', 'pending', 'approved', 'disputed', 'frozen')),
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_calendar_managed BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_hot_spots_claim_status ON hot_spots (claim_status);
CREATE INDEX IF NOT EXISTS idx_hot_spots_claimed_by ON hot_spots (claimed_by_user_id);

-- 3. Rooms / Events venue-management metadata
ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS spot_id UUID REFERENCES hot_spots(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS venue_claim_id UUID REFERENCES venue_claims(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_venue_managed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'published'
    CHECK (status IN ('published', 'cancelled', 'draft')),
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_rooms_venue_spot ON rooms (spot_id, kind, starts_at);
CREATE INDEX IF NOT EXISTS idx_rooms_venue_claim ON rooms (venue_claim_id, status);

-- 4. User account freeze / false-claim ban path
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_frozen BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS frozen_reason TEXT,
  ADD COLUMN IF NOT EXISTS frozen_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_frozen ON users (is_frozen) WHERE is_frozen = TRUE;
