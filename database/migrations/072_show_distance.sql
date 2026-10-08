-- Show distance toggle (Pete via Quality Check, 8 Oct 2026).
-- Default ON. When OFF the API returns no distance field for this member anywhere
-- (Nearby roster, profile, Community); clients show "Nearby".
-- Turning it OFF is Premium-only (checked in the API, not here).

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS show_distance BOOLEAN NOT NULL DEFAULT TRUE;
