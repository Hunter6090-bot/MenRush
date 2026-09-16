-- Migration 061: Add A31 Hog’s Back Rest Lay-by (Guildford area)
-- and Wisley (Ockham Common) (Surrey).
-- Confirmed seed coords from Product:
-- 1) "A31 Hog’s Back Rest Lay-by", lat 51.2260632, lng -0.6727582, parking / layby
-- 2) "Wisley (Ockham Common)", lat 51.3171538, lng -0.4538550, parks-trails / woods / common
-- Legal: Pure outdoor woodland and layby only. Never imply commercial/gardens endorsement.

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
  ('parking', 'A31 Hog’s Back Rest Lay-by', 'Guildford', 'Car park',
   51.2260632, -0.6727582, 'ops-curated-cruising:a31-hogs-back-rest-layby'),
  ('parks-trails', 'Wisley (Ockham Common)', 'Wisley', 'Woodland',
   51.3171538, -0.4538550, 'ops-curated-cruising:wisley-ockham-common')
) AS v(cat_slug, name, city, description, lat, lng, external_id)
  ON c.slug = v.cat_slug
WHERE NOT EXISTS (
  SELECT 1 FROM hot_spots hs
   WHERE hs.source = 'ops-curated'
     AND (
       hs.external_id = v.external_id
       OR lower(hs.name) = lower(v.name)
       OR (v.name = 'A31 Hog’s Back Rest Lay-by' AND (
         lower(hs.name) LIKE '%hog%back%'
         OR hs.external_id = 'ops-curated-cruising:hogs-back-a31-layby'
       ))
       OR (v.name = 'Wisley (Ockham Common)' AND (
         lower(hs.name) IN ('wisley common', 'ockham common', 'wisley (ockham common)')
         OR hs.external_id IN ('ops-curated-cruising:wisley-common', 'ops-curated-cruising:ockham-common')
       ))
     )
);

-- Ensure active and updated if row exists under canonical or prior alias names
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
  ('parking', 'A31 Hog’s Back Rest Lay-by', 'Guildford', 'Car park',
   51.2260632, -0.6727582, 'ops-curated-cruising:a31-hogs-back-rest-layby'),
  ('parks-trails', 'Wisley (Ockham Common)', 'Wisley', 'Woodland',
   51.3171538, -0.4538550, 'ops-curated-cruising:wisley-ockham-common')
  ) AS v(cat_slug, name, city, description, lat, lng, external_id)
    ON c.slug = v.cat_slug
 WHERE hs.source = 'ops-curated'
   AND (
     hs.external_id = v.external_id
     OR lower(hs.name) = lower(v.name)
     OR (v.name = 'A31 Hog’s Back Rest Lay-by' AND (
       lower(hs.name) LIKE '%hog%back%'
       OR hs.external_id = 'ops-curated-cruising:hogs-back-a31-layby'
     ))
     OR (v.name = 'Wisley (Ockham Common)' AND (
       lower(hs.name) IN ('wisley common', 'ockham common', 'wisley (ockham common)')
       OR hs.external_id IN ('ops-curated-cruising:wisley-common', 'ops-curated-cruising:ockham-common')
     ))
   );
