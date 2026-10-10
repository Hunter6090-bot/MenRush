-- Hot Spots: South Coast + deeper UK city coverage.
-- Public-facing venue names; coordinates approximate. Idempotent by name+city.

INSERT INTO hot_spots (
  category_id, name, city, description, latitude, longitude,
  is_user_generated, source, last_activity_at
)
SELECT c.id, v.name, v.city, v.description, v.lat, v.lng, FALSE, 'curated', NOW()
FROM hot_spot_categories c
JOIN (VALUES
  -- ── Southampton / Portsmouth / Hampshire (South Coast density) ──
  ('saunas', 'Southampton Steam', 'Southampton', 'City-centre wellness venue', 50.9097, -1.4044),
  ('saunas', 'Portsmouth Harbour Sauna', 'Portsmouth', 'Harbour-area spa complex', 50.7989, -1.0912),
  ('open-spaces', 'Southampton Common', 'Southampton', 'Large common & woodland paths', 50.9255, -1.4105),
  ('open-spaces', 'Portsdown Hill', 'Portsmouth', 'Hilltop open space overlooking the harbour', 50.8540, -1.0900),
  ('open-spaces', 'Hilsea Lines', 'Portsmouth', 'Historic fortifications & green corridor', 50.8320, -1.0700),
  ('parks-trails', 'Mayflower Park', 'Southampton', 'Waterfront park near the docks', 50.8965, -1.4065),
  ('parks-trails', 'Central Park Portsmouth', 'Portsmouth', 'City park & paths', 50.7995, -1.0830),
  ('parks-trails', 'Royal Victoria Country Park', 'Netley', 'Coastal park & woodland trails', 50.8690, -1.3400),
  ('parks-trails', 'Itchen Valley Country Park', 'Southampton', 'Riverside park east of the city', 50.9300, -1.3400),
  ('parks-trails', 'Stapleford Common', 'Eastleigh', 'Common land & trails', 50.9800, -1.3500),
  ('parking', 'Southampton Common Car Park', 'Southampton', 'Common-edge parking', 50.9220, -1.4080),
  ('parking', 'Gunwharf Quays Car Park', 'Portsmouth', 'Waterfront multi-storey', 50.7955, -1.1065),
  ('parking', 'Portsdown Hill Car Park', 'Portsmouth', 'Hill viewpoint parking', 50.8535, -1.0920),
  ('transit', 'Southampton Central', 'Southampton', 'Main city rail station', 50.9075, -1.4135),
  ('transit', 'Portsmouth Harbour Station', 'Portsmouth', 'Harbour rail & ferry hub', 50.7975, -1.1075),
  ('transit', 'Portsmouth & Southsea', 'Portsmouth', 'City-centre rail station', 50.7985, -1.0905),
  ('transit', 'Fareham Station', 'Fareham', 'Local rail hub', 50.8530, -1.1920),
  ('rest-facilities', 'Westquay amenities', 'Southampton', 'City-centre retail amenities', 50.9030, -1.4050),
  ('rest-facilities', 'Gunwharf amenities', 'Portsmouth', 'Waterfront facilities', 50.7950, -1.1070),
  ('open-spaces', 'Farlington Marshes', 'Portsmouth', 'Coastal nature reserve paths', 50.8400, -1.0350),
  ('open-spaces', 'Lepe Country Park', 'New Forest', 'Coastal park west of Southampton', 50.7850, -1.3600),
  ('parks-trails', 'Abbey Meadows', 'Winchester', 'Riverside meadows & paths', 51.0650, -1.3080),
  ('open-spaces', 'St Catherine''s Hill', 'Winchester', 'Hilltop open space', 51.0480, -1.3085),
  ('transit', 'Winchester Station', 'Winchester', 'Main city station', 51.0670, -1.3195),
  ('saunas', 'Bournemouth Steam', 'Bournemouth', 'Seafront-area wellness', 50.7192, -1.8808),
  ('open-spaces', 'Bournemouth Gardens', 'Bournemouth', 'Central gardens to the pier', 50.7205, -1.8780),
  ('parks-trails', 'Hengistbury Head', 'Bournemouth', 'Headland trails & beach', 50.7150, -1.7550),
  ('transit', 'Bournemouth Station', 'Bournemouth', 'Main city station', 50.7275, -1.8645),
  ('parking', 'Bournemouth Pier Car Park', 'Bournemouth', 'Seafront parking', 50.7165, -1.8755),

  -- ── Brighton / Hove / Worthing ──
  ('saunas', 'Brighton Steamworks', 'Brighton', 'City steam & spa', 50.8245, -0.1410),
  ('open-spaces', 'Brighton Beach', 'Brighton', 'Seafront promenade & shingle beach', 50.8195, -0.1365),
  ('open-spaces', 'Devil''s Dyke', 'Brighton', 'South Downs viewpoint', 50.8850, -0.2120),
  ('parks-trails', 'Queens Park Brighton', 'Brighton', 'East Brighton park', 50.8265, -0.1250),
  ('parks-trails', 'Hove Park', 'Hove', 'Municipal park & paths', 50.8380, -0.1720),
  ('parks-trails', 'Stanmer Park', 'Brighton', 'Country park north of the city', 50.8670, -0.1020),
  ('parking', 'Madeira Drive Car Park', 'Brighton', 'Seafront parking', 50.8190, -0.1300),
  ('parking', 'The Level Car Park', 'Brighton', 'Park-adjacent parking', 50.8325, -0.1340),
  ('transit', 'Brighton Station', 'Brighton', 'Main city rail hub', 50.8290, -0.1410),
  ('transit', 'Hove Station', 'Hove', 'Local rail station', 50.8355, -0.1710),
  ('rest-facilities', 'Brighton Pier amenities', 'Brighton', 'Seafront facilities', 50.8165, -0.1368),
  ('open-spaces', 'Worthing Beach', 'Worthing', 'West Sussex seafront', 50.8090, -0.3710),
  ('transit', 'Worthing Station', 'Worthing', 'Main town station', 50.8185, -0.3760),

  -- ── Reading / Oxford / Guildford / Basingstoke ──
  ('saunas', 'Reading Steam', 'Reading', 'Town-centre wellness', 51.4543, -0.9781),
  ('open-spaces', 'Forbury Gardens', 'Reading', 'Central gardens', 51.4565, -0.9675),
  ('parks-trails', 'Prospect Park', 'Reading', 'West Reading park', 51.4500, -1.0050),
  ('transit', 'Reading Station', 'Reading', 'Major rail interchange', 51.4585, -0.9715),
  ('saunas', 'Oxford Steam', 'Oxford', 'City wellness venue', 51.7520, -1.2577),
  ('open-spaces', 'Port Meadow', 'Oxford', 'Thames-side open meadow', 51.7700, -1.2800),
  ('parks-trails', 'University Parks', 'Oxford', 'Central parkland', 51.7595, -1.2520),
  ('transit', 'Oxford Station', 'Oxford', 'Main city station', 51.7535, -1.2700),
  ('open-spaces', 'Pewley Down', 'Guildford', 'Hilltop open space', 51.2300, -0.5550),
  ('parks-trails', 'Stoke Park', 'Guildford', 'Large municipal park', 51.2450, -0.5650),
  ('transit', 'Guildford Station', 'Guildford', 'Main town station', 51.2370, -0.5800),
  ('transit', 'Basingstoke Station', 'Basingstoke', 'Main town station', 51.2685, -1.0875),
  ('parks-trails', 'War Memorial Park', 'Basingstoke', 'Central park', 51.2620, -1.0900),

  -- ── Wales expansion ──
  ('saunas', 'Swansea Steam', 'Swansea', 'City wellness venue', 51.6214, -3.9436),
  ('open-spaces', 'Swansea Bay', 'Swansea', 'Bay promenade & beach', 51.6050, -3.9500),
  ('parks-trails', 'Singleton Park', 'Swansea', 'University-area park', 51.6100, -3.9800),
  ('transit', 'Swansea Station', 'Swansea', 'Main city station', 51.6255, -3.9405),
  ('open-spaces', 'Bute Park', 'Cardiff', 'Castle grounds park', 51.4835, -3.1835),
  ('parks-trails', 'Cardiff Bay Barrage', 'Cardiff', 'Bay waterfront paths', 51.4500, -3.1650),
  ('parks-trails', 'Cefn Onn Park', 'Cardiff', 'North Cardiff parkland', 51.5400, -3.1750),
  ('parking', 'Roath Park Car Park', 'Cardiff', 'Park parking', 51.5100, -3.1740),
  ('rest-facilities', 'Cardiff Bay amenities', 'Cardiff', 'Waterfront facilities', 51.4630, -3.1655),
  ('open-spaces', 'Belle Vue Park', 'Newport', 'Victorian park', 51.5800, -3.0000),
  ('transit', 'Newport Station', 'Newport', 'Main city station', 51.5895, -2.9990),
  ('parks-trails', 'Tredegar House Park', 'Newport', 'Estate parkland', 51.5600, -3.0250),

  -- ── More London ──
  ('saunas', 'Sweatbox Soho', 'London', 'Soho sauna complex', 51.5140, -0.1325),
  ('saunas', 'Sauna Bar', 'London', 'East London sauna bar', 51.5280, -0.0650),
  ('open-spaces', 'Regent''s Park', 'London', 'Royal park & open lawns', 51.5313, -0.1569),
  ('open-spaces', 'Primrose Hill', 'London', 'Hilltop park with city views', 51.5395, -0.1605),
  ('open-spaces', 'Brockwell Park', 'London', 'South London park & lido', 51.4505, -0.1070),
  ('open-spaces', 'Dulwich Park', 'London', 'South-east London park', 51.4460, -0.0835),
  ('open-spaces', 'Wormwood Scrubs', 'London', 'Large open common', 51.5205, -0.2350),
  ('parks-trails', 'Holland Park', 'London', 'West London park & Kyoto garden', 51.5025, -0.2035),
  ('parks-trails', 'Crystal Palace Park', 'London', 'South London park & dinosaurs', 51.4205, -0.0705),
  ('parks-trails', 'Alexandra Park', 'London', 'North London park & palace', 51.5940, -0.1300),
  ('parks-trails', 'Finsbury Park', 'London', 'North London park', 51.5645, -0.1065),
  ('parking', 'Kenwood House Car Park', 'London', 'Heath north parking', 51.5715, -0.1675),
  ('parking', 'Crystal Palace Car Park', 'London', 'Park parking', 51.4195, -0.0720),
  ('transit', 'Euston Station', 'London', 'Major rail terminus', 51.5285, -0.1335),
  ('transit', 'Paddington Station', 'London', 'Major rail terminus', 51.5155, -0.1755),
  ('transit', 'Waterloo Station', 'London', 'Major rail terminus', 51.5030, -0.1130),
  ('transit', 'Liverpool Street Station', 'London', 'Major rail terminus', 51.5185, -0.0815),
  ('rest-facilities', 'Covent Garden amenities', 'London', 'Central amenities', 51.5120, -0.1235),
  ('rest-facilities', 'Leicester Square amenities', 'London', 'West End facilities', 51.5105, -0.1300),

  -- ── Manchester expansion ──
  ('open-spaces', 'Platt Fields Park', 'Manchester', 'South Manchester park', 53.4480, -2.2250),
  ('open-spaces', 'Sale Water Park', 'Manchester', 'Mersey Valley park', 53.4300, -2.3050),
  ('parks-trails', 'Whitworth Park', 'Manchester', 'University-area park', 53.4605, -2.2300),
  ('parks-trails', 'Alexandra Park Manchester', 'Manchester', 'South Manchester park', 53.4500, -2.2500),
  ('parking', 'Piccadilly Car Park', 'Manchester', 'City-centre parking', 53.4770, -2.2300),
  ('rest-facilities', 'Northern Quarter amenities', 'Manchester', 'City amenities', 53.4830, -2.2350),
  ('transit', 'Manchester Victoria', 'Manchester', 'North city station', 53.4875, -2.2425),
  ('transit', 'Manchester Oxford Road', 'Manchester', 'City station', 53.4740, -2.2420),

  -- ── Birmingham expansion ──
  ('saunas', 'Birmingham Steam', 'Birmingham', 'City wellness venue', 52.4862, -1.8904),
  ('open-spaces', 'Edgbaston Reservoir', 'Birmingham', 'Reservoir paths & open space', 52.4750, -1.9350),
  ('parks-trails', 'Sutton Park', 'Birmingham', 'Large country park north of the city', 52.5650, -1.8450),
  ('parks-trails', 'Handsworth Park', 'Birmingham', 'North-west Birmingham park', 52.5100, -1.9200),
  ('parking', 'Bullring Car Park', 'Birmingham', 'City-centre multi-storey', 52.4775, -1.8945),
  ('rest-facilities', 'Centenary Square amenities', 'Birmingham', 'City-centre facilities', 52.4790, -1.9080),
  ('transit', 'Birmingham Moor Street', 'Birmingham', 'City rail station', 52.4790, -1.8925),
  ('transit', 'Birmingham Snow Hill', 'Birmingham', 'City rail station', 52.4835, -1.8990),

  -- ── Leeds / Sheffield / Nottingham / Leicester ──
  ('saunas', 'Leeds Steam', 'Leeds', 'City wellness venue', 53.7997, -1.5492),
  ('parks-trails', 'Woodhouse Moor', 'Leeds', 'University-area common', 53.8100, -1.5600),
  ('parks-trails', 'Temple Newsam', 'Leeds', 'Estate park east of the city', 53.7850, -1.4600),
  ('transit', 'Leeds Station', 'Leeds', 'Main city station', 53.7950, -1.5480),
  ('open-spaces', 'Weston Park', 'Sheffield', 'University-area park', 53.3815, -1.4900),
  ('parks-trails', 'Graves Park', 'Sheffield', 'South Sheffield park', 53.3400, -1.4700),
  ('transit', 'Sheffield Station', 'Sheffield', 'Main city station', 53.3780, -1.4620),
  ('open-spaces', 'The Forest Recreation Ground', 'Nottingham', 'Central open space', 52.9650, -1.1600),
  ('parks-trails', 'Wollaton Park', 'Nottingham', 'Deer park & hall grounds', 52.9480, -1.2100),
  ('transit', 'Nottingham Station', 'Nottingham', 'Main city station', 52.9470, -1.1465),
  ('saunas', 'Leicester Steam', 'Leicester', 'City wellness venue', 52.6369, -1.1398),
  ('parks-trails', 'Victoria Park Leicester', 'Leicester', 'Central park', 52.6250, -1.1200),
  ('transit', 'Leicester Station', 'Leicester', 'Main city station', 52.6315, -1.1250),

  -- ── Liverpool expansion ──
  ('saunas', 'Liverpool Steam', 'Liverpool', 'City wellness venue', 53.4084, -2.9810),
  ('open-spaces', 'Croxteth Hall Park', 'Liverpool', 'North Liverpool estate park', 53.4500, -2.8900),
  ('parks-trails', 'Princes Park', 'Liverpool', 'South Liverpool park', 53.3900, -2.9600),
  ('parking', 'Albert Dock Car Park', 'Liverpool', 'Waterfront parking', 53.4005, -2.9910),
  ('rest-facilities', 'Liverpool ONE amenities', 'Liverpool', 'City-centre facilities', 53.4035, -2.9870),

  -- ── Edinburgh / Glasgow expansion ──
  ('saunas', 'Edinburgh Steam', 'Edinburgh', 'City wellness venue', 55.9530, -3.1900),
  ('open-spaces', 'Calton Hill', 'Edinburgh', 'City-centre hill & monuments', 55.9550, -3.1825),
  ('parks-trails', 'The Meadows', 'Edinburgh', 'Central parkland', 55.9415, -3.1905),
  ('parks-trails', 'Inverleith Park', 'Edinburgh', 'North Edinburgh park', 55.9650, -3.2150),
  ('saunas', 'Glasgow Steam', 'Glasgow', 'City wellness venue', 55.8642, -4.2518),
  ('open-spaces', 'Glasgow Green', 'Glasgow', 'Historic green by the Clyde', 55.8500, -4.2400),
  ('parks-trails', 'Bellahouston Park', 'Glasgow', 'South Glasgow park', 55.8450, -4.3200),
  ('parks-trails', 'Queen''s Park Glasgow', 'Glasgow', 'Southside park', 55.8320, -4.2680),

  -- ── Newcastle / Belfast ──
  ('parks-trails', 'Exhibition Park', 'Newcastle', 'Town Moor edge park', 54.9850, -1.6150),
  ('parks-trails', 'Jesmond Dene', 'Newcastle', 'Wooded dene trails', 54.9950, -1.5950),
  ('open-spaces', 'Leazes Park', 'Newcastle', 'City-centre park', 54.9780, -1.6250),
  ('rest-facilities', 'Grey''s Monument amenities', 'Newcastle', 'City-centre facilities', 54.9735, -1.6135),
  ('parks-trails', 'Ormeau Park', 'Belfast', 'South Belfast park', 54.5850, -5.9200),
  ('open-spaces', 'Cave Hill', 'Belfast', 'Hill trails north of the city', 54.6500, -5.9500),
  ('transit', 'Belfast Lanyon Place', 'Belfast', 'Main city station', 54.5955, -5.9170),
  ('rest-facilities', 'City Hall amenities', 'Belfast', 'City-centre facilities', 54.5965, -5.9300)
) AS v(cat_slug, name, city, description, lat, lng)
  ON c.slug = v.cat_slug
WHERE NOT EXISTS (
  SELECT 1 FROM hot_spots hs
  WHERE hs.name = v.name
    AND COALESCE(hs.city, '') = COALESCE(v.city, '')
);
