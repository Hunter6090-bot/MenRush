-- Batch 1 outdoor Hot Spots (2026-09-12).
-- Al Zain Legal override: Batch 1 seed + map pins only. Brand/Studio density claims held.
-- Commercial importer still rejects outdoor — this migration + dedicated seed script only.
-- Coords: Nominatim/OSM named POIs. Never invent lat/lng. No toilets. No Tropics.
-- Soft-refresh: npm run hotspots:seed-outdoor -- --file ./data/outdoor-hotspots.batch1-2026-09.json

-- Re-enable outdoor category face for Batch 1 map filters (not commercial).
UPDATE hot_spot_categories
   SET description = CASE slug
         WHEN 'parks-trails' THEN 'Parks, trails and green spaces'
         WHEN 'parking' THEN 'Car parks and roadside pull-ins'
         WHEN 'open-spaces' THEN 'Heaths, commons and outdoor open spaces'
         ELSE description
       END
 WHERE slug IN ('parks-trails', 'parking', 'open-spaces');

-- Insert Batch 1 curated outdoor spots (idempotent by source + external_id).
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
  '2026-09-12T12:00:00Z'::timestamptz,
  NOW()
FROM hot_spot_categories c
JOIN (VALUES
  ('parks-trails', 'Whiteley Parkway Woodland', 'Fareham', 'Woodland',
   50.8899825, -1.2410111, 'ops-curated-batch1-2026-09:whiteley-parkway-woodland'),
  ('parks-trails', 'Kites Croft', 'Fareham', 'Woodland',
   50.8576398, -1.2489733, 'ops-curated-batch1-2026-09:kites-croft'),
  ('parks-trails', 'Botley Woods', 'Fareham', 'Woodland',
   50.8841506, -1.2222867, 'ops-curated-batch1-2026-09:botley-woods'),
  ('open-spaces', 'Botley Road', 'Southampton', 'Public park',
   50.9016632, -1.3208246, 'ops-curated-batch1-2026-09:botley-road'),
  ('parks-trails', 'Thatchers Copse', 'Fareham', 'Woodland',
   50.828658, -1.2491656, 'ops-curated-batch1-2026-09:thatchers-copse'),
  ('open-spaces', 'Miller''s Pond', 'Southampton', 'Public park',
   50.8966234, -1.3611664, 'ops-curated-batch1-2026-09:millers-pond'),
  ('open-spaces', 'Southampton Common', 'Southampton', 'Public park',
   50.9283066, -1.4103651, 'ops-curated-batch1-2026-09:southampton-common'),
  ('open-spaces', 'Mountbatten Way Footpath', 'Southampton', 'Public park',
   50.9068363, -1.4171782, 'ops-curated-batch1-2026-09:mountbatten-way-footpath'),
  ('open-spaces', 'Fort Widley', 'Portsmouth', 'Public park',
   50.8543946, -1.0683243, 'ops-curated-batch1-2026-09:fort-widley'),
  ('open-spaces', 'Hilsea Lines', 'Portsmouth', 'Public park',
   50.8322367, -1.053074, 'ops-curated-batch1-2026-09:hilsea-lines'),
  ('parking', 'Billys lake car park', 'Waterlooville', 'Car park',
   50.8961194, -1.0441858, 'ops-curated-batch1-2026-09:billys-lake-car-park'),
  ('open-spaces', 'Eastney Beach Huts', 'Portsmouth', 'Public park',
   50.7865721, -1.0331823, 'ops-curated-batch1-2026-09:eastney-beach-huts'),
  ('parks-trails', 'Rock Gardens', 'Portsmouth', 'Public park',
   50.778863, -1.083239, 'ops-curated-batch1-2026-09:rock-gardens'),
  ('parking', 'Southsea Golf Social Club Carpark & Woods', 'Portsmouth', 'Car park',
   50.8147654, -1.0452395, 'ops-curated-batch1-2026-09:southsea-golf-carpark-woods'),
  ('parks-trails', 'Firestone copse', 'Ryde', 'Woodland',
   50.7168647, -1.2113032, 'ops-curated-batch1-2026-09:firestone-copse'),
  ('parks-trails', 'Parkhurst Forest', 'Newport', 'Woodland',
   50.7170413, -1.3325544, 'ops-curated-batch1-2026-09:parkhurst-forest'),
  ('open-spaces', 'St. Catherine''s Hill', 'Winchester', 'Public park',
   51.0463148, -1.3107596, 'ops-curated-batch1-2026-09:st-catherines-hill'),
  ('open-spaces', 'Whiteshute Ridge', 'Winchester', 'Public park',
   51.0468352, -1.3332291, 'ops-curated-batch1-2026-09:whiteshute-ridge'),
  ('parks-trails', 'Havant Thicket', 'Havant', 'Woodland',
   50.8914944, -0.9848104, 'ops-curated-batch1-2026-09:havant-thicket'),
  ('parks-trails', 'Sarum Road Woods', 'Winchester', 'Woodland',
   51.0600652, -1.3443905, 'ops-curated-batch1-2026-09:sarum-road-woods'),
  ('open-spaces', 'St Georges Down', 'Newport', 'Public park',
   50.6766741, -1.2632784, 'ops-curated-batch1-2026-09:st-georges-down'),
  ('parks-trails', 'A337 Cadnam To Lyndhurst Road at Shave Wood', 'Lyndhurst', 'Woodland',
   50.9096735, -1.5865635, 'ops-curated-batch1-2026-09:shave-wood-a337'),
  ('open-spaces', 'Culver Downs', 'Sandown', 'Public park',
   50.6663459, -1.1007973, 'ops-curated-batch1-2026-09:culver-downs'),
  ('parking', 'Milkham Car Park', 'Ringwood', 'Car park',
   50.8909039, -1.6929424, 'ops-curated-batch1-2026-09:milkham-car-park')
) AS v(cat_slug, name, city, description, lat, lng, external_id)
  ON c.slug = v.cat_slug
