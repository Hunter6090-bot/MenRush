-- 034_official_rooms_catalog.sql
-- Official curated video-group rooms (product doc: official-room-themes.md).
-- Idempotent: safe to re-run the seed statements without duplicating rows.

ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS is_official BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS official_slug TEXT;

-- One row per official theme; NULL for user-created / location rooms.
CREATE UNIQUE INDEX IF NOT EXISTS idx_rooms_official_slug
  ON rooms (official_slug)
  WHERE official_slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rooms_is_official
  ON rooms (is_official)
  WHERE is_official = TRUE;

COMMENT ON COLUMN rooms.is_official IS
  'Curated MenRush catalog room. Joinable by any verified adult without prior membership.';
COMMENT ON COLUMN rooms.official_slug IS
  'Stable slug for official catalog rooms; used for idempotent seeding.';

-- Catalog owner account (not a login). created_by remains NOT NULL on rooms.
INSERT INTO users (
  id,
  email,
  password_hash,
  name,
  age,
  is_verified,
  verification_status,
  age_assurance_status,
  authenticity_status
)
VALUES (
  'a0000000-0000-4000-8000-0000000000ff',
  'official-rooms@menrush.internal',
  -- Unusable placeholder hash; account is seed-only (no login).
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  'MenRush Official',
  99,
  TRUE,
  'verified',
  'confirmed',
  'unverified'
)
ON CONFLICT (email) DO NOTHING;

-- Fixed UUIDs + official_slug → re-running seed updates in place, never duplicates.
INSERT INTO rooms (
  id,
  name,
  description,
  avatar_url,
  created_by,
  is_location_based,
  max_members,
  kind,
  is_official,
  official_slug,
  created_at,
  updated_at
)
VALUES
  (
    'a1000000-0000-4000-8000-000000000001',
    'Bears & Cubs',
    'Bears, cubs, otters, chasers',
    NULL,
    'a0000000-0000-4000-8000-0000000000ff',
    FALSE,
    200,
    'room',
    TRUE,
    'bears-cubs',
    NOW(),
    NOW()
  ),
  (
    'a1000000-0000-4000-8000-000000000002',
    'Daddies',
    'Daddies, silver foxes, age-gap',
    NULL,
    'a0000000-0000-4000-8000-0000000000ff',
    FALSE,
    200,
    'room',
    TRUE,
    'daddies',
    NOW(),
    NOW()
  ),
  (
    'a1000000-0000-4000-8000-000000000003',
    'Leather & Gear',
    'Leather, harness, boots, uniform',
    NULL,
    'a0000000-0000-4000-8000-0000000000ff',
    FALSE,
    200,
    'room',
    TRUE,
    'leather-gear',
    NOW(),
    NOW()
  ),
  (
    'a1000000-0000-4000-8000-000000000004',
    'Muscle & Jocks',
    'Gym bodies, athletic',
    NULL,
    'a0000000-0000-4000-8000-0000000000ff',
    FALSE,
    200,
    'room',
    TRUE,
    'muscle-jocks',
    NOW(),
    NOW()
  ),
  (
    'a1000000-0000-4000-8000-000000000005',
    'Twinks & Twunks',
    'Younger / leaner aesthetic',
    NULL,
    'a0000000-0000-4000-8000-0000000000ff',
    FALSE,
    200,
    'room',
    TRUE,
    'twinks-twunks',
    NOW(),
    NOW()
  ),
  (
    'a1000000-0000-4000-8000-000000000006',
    'Smokers & Cigars',
    'Smoking / cigar fetish',
    NULL,
    'a0000000-0000-4000-8000-0000000000ff',
    FALSE,
    200,
    'room',
    TRUE,
    'smokers-cigars',
    NOW(),
    NOW()
  ),
  (
    'a1000000-0000-4000-8000-000000000007',
    'Discreet / DL',
    'Privacy-focused, low-profile',
    NULL,
    'a0000000-0000-4000-8000-0000000000ff',
    FALSE,
    200,
    'room',
    TRUE,
    'discreet-dl',
    NOW(),
    NOW()
  ),
  (
    'a1000000-0000-4000-8000-000000000008',
    'Group Play',
    'Multi-person / open rooms',
    NULL,
    'a0000000-0000-4000-8000-0000000000ff',
    FALSE,
    200,
    'room',
    TRUE,
    'group-play',
    NOW(),
    NOW()
  ),
  (
    'a1000000-0000-4000-8000-000000000009',
    'Kink & Pig',
    'Pig play, heavier kink',
    NULL,
    'a0000000-0000-4000-8000-0000000000ff',
    FALSE,
    200,
    'room',
    TRUE,
    'kink-pig',
    NOW(),
    NOW()
  ),
  (
    'a1000000-0000-4000-8000-00000000000a',
    'Hosting Tonight',
    'People currently hosting',
    NULL,
    'a0000000-0000-4000-8000-0000000000ff',
    FALSE,
    200,
    'room',
    TRUE,
    'hosting-tonight',
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_official = TRUE,
  official_slug = EXCLUDED.official_slug,
  is_location_based = FALSE,
  kind = 'room',
  max_members = EXCLUDED.max_members,
  updated_at = NOW();
