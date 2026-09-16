-- Zoul + Legal: Equator Bar Birmingham promoted GREEN.
-- Soft AMBER still excluded: Centre Stage MCR, Eden Bar, Blayds Bar.
-- Outdoor / PSE untouched. Keep-list untouched.
-- Narrows prior 054 Equator% defensive deactivate so this venue stays active.
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
  ('bars', 'Equator Bar Birmingham', 'Birmingham', 'England', 'bar',
   'https://www.equator-bar.co.uk/', 52.4730608, -1.8957279,
   'green-2026-09:equator-birmingham', '2026-09-11T15:10:00Z')
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
  ('bars', 'Equator Bar Birmingham', 'Birmingham', 'England', 'bar',
   'https://www.equator-bar.co.uk/', 52.4730608, -1.8957279,
   'green-2026-09:equator-birmingham', '2026-09-11T15:10:00Z')
  ) AS v(cat_slug, name, city, nation, venue_type, source_url, lat, lng, external_id, verified_at)
    ON c.slug = v.cat_slug AND c.is_commercial = TRUE
 WHERE hs.source = 'ops-commercial'
   AND hs.external_id = v.external_id;

-- Soft AMBER held (do not seed / keep inactive if present).
-- Equator Bar Birmingham is GREEN — do not match Equator%.
UPDATE hot_spots
   SET is_active = FALSE
 WHERE is_user_generated = FALSE
   AND (
     name ILIKE 'Centre Stage%'
     OR name ILIKE 'Eden Bar%'
     OR name ILIKE 'Blayds%'
   )
   AND NOT (name = 'Equator Bar Birmingham' AND city = 'Birmingham');

-- Ensure Equator Bar Birmingham remains active after any prior Equator% deactivate.
UPDATE hot_spots
   SET is_active = TRUE
 WHERE source = 'ops-commercial'
   AND external_id = 'green-2026-09:equator-birmingham';

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