WHERE NOT EXISTS (
  SELECT 1 FROM hot_spots hs
   WHERE hs.source = 'ops-curated'
     AND hs.external_id = v.external_id
)
AND NOT EXISTS (
  -- Idempotent skip/update path for prior curated names (e.g. Southampton Common, Hilsea Lines).
  SELECT 1 FROM hot_spots hs
   WHERE hs.is_user_generated = FALSE
     AND lower(hs.city) = lower(v.city)
     AND (
       lower(hs.name) = lower(v.name)
       OR (
         v.name = 'St. Catherine''s Hill'
         AND lower(hs.name) IN ('st. catherine''s hill', 'st catherine''s hill')
       )
     )
);

-- Reactivate / refresh prior curated rows that match Batch 1 names (name+city).
UPDATE hot_spots hs
   SET category_id = c.id,
       name = v.name,
       city = v.city,
       nation = 'England',
       description = v.description,
       latitude = v.lat,
       longitude = v.lng,
       is_user_generated = FALSE,
       is_active = TRUE,
       source = 'ops-curated',
       external_id = v.external_id,
       verified_at = COALESCE(hs.verified_at, '2026-09-12T12:00:00Z'::timestamptz),
       last_activity_at = NOW()
  FROM hot_spot_categories c
  JOIN (VALUES
  ('parks-trails', 'Whiteley Parkway Woodland', 'Fareham', 'Woodland',
   50.8899825, -1.2410111, 'ops-curated-batch1-2026-09:whiteley-parkway-woodland'),
  ('parks-trails', 'Kites Croft', 'Fareham', 'Woodland',
   50.8576398, -1.2489733, 'ops-curated-batch1-2026-09:kites-croft'),
  ('parks-trails', 'Botley Woods', 'Fareham', 'Woodland',
   50.8841506, -1.2222867, 'ops-curated-batch1-2026-09:botley-woods'),
  ('open-spaces', 'Botley Road', 'Southampton', 'Public park',
   50.9016632, -1.3208246, 'ops-curated-batch1-2026-09:botley-road'),
  ('parks-trails', 'Thatchers Copse', 'Fareham', 'Woodland',
   50.828658, -1.2491656, 'ops-curated-batch1-2026-09:thatchers-copse'),
  ('open-spaces', 'Miller''s Pond', 'Southampton', 'Public park',
   50.8966234, -1.3611664, 'ops-curated-batch1-2026-09:millers-pond'),
  ('open-spaces', 'Southampton Common', 'Southampton', 'Public park',
   50.9283066, -1.4103651, 'ops-curated-batch1-2026-09:southampton-common'),
  ('open-spaces', 'Mountbatten Way Footpath', 'Southampton', 'Public park',
   50.9068363, -1.4171782, 'ops-curated-batch1-2026-09:mountbatten-way-footpath'),
  ('open-spaces', 'Fort Widley', 'Portsmouth', 'Public park',
   50.8543946, -1.0683243, 'ops-curated-batch1-2026-09:fort-widley'),
  ('open-spaces', 'Hilsea Lines', 'Portsmouth', 'Public park',
   50.8322367, -1.053074, 'ops-curated-batch1-2026-09:hilsea-lines'),
  ('parking', 'Billys lake car park', 'Waterlooville', 'Car park',
   50.8961194, -1.0441858, 'ops-curated-batch1-2026-09:billys-lake-car-park'),
  ('open-spaces', 'Eastney Beach Huts', 'Portsmouth', 'Public park',
   50.7865721, -1.0331823, 'ops-curated-batch1-2026-09:eastney-beach-huts'),
  ('parks-trails', 'Rock Gardens', 'Portsmouth', 'Public park',
   50.778863, -1.083239, 'ops-curated-batch1-2026-09:rock-gardens'),
  ('parking', 'Southsea Golf Social Club Carpark & Woods', 'Portsmouth', 'Car park',
   50.8147654, -1.0452395, 'ops-curated-batch1-2026-09:southsea-golf-carpark-woods'),
  ('parks-trails', 'Firestone copse', 'Ryde', 'Woodland',
   50.7168647, -1.2113032, 'ops-curated-batch1-2026-09:firestone-copse'),
  ('parks-trails', 'Parkhurst Forest', 'Newport', 'Woodland',
   50.7170413, -1.3325544, 'ops-curated-batch1-2026-09:parkhurst-forest'),
  ('open-spaces', 'St. Catherine''s Hill', 'Winchester', 'Public park',
   51.0463148, -1.3107596, 'ops-curated-batch1-2026-09:st-catherines-hill'),
  ('open-spaces', 'Whiteshute Ridge', 'Winchester', 'Public park',
   51.0468352, -1.3332291, 'ops-curated-batch1-2026-09:whiteshute-ridge'),
  ('parks-trails', 'Havant Thicket', 'Havant', 'Woodland',
   50.8914944, -0.9848104, 'ops-curated-batch1-2026-09:havant-thicket'),
  ('parks-trails', 'Sarum Road Woods', 'Winchester', 'Woodland',
   51.0600652, -1.3443905, 'ops-curated-batch1-2026-09:sarum-road-woods'),
  ('open-spaces', 'St Georges Down', 'Newport', 'Public park',
   50.6766741, -1.2632784, 'ops-curated-batch1-2026-09:st-georges-down'),
  ('parks-trails', 'A337 Cadnam To Lyndhurst Road at Shave Wood', 'Lyndhurst', 'Woodland',
   50.9096735, -1.5865635, 'ops-curated-batch1-2026-09:shave-wood-a337'),
  ('open-spaces', 'Culver Downs', 'Sandown', 'Public park',
   50.6663459, -1.1007973, 'ops-curated-batch1-2026-09:culver-downs'),
  ('parking', 'Milkham Car Park', 'Ringwood', 'Car park',
   50.8909039, -1.6929424, 'ops-curated-batch1-2026-09:milkham-car-park')
  ) AS v(cat_slug, name, city, description, lat, lng, external_id)
    ON c.slug = v.cat_slug
 WHERE hs.is_user_generated = FALSE
   AND lower(hs.city) = lower(v.city)
   AND (
     lower(hs.name) = lower(v.name)
     OR (
       v.name = 'St. Catherine''s Hill'
       AND lower(hs.name) IN ('st. catherine''s hill', 'st catherine''s hill')
     )
   );

