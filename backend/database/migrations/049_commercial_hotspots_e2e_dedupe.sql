-- Follow-up to 048: keep e2e Cruise fixture visible under commercial filter;
-- collapse accidental duplicate Sweatbox Soho rows (keep earliest curated).

UPDATE hot_spots hs
   SET category_id = c.id,
       venue_type = COALESCE(hs.venue_type, 'sauna'),
       nation = COALESCE(hs.nation, 'England'),
       source = COALESCE(NULLIF(hs.source, ''), 'e2e-fixture'),
       is_active = TRUE
  FROM hot_spot_categories c
 WHERE c.slug = 'saunas'
   AND hs.id = 'aa000001-0001-4a01-8a01-000000000001';

-- Keep the earliest Sweatbox Soho curated row; deactivate later duplicates.
UPDATE hot_spots hs
   SET is_active = FALSE
 WHERE hs.name = 'Sweatbox Soho'
   AND hs.city = 'London'
   AND hs.is_user_generated = FALSE
   AND hs.id <> (
     SELECT id FROM hot_spots
      WHERE name = 'Sweatbox Soho' AND city = 'London' AND is_user_generated = FALSE
      ORDER BY created_at ASC
      LIMIT 1
   );
