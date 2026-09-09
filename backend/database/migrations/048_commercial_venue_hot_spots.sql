-- Commercial venue Hot Spots / Cruise lock (Brand + Legal).
-- GREEN: licensed saunas, clubs, bars, cinema clubs only.
-- RED: outdoor / parks / parking / transit / rest-facilities / PSE / cottaging — deactivate.
-- Does NOT invent new lat/lng. Keeps a tiny prior-curated commercial sample; ops verifies rest.

ALTER TABLE hot_spot_categories
  ADD COLUMN IF NOT EXISTS is_commercial BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE hot_spot_categories
   SET is_commercial = TRUE,
       description = CASE slug
         WHEN 'saunas' THEN 'Licensed saunas, bathhouses and wellness venues'
         WHEN 'nightlife' THEN 'Licensed clubs, bars and live venue nights'
         ELSE description
       END
 WHERE slug IN ('saunas', 'nightlife');

UPDATE hot_spot_categories
   SET is_commercial = FALSE,
       description = 'Retired from Cruise. Outdoor and public-amenity pins are not seeded.'
 WHERE slug IN ('rest-facilities', 'parks-trails', 'parking', 'open-spaces', 'transit');

INSERT INTO hot_spot_categories (slug, name, icon, description, sort_order, is_commercial)
VALUES
  ('bars', 'Bars', '🍸', 'Licensed gay bars and venues', 8, TRUE),
  ('cinema', 'Cinema clubs', '🎬', 'Private cinema clubs (commercial premises)', 9, TRUE)
ON CONFLICT (slug) DO UPDATE
  SET name = EXCLUDED.name,
      icon = EXCLUDED.icon,
      description = EXCLUDED.description,
      sort_order = EXCLUDED.sort_order,
      is_commercial = TRUE;

ALTER TABLE hot_spots
  ADD COLUMN IF NOT EXISTS nation VARCHAR(40);

ALTER TABLE hot_spots
  ADD COLUMN IF NOT EXISTS venue_type VARCHAR(40);

ALTER TABLE hot_spots
  ADD COLUMN IF NOT EXISTS source_url TEXT;

ALTER TABLE hot_spots
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- Retire every non-commercial seed (parks, heaths, transit, parking, rest facilities).
UPDATE hot_spots hs
   SET is_active = FALSE
  FROM hot_spot_categories c
 WHERE hs.category_id = c.id
   AND c.is_commercial = FALSE
   AND hs.is_user_generated = FALSE;

-- Retire commercial curated rows that are not on the small keep-list.
-- Keep-list = prior first-party curated names that match Brand growth pointers.
-- Do not invent coordinates. verified_at stays NULL until ops hand-verifies.
UPDATE hot_spots hs
   SET is_active = FALSE
  FROM hot_spot_categories c
 WHERE hs.category_id = c.id
   AND c.is_commercial = TRUE
   AND hs.is_user_generated = FALSE
   AND NOT (
     (hs.city = 'London' AND hs.name ILIKE 'Sweatbox%')
     OR (hs.city = 'London' AND hs.name ILIKE 'Pleasuredrome%')
     OR (hs.city = 'Brighton' AND hs.name ILIKE '%Brighton Sauna%')
     OR (hs.city = 'Glasgow' AND hs.name ILIKE '%Pipeworks%')
   );

-- Align keep-list display names + commercial metadata. No hours, prices, or occupancy claims.
UPDATE hot_spots
   SET name = 'Sweatbox Soho',
       venue_type = 'sauna',
       nation = 'England',
       source = 'commercial-curated',
       description = 'Commercial sauna. Follow the venue''s rules. MenRush does not run this place.',
       is_active = TRUE
 WHERE city = 'London'
   AND name ILIKE 'Sweatbox%'
   AND is_user_generated = FALSE;

UPDATE hot_spots
   SET name = 'Pleasuredrome',
       venue_type = 'sauna',
       nation = 'England',
       source = 'commercial-curated',
       description = 'Commercial sauna. Follow the venue''s rules. MenRush does not run this place.',
       is_active = TRUE
 WHERE city = 'London'
   AND name ILIKE 'Pleasuredrome%'
   AND is_user_generated = FALSE;

UPDATE hot_spots
   SET name = 'The Brighton Sauna',
       venue_type = 'sauna',
       nation = 'England',
       source = 'commercial-curated',
       description = 'Commercial sauna. Follow the venue''s rules. MenRush does not run this place.',
       is_active = TRUE
 WHERE city = 'Brighton'
   AND name ILIKE '%Brighton Sauna%'
   AND is_user_generated = FALSE;

UPDATE hot_spots
   SET name = 'The Pipeworks Glasgow',
       venue_type = 'sauna',
       nation = 'Scotland',
       source = 'commercial-curated',
       description = 'Commercial sauna. Follow the venue''s rules. MenRush does not run this place.',
       is_active = TRUE
 WHERE city = 'Glasgow'
   AND name ILIKE '%Pipeworks%'
   AND is_user_generated = FALSE;