-- Idempotent refresh when re-applied after JSON seed (match source + external_id).
UPDATE hot_spots hs
   SET category_id = c.id,
       name = v.name,
       city = v.city,
       nation = 'England',
       description = v.description,
       latitude = v.lat,
       longitude = v.lng,
       is_user_generated = FALSE,
       is_active = TRUE,
       last_activity_at = NOW()
  FROM hot_spot_categories c
  JOIN (VALUES
  ('parks-trails', 'Whiteley Parkway Woodland', 'Fareham', 'Woodland',
   50.8899825, -1.2410111, 'ops-curated-batch1-2026-09:whiteley-parkway-woodland'),
  ('parks-trails', 'Kites Croft', 'Fareham', 'Woodland',
   50.8576398, -1.2489733, 'ops-curated-batch1-2026-09:kites-croft'),
  ('parks-trails', 'Botley Woods', 'Fareham', 'Woodland',
   50.8841506, -1.2222867, 'ops-curated-batch1-2026-09:botley-woods'),
  ('open-spaces', 'Botley Road', 'Southampton', 'Public park',
   50.9016632, -1.3208246, 'ops-curated-batch1-2026-09:botley-road'),
  ('parks-trails', 'Thatchers Copse', 'Fareham', 'Woodland',
   50.828658, -1.2491656, 'ops-curated-batch1-2026-09:thatchers-copse'),
  ('open-spaces', 'Miller''s Pond', 'Southampton', 'Public park',
   50.8966234, -1.3611664, 'ops-curated-batch1-2026-09:millers-pond'),
  ('open-spaces', 'Southampton Common', 'Southampton', 'Public park',
   50.9283066, -1.4103651, 'ops-curated-batch1-2026-09:southampton-common'),
  ('open-spaces', 'Mountbatten Way Footpath', 'Southampton', 'Public park',
   50.9068363, -1.4171782, 'ops-curated-batch1-2026-09:mountbatten-way-footpath'),
  ('open-spaces', 'Fort Widley', 'Portsmouth', 'Public park',
   50.8543946, -1.0683243, 'ops-curated-batch1-2026-09:fort-widley'),
  ('open-spaces', 'Hilsea Lines', 'Portsmouth', 'Public park',
   50.8322367, -1.053074, 'ops-curated-batch1-2026-09:hilsea-lines'),
  ('parking', 'Billys lake car park', 'Waterlooville', 'Car park',
   50.8961194, -1.0441858, 'ops-curated-batch1-2026-09:billys-lake-car-park'),
  ('open-spaces', 'Eastney Beach Huts', 'Portsmouth', 'Public park',
   50.7865721, -1.0331823, 'ops-curated-batch1-2026-09:eastney-beach-huts'),
  ('parks-trails', 'Rock Gardens', 'Portsmouth', 'Public park',
   50.778863, -1.083239, 'ops-curated-batch1-2026-09:rock-gardens'),
  ('parking', 'Southsea Golf Social Club Carpark & Woods', 'Portsmouth', 'Car park',
   50.8147654, -1.0452395, 'ops-curated-batch1-2026-09:southsea-golf-carpark-woods'),
  ('parks-trails', 'Firestone copse', 'Ryde', 'Woodland',
   50.7168647, -1.2113032, 'ops-curated-batch1-2026-09:firestone-copse'),
  ('parks-trails', 'Parkhurst Forest', 'Newport', 'Woodland',
   50.7170413, -1.3325544, 'ops-curated-batch1-2026-09:parkhurst-forest'),
  ('open-spaces', 'St. Catherine''s Hill', 'Winchester', 'Public park',
   51.0463148, -1.3107596, 'ops-curated-batch1-2026-09:st-catherines-hill'),
  ('open-spaces', 'Whiteshute Ridge', 'Winchester', 'Public park',
   51.0468352, -1.3332291, 'ops-curated-batch1-2026-09:whiteshute-ridge'),
  ('parks-trails', 'Havant Thicket', 'Havant', 'Woodland',
   50.8914944, -0.9848104, 'ops-curated-batch1-2026-09:havant-thicket'),
  ('parks-trails', 'Sarum Road Woods', 'Winchester', 'Woodland',
   51.0600652, -1.3443905, 'ops-curated-batch1-2026-09:sarum-road-woods'),
  ('open-spaces', 'St Georges Down', 'Newport', 'Public park',
   50.6766741, -1.2632784, 'ops-curated-batch1-2026-09:st-georges-down'),
  ('parks-trails', 'A337 Cadnam To Lyndhurst Road at Shave Wood', 'Lyndhurst', 'Woodland',
   50.9096735, -1.5865635, 'ops-curated-batch1-2026-09:shave-wood-a337'),
  ('open-spaces', 'Culver Downs', 'Sandown', 'Public park',
   50.6663459, -1.1007973, 'ops-curated-batch1-2026-09:culver-downs'),
  ('parking', 'Milkham Car Park', 'Ringwood', 'Car park',
   50.8909039, -1.6929424, 'ops-curated-batch1-2026-09:milkham-car-park')
  ) AS v(cat_slug, name, city, description, lat, lng, external_id)
    ON c.slug = v.cat_slug
 WHERE hs.source = 'ops-curated'
   AND hs.external_id = v.external_id;
