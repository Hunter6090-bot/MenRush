-- Hot Spots — community venue check-ins (separate from user "Pulse" visibility boost).
-- Category copy is App Store / legal-review friendly.

CREATE TABLE IF NOT EXISTS hot_spot_categories (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(60) NOT NULL UNIQUE,
  icon VARCHAR(8) NOT NULL DEFAULT '📍',
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS hot_spots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id INT NOT NULL REFERENCES hot_spot_categories(id),
  name VARCHAR(120) NOT NULL,
  city VARCHAR(60),
  description TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  is_user_generated BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hot_spot_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spot_id UUID NOT NULL REFERENCES hot_spots(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checked_out_at TIMESTAMPTZ,
  CONSTRAINT hot_spot_checkins_one_active UNIQUE (user_id, spot_id, checked_in_at)
);

CREATE INDEX IF NOT EXISTS idx_hot_spots_category ON hot_spots (category_id);
CREATE INDEX IF NOT EXISTS idx_hot_spots_location
  ON hot_spots USING GIST ((ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography));
CREATE INDEX IF NOT EXISTS idx_hot_spots_city ON hot_spots (city);
CREATE INDEX IF NOT EXISTS idx_hot_spot_checkins_spot_active
  ON hot_spot_checkins (spot_id)
  WHERE checked_out_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_hot_spot_checkins_user_active
  ON hot_spot_checkins (user_id)
  WHERE checked_out_at IS NULL;

INSERT INTO hot_spot_categories (slug, name, icon, description, sort_order) VALUES
  ('rest-facilities', 'Rest & facilities', '🏛️', 'Community-listed public amenity areas', 1),
  ('parks-trails', 'Parks & trails', '🌲', 'Parks, trails and green spaces', 2),
  ('parking', 'Parking areas', '🅿️', 'Car parks and roadside pull-ins', 3),
  ('saunas', 'Saunas & spas', '🧖', 'Licensed saunas, bathhouses and wellness venues', 4),
  ('open-spaces', 'Open spaces', '🏞️', 'Heaths, commons and outdoor meeting areas', 5),
  ('transit', 'Transit & stations', '🚉', 'Stations and major travel hubs', 6)
ON CONFLICT (slug) DO NOTHING;

-- Curated UK venues (coordinates approximate; names are public-facing).
INSERT INTO hot_spots (category_id, name, city, description, latitude, longitude, is_user_generated)
SELECT c.id, v.name, v.city, v.description, v.lat, v.lng, FALSE
FROM hot_spot_categories c
JOIN (VALUES
  ('saunas', 'Sweatbox Sauna', 'London', 'Central London sauna & wellness', 51.5132, -0.1391),
  ('saunas', 'Pleasuredrome', 'London', 'South London bathhouse', 51.4940, -0.1234),
  ('saunas', 'Riverside Health & Leisure', 'London', 'East London sauna club', 51.5125, -0.0402),
  ('saunas', 'BASE Sauna', 'Manchester', 'City-centre sauna', 53.4808, -2.2426),
  ('saunas', 'Eden Sauna', 'Manchester', 'Northern Quarter wellness venue', 53.4839, -2.2335),
  ('saunas', 'Brighton Sauna', 'Brighton', 'Seafront-area sauna', 50.8225, -0.1372),
  ('saunas', 'Steam Complex', 'Birmingham', 'Digbeth wellness club', 52.4751, -1.8860),
  ('saunas', 'Pleasuredrome Leeds', 'Leeds', 'City sauna & spa', 53.8008, -1.5491),
  ('saunas', 'Number 18 Sauna', 'Edinburgh', 'New Town sauna', 55.9533, -3.1883),
  ('saunas', 'Pipeworks Sauna', 'Glasgow', 'Merchant City sauna', 55.8609, -4.2514),
  ('open-spaces', 'Hampstead Heath', 'London', 'Large heathland & trails', 51.5613, -0.1722),
  ('open-spaces', 'Hyde Park', 'London', 'Central park & open lawns', 51.5073, -0.1657),
  ('open-spaces', 'Clapham Common', 'London', 'South London common', 51.4618, -0.1384),
  ('open-spaces', 'Preston Park', 'Brighton', 'Popular park south of the city', 50.8356, -0.1441),
  ('parks-trails', 'Richmond Park', 'London', 'Deer park & woodland trails', 51.4424, -0.2749),
  ('parks-trails', 'Heaton Park', 'Manchester', 'Large municipal park', 53.5311, -2.2522),
  ('parks-trails', 'Kelvingrove Park', 'Glasgow', 'West End park & paths', 55.8682, -4.2865),
  ('transit', 'King''s Cross St Pancras', 'London', 'Major rail interchange', 51.5308, -0.1238),
  ('transit', 'Manchester Piccadilly', 'Manchester', 'Main city station', 53.4774, -2.2309),
  ('transit', 'Birmingham New Street', 'Birmingham', 'Central rail hub', 52.4782, -1.8986),
  ('parking', 'Hampstead Heath South Car Park', 'London', 'Heath-adjacent parking', 51.5542, -0.1681),
  ('parking', 'Dover Street Car Park', 'Brighton', 'Central multi-storey', 50.8220, -0.1388),
  ('rest-facilities', 'Victoria Coach Station area', 'London', 'Travel hub amenities', 51.4925, -0.1486),
  ('rest-facilities', 'Piccadilly Gardens facilities', 'Manchester', 'City-centre public amenities', 53.4809, -2.2374)
) AS v(cat_slug, name, city, description, lat, lng) ON c.slug = v.cat_slug
WHERE NOT EXISTS (
  SELECT 1 FROM hot_spots hs
  WHERE hs.name = v.name AND hs.city = v.city
);