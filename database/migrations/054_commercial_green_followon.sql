-- Zoul + Legal follow-on GREEN commercial venues (2026-09).
-- Appends 4 hand-verified venues promoted from prior AMBER research list.
-- Soft-four AMBER stay out: Centre Stage, Eden, Equator, Blayds.
-- Outdoor / PSE / Redruth HOLD untouched. Keep-list untouched.
-- Copy = name + type + area only (description NULL). Never invent lat/lng.
-- Soft-refresh: npm run hotspots:seed-commercial -- --file ./data/commercial-venues.green-expand-2026-09.json

INSERT INTO hot_spots (
  category_id, name, city, nation, venue_type, source_url, description,
  latitude, longitude, is_user_generated, is_active, source, external_id,
  verified_at, last_activity_at
)
SELECT
  c.id,
  v.name,
  v.city,
  v.nation,
  v.venue_type,
  v.source_url,
  NULL,
  v.lat,
  v.lng,
  FALSE,
  TRUE,
  'ops-commercial',
  v.external_id,
  v.verified_at::timestamptz,
  NOW()
FROM hot_spot_categories c
JOIN (VALUES
  ('nightlife', 'Fire London', 'London', 'England', 'nightlife',
   'https://www.firelondon.net/', 51.4849543, -0.1234373,
   'green-2026-09:fire-london', '2026-09-11T15:00:00Z'),
  ('bars', 'City of Quebec', 'London', 'England', 'bar',
   'https://www.greeneking.co.uk/pubs/greater-london/city-of-quebec', 51.513979, -0.157818,
   'green-2026-09:city-of-quebec-london', '2026-09-11T15:00:00Z'),
  ('bars', 'EVA Manchester', 'Manchester', 'England', 'bar',
   'https://evamanchester.com/', 53.4772822, -2.2375077,
   'green-2026-09:eva-manchester', '2026-09-11T15:00:00Z'),
  ('nightlife', 'Fibre Leeds', 'Leeds', 'England', 'nightlife',
   'https://fibreleeds.com/', 53.7950442, -1.5423158,
   'green-2026-09:fibre-leeds', '2026-09-11T15:00:00Z')
) AS v(cat_slug, name, city, nation, venue_type, source_url, lat, lng, external_id, verified_at)
  ON c.slug = v.cat_slug
 AND c.is_commercial = TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM hot_spots hs
   WHERE hs.source = 'ops-commercial'
     AND hs.external_id = v.external_id
);

UPDATE hot_spots hs
   SET category_id = c.id,
       name = v.name,
       city = v.city,
       nation = v.nation,
       venue_type = v.venue_type,
       source_url = v.source_url,
       description = NULL,
       latitude = v.lat,
       longitude = v.lng,
       verified_at = v.verified_at::timestamptz,
       is_active = TRUE,
       is_user_generated = FALSE
  FROM hot_spot_categories c
  JOIN (VALUES
  ('nightlife', 'Fire London', 'London', 'England', 'nightlife',
   'https://www.firelondon.net/', 51.4849543, -0.1234373,
   'green-2026-09:fire-london', '2026-09-11T15:00:00Z'),
  ('bars', 'City of Quebec', 'London', 'England', 'bar',
   'https://www.greeneking.co.uk/pubs/greater-london/city-of-quebec', 51.513979, -0.157818,
   'green-2026-09:city-of-quebec-london', '2026-09-11T15:00:00Z'),
  ('bars', 'EVA Manchester', 'Manchester', 'England', 'bar',
   'https://evamanchester.com/', 53.4772822, -2.2375077,
   'green-2026-09:eva-manchester', '2026-09-11T15:00:00Z'),
  ('nightlife', 'Fibre Leeds', 'Leeds', 'England', 'nightlife',
   'https://fibreleeds.com/', 53.7950442, -1.5423158,
   'green-2026-09:fibre-leeds', '2026-09-11T15:00:00Z')
  ) AS v(cat_slug, name, city, nation, venue_type, source_url, lat, lng, external_id, verified_at)
    ON c.slug = v.cat_slug AND c.is_commercial = TRUE
 WHERE hs.source = 'ops-commercial'
   AND hs.external_id = v.external_id;

-- Soft-four AMBER must not be active under these names (defensive; never seeded).
UPDATE hot_spots
   SET is_active = FALSE
 WHERE is_user_generated = FALSE
   AND (
     name ILIKE 'Centre Stage%'
     OR name ILIKE 'Eden%'
     OR name ILIKE 'Equator%'
     OR name ILIKE 'Blayds%'
   );

-- Keep-list remains active.
UPDATE hot_spots
   SET is_active = TRUE
 WHERE is_user_generated = FALSE
   AND (
     (city = 'London' AND name = 'Sweatbox Soho')
     OR (city = 'London' AND name = 'Pleasuredrome')
     OR (city = 'Brighton' AND name = 'The Brighton Sauna')
     OR (city = 'Glasgow' AND name = 'The Pipeworks Glasgow')
   );
