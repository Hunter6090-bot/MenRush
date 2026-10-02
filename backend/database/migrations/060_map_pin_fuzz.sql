-- Map pin discretion fuzz (Al ORDER Sep 2026).
-- How far others see your pin offset from real GPS — Sniffies-style randomization.
-- Default 320 m preserves historical privateMapPointAround range (80–320 m).

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS map_pin_fuzz_m INTEGER NOT NULL DEFAULT 320
  CHECK (map_pin_fuzz_m >= 80 AND map_pin_fuzz_m <= 800);

COMMENT ON COLUMN profiles.map_pin_fuzz_m IS
  'Max map-pin offset meters for privacy fuzz when others view this user. Offset is deterministic (seed map:userId) between ~25% and 100% of this value.';
