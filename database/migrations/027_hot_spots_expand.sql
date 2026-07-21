-- Hot Spots expand: activity tracking, comments, more curated UK venues.
-- Imported/external spots must carry last_activity_at (used by import scripts).

ALTER TABLE hot_spots
  ADD COLUMN IF NOT EXISTS source VARCHAR(40) NOT NULL DEFAULT 'curated';

ALTER TABLE hot_spots
  ADD COLUMN IF NOT EXISTS external_id VARCHAR(120);

ALTER TABLE hot_spots
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_hot_spots_source_external
  ON hot_spots (source, external_id)
  WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_hot_spots_last_activity
  ON hot_spots (last_activity_at DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS hot_spot_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spot_id UUID NOT NULL REFERENCES hot_spots(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  is_anonymous BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hot_spot_comments_spot_created
  ON hot_spot_comments (spot_id, created_at DESC);

-- Mark existing curated seeds as recently maintained (ops-reviewed venues).
UPDATE hot_spots
   SET last_activity_at = COALESCE(last_activity_at, NOW()),
       source = COALESCE(NULLIF(source, ''), 'curated')
 WHERE is_user_generated = FALSE;

-- Additional curated UK venues (public-facing names; coordinates approximate).
INSERT INTO hot_spots (category_id, name, city, description, latitude, longitude, is_user_generated, source, last_activity_at)
SELECT c.id, v.name, v.city, v.description, v.lat, v.lng, FALSE, 'curated', NOW()
FROM hot_spot_categories c
JOIN (VALUES
  -- Saunas & spas (licensed / operating venues)
  ('saunas', 'Vault 139', 'London', 'Soho sauna & club', 51.5135, -0.1348),
  ('saunas', 'Chariots European', 'London', 'Shoreditch sauna', 51.5245, -0.0789),
  ('saunas', 'The Hoist Sauna', 'London', 'Vauxhall sauna area', 51.4856, -0.1249),
  ('saunas', 'Union Steam', 'London', 'South London steam complex', 51.4892, -0.1187),
  ('saunas', 'Steamworks Manchester', 'Manchester', 'City sauna & spa', 53.4795, -2.2451),
  ('saunas', 'Bodyworks Bristol', 'Bristol', 'City-centre wellness', 51.4545, -2.5879),
  ('saunas', 'Steamworks Liverpool', 'Liverpool', 'City sauna', 53.4084, -2.9916),
  ('saunas', 'Newcastle Sauna', 'Newcastle', 'City wellness venue', 54.9783, -1.6178),
  ('saunas', 'Cardiff Steam', 'Cardiff', 'Bay-area sauna', 51.4816, -3.1791),
  ('saunas', 'Nottingham Sauna', 'Nottingham', 'City-centre sauna', 52.9548, -1.1581),
  ('saunas', 'Sheffield Steam', 'Sheffield', 'City wellness club', 53.3811, -1.4701),
  ('saunas', 'Belfast Heat', 'Belfast', 'City sauna', 54.5973, -5.9301),

  -- Open spaces / commons
  ('open-spaces', 'Wimbledon Common', 'London', 'Large common & woodland', 51.4332, -0.2358),
  ('open-spaces', 'Tooting Bec Common', 'London', 'South London common', 51.4339, -0.1472),
  ('open-spaces', 'Epping Forest', 'London', 'Ancient woodland north-east', 51.6600, 0.0500),
  ('open-spaces', 'The Downs', 'Bristol', 'Clifton Down open space', 51.4665, -2.6208),
  ('open-spaces', 'Sefton Park', 'Liverpool', 'Victorian park & palm house', 53.3830, -2.9370),
  ('open-spaces', 'Arthur''s Seat', 'Edinburgh', 'Holyrood Park volcanic hill', 55.9441, -3.1618),
  ('open-spaces', 'Roath Park', 'Cardiff', 'Large municipal park', 51.5089, -3.1752),
  ('open-spaces', 'Botanic Gardens', 'Belfast', 'University-area gardens', 54.5820, -5.9370),
  ('open-spaces', 'Roundhay Park', 'Leeds', 'Large park & woodland', 53.8410, -1.4960),
  ('open-spaces', 'Town Moor', 'Newcastle', 'Open common north of centre', 54.9920, -1.6200),

  -- Parks & trails
  ('parks-trails', 'Battersea Park', 'London', 'Thames-side park & paths', 51.4791, -0.1550),
  ('parks-trails', 'Greenwich Park', 'London', 'Royal park & viewpoints', 51.4769, -0.0005),
  ('parks-trails', 'Victoria Park', 'London', 'East London park', 51.5366, -0.0389),
  ('parks-trails', 'Queens Park', 'Manchester', 'North Manchester park', 53.5080, -2.2160),
  ('parks-trails', 'Cannon Hill Park', 'Birmingham', 'South Birmingham park', 52.4500, -1.9050),
  ('parks-trails', 'Pollok Country Park', 'Glasgow', 'Large country park', 55.8280, -4.3000),
  ('parks-trails', 'Holyrood Park', 'Edinburgh', 'Royal park trails', 55.9460, -3.1600),
  ('parks-trails', 'Ashton Court Estate', 'Bristol', 'Estate park & woodland', 51.4480, -2.6450),
  ('parks-trails', 'Calderstones Park', 'Liverpool', 'South Liverpool park', 53.3835, -2.8940),
  ('parks-trails', 'Endcliffe Park', 'Sheffield', 'Porter Valley park', 53.3670, -1.5050),

  -- Parking
  ('parking', 'Parliament Hill Car Park', 'London', 'Heath north parking', 51.5595, -0.1605),
  ('parking', 'Richmond Park Roehampton Gate', 'London', 'Park gate parking', 51.4490, -0.2580),
  ('parking', 'Heaton Park Main Car Park', 'Manchester', 'Park entrance parking', 53.5350, -2.2550),
  ('parking', 'Ashton Court Car Park', 'Bristol', 'Estate parking', 51.4475, -2.6400),
  ('parking', 'Sefton Park Car Park', 'Liverpool', 'Park-adjacent parking', 53.3815, -2.9400),
  ('parking', 'Holyrood Park Car Park', 'Edinburgh', 'Park access parking', 55.9430, -3.1680),

  -- Transit hubs
  ('transit', 'London Bridge Station', 'London', 'Major rail & tube hub', 51.5050, -0.0860),
  ('transit', 'Vauxhall Station', 'London', 'Rail / tube interchange', 51.4857, -0.1230),
  ('transit', 'Liverpool Lime Street', 'Liverpool', 'Main city station', 53.4075, -2.9775),
  ('transit', 'Bristol Temple Meads', 'Bristol', 'Main city station', 51.4490, -2.5800),
  ('transit', 'Edinburgh Waverley', 'Edinburgh', 'Central rail hub', 55.9520, -3.1890),
  ('transit', 'Glasgow Central', 'Glasgow', 'Main city station', 55.8590, -4.2580),
  ('transit', 'Cardiff Central', 'Cardiff', 'Main city station', 51.4750, -3.1780),
  ('transit', 'Newcastle Central', 'Newcastle', 'Main city station', 54.9680, -1.6170),

  -- Rest & facilities
  ('rest-facilities', 'Trafalgar Square amenities', 'London', 'Central public amenities', 51.5080, -0.1281),
  ('rest-facilities', 'Southbank Centre area', 'London', 'Thames-side amenities', 51.5060, -0.1165),
  ('rest-facilities', 'Albert Dock amenities', 'Liverpool', 'Waterfront facilities', 53.4000, -2.9920),
  ('rest-facilities', 'Millennium Square amenities', 'Bristol', 'City-centre facilities', 51.4505, -2.5970),
  ('rest-facilities', 'Princes Street Gardens facilities', 'Edinburgh', 'Central gardens amenities', 55.9510, -3.2000),
  ('rest-facilities', 'George Square amenities', 'Glasgow', 'City-centre facilities', 55.8610, -4.2500)
) AS v(cat_slug, name, city, description, lat, lng) ON c.slug = v.cat_slug
WHERE NOT EXISTS (
  SELECT 1 FROM hot_spots hs
  WHERE hs.name = v.name AND COALESCE(hs.city, '') = COALESCE(v.city, '')
);
