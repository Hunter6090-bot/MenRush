-- Migration 061: Add Hog's Back (A31 layby corridor, Guildford) and Wisley Common (near RHS Wisley / A3, Surrey).
-- Known cruising locations with real verified coordinates.
-- Categories: parking ('parking') and parks-trails ('parks-trails').

INSERT INTO hot_spots (
  category_id, name, city, nation, description,
  latitude, longitude, is_user_generated, is_active, source, external_id,
  verified_at, last_activity_at
)
SELECT
  c.id,
  v.name,
  v.city,
  'England',
  v.description,
  v.lat,
  v.lng,
  FALSE,
  TRUE,
  'ops-curated',
  v.external_id,
  NOW(),
  NOW()
FROM hot_spot_categories c
JOIN (VALUES
  ('parking', 'Hog''s Back A31 Layby', 'Guildford', 'Car park',
   51.22603, -0.67367, 'ops-curated-cruising:hogs-back-a31-layby'),
  ('parks-trails', 'Wisley Common', 'Wisley', 'Woodland',
   51.31836, -0.47316, 'ops-curated-cruising:wisley-common')
) AS v(cat_slug, name, city, description, lat, lng, external_id)
  ON c.slug = v.cat_slug
WHERE NOT EXISTS (
  SELECT 1 FROM hot_spots hs
   WHERE hs.source = 'ops-curated'
     AND (hs.external_id = v.external_id OR lower(hs.name) = lower(v.name))
);

-- Ensure active and updated if row exists
UPDATE hot_spots hs
   SET category_id = c.id,
       name = v.name,
       city = v.city,
       nation = 'England',
       description = v.description,
       latitude = v.lat,
       longitude = v.lng,
       is_user_generated = FALSE,
       is_active = TRUE
  FROM hot_spot_categories c
  JOIN (VALUES
  ('parking', 'Hog''s Back A31 Layby', 'Guildford', 'Car park',
   51.22603, -0.67367, 'ops-curated-cruising:hogs-back-a31-layby'),
  ('parks-trails', 'Wisley Common', 'Wisley', 'Woodland',
   51.31836, -0.47316, 'ops-curated-cruising:wisley-common')
  ) AS v(cat_slug, name, city, description, lat, lng, external_id)
    ON c.slug = v.cat_slug
 WHERE hs.source = 'ops-curated'
   AND (hs.external_id = v.external_id OR lower(hs.name) = lower(v.name));
