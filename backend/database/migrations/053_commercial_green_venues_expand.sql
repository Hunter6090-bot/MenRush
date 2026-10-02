-- Zoul GREEN commercial venue expand (2026-09).
-- Seeds 25 hand-verified licensed commercial venues for Cruise / Hot Spots.
-- Keep-list (Sweatbox Soho, Pleasuredrome, Brighton Sauna, Pipeworks Glasgow) untouched.
-- AMBER / RED / outdoor / closed / Redruth HOLD intentionally omitted.
-- Copy = name + type + area only (description NULL). Never invent lat/lng.
-- Coords: venue site address + Ordnance Code-Point and/or OSM named POI matching venue.
-- Soft-refresh path: npm run hotspots:seed-commercial -- --file ./data/commercial-venues.green-expand-2026-09.json

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
  ('saunas', 'Covent Garden Health Spa', 'London', 'England', 'sauna',
   'https://www.cghspa.uk/', 51.5144751, -0.1246798,
   'green-2026-09:cgh-spa-london', '2026-09-11T12:00:00Z'),
  ('saunas', 'Sailors Health Club', 'London', 'England', 'sauna',
   'https://sailorshealthclub.com/', 51.5126358, -0.0403458,
   'green-2026-09:sailors-limehouse', '2026-09-11T12:00:00Z'),
  ('saunas', 'The Locker Room', 'London', 'England', 'sauna',
   'https://lockerroomsauna.co.uk/', 51.4883427, -0.1105585,
   'green-2026-09:locker-room-kennington', '2026-09-11T12:00:00Z'),
  ('bars', 'Eagle London', 'London', 'England', 'bar',
   'https://www.eaglelondon.com/', 51.4862934, -0.1192937,
   'green-2026-09:eagle-london', '2026-09-11T12:00:00Z'),
  ('saunas', 'Basement Complex', 'Manchester', 'England', 'sauna',
   'https://www.basementmanchester.com/', 53.4814791, -2.2313293,
   'green-2026-09:basement-manchester', '2026-09-11T12:00:00Z'),
  ('saunas', 'Dolphin Sauna', 'New Brighton', 'England', 'sauna',
   'https://www.dolphinsauna.co.uk/', 53.4345635, -3.0533265,
   'green-2026-09:dolphin-new-brighton', '2026-09-11T12:00:00Z'),
  ('saunas', 'Sauna Sauna', 'Northwich', 'England', 'sauna',
   'https://www.saunasauna.co.uk/', 53.2678755, -2.5367846,
   'green-2026-09:sauna-sauna-northwich', '2026-09-11T12:00:00Z'),
  ('saunas', 'Sweat Sauna', 'Carlisle', 'England', 'sauna',
   'https://www.carlislegaysauna.co.uk/', 54.8874225, -2.9424496,
   'green-2026-09:sweat-carlisle', '2026-09-11T12:00:00Z'),
  ('nightlife', 'Cruz 101', 'Manchester', 'England', 'nightlife',
   'https://cruz101.com/', 53.4772188, -2.2396365,
   'green-2026-09:cruz-101-manchester', '2026-09-11T12:00:00Z'),
  ('saunas', 'Heroes Health Club', 'Stourbridge', 'England', 'sauna',
   'https://www.heroessauna.co.uk/', 52.4599872, -2.1487343,
   'green-2026-09:heroes-stourbridge', '2026-09-11T12:00:00Z'),
  ('saunas', 'ME1 Sauna & Steam', 'Rochester', 'England', 'sauna',
   'https://www.me1sauna.co.uk/', 51.38394, 0.514793,
   'green-2026-09:me1-rochester', '2026-09-11T12:00:00Z'),
  ('saunas', 'Tropics Day Spa', 'Portsmouth', 'England', 'sauna',
   'http://www.stickywilly.co.uk/', 50.8035933, -1.0881303,
   'green-2026-09:tropics-portsmouth', '2026-09-11T12:00:00Z'),
  ('bars', 'Affinity Bar', 'Brighton', 'England', 'bar',
   'https://affinitygaybar.co.uk/', 50.8209675, -0.1361202,
   'green-2026-09:affinity-brighton', '2026-09-11T12:00:00Z'),
  ('saunas', 'The Pipeworks Leeds', 'Leeds', 'England', 'sauna',
   'https://thepipeworks.com/leeds', 53.7982128, -1.5453064,
   'green-2026-09:pipeworks-leeds', '2026-09-11T12:00:00Z'),
  ('saunas', 'Plastic Ivy', 'Dewsbury', 'England', 'sauna',
   'https://www.plasticivy.co.uk/', 53.693535, -1.6242,
   'green-2026-09:plastic-ivy-dewsbury', '2026-09-11T12:00:00Z'),
  ('saunas', 'ClubZeus Sheffield', 'Sheffield', 'England', 'sauna',
   'https://www.clubzeus.co.uk/sheffield', 53.3954432, -1.4437824,
   'green-2026-09:clubzeus-sheffield', '2026-09-11T12:00:00Z'),
  ('saunas', 'ClubZeus Mansfield', 'Mansfield', 'England', 'sauna',
   'https://www.clubzeus.co.uk/mansfield', 53.1425734, -1.1879073,
   'green-2026-09:clubzeus-mansfield', '2026-09-11T12:00:00Z'),
  ('cinema', 'Empire Cinema Club', 'Huddersfield', 'England', 'cinema',
   'https://www.empirecinemaclub.com/', 53.6495741, -1.783141,
   'green-2026-09:empire-cinema-huddersfield', '2026-09-11T12:00:00Z'),
  ('saunas', 'Manticore Spa', 'Plymouth', 'England', 'sauna',
   'https://www.manticorespa.com/', 50.3702868, -4.1470462,
   'green-2026-09:manticore-plymouth', '2026-09-11T12:00:00Z'),
  ('saunas', 'Steamer Quay', 'Torquay', 'England', 'sauna',
   'https://www.steamer-quay.co.uk/', 50.4642916, -3.5272361,
   'green-2026-09:steamer-quay-torquay', '2026-09-11T12:00:00Z'),
  ('saunas', 'SaunaBar', 'Bournemouth', 'England', 'sauna',
   'https://www.gaysaunabournemouth.co.uk/', 50.7195996, -1.8856001,
   'green-2026-09:saunabar-bournemouth', '2026-09-11T12:00:00Z'),
  ('saunas', 'Touch Sauna', 'Swindon', 'England', 'sauna',
   'https://www.touchsauna.com/', 51.5629184, -1.7868578,
   'green-2026-09:touch-swindon', '2026-09-11T12:00:00Z'),
  ('saunas', 'Splash Spa', 'Leicester', 'England', 'sauna',
   'https://splashleisure.co.uk/', 52.6398586, -1.1290928,
   'green-2026-09:splash-leicester', '2026-09-11T12:00:00Z'),
  ('saunas', 'Number 52 Sauna', 'Newcastle', 'England', 'sauna',
   'https://www.number52sauna.co.uk/', 54.9666149, -1.6230143,
   'green-2026-09:number-52-newcastle', '2026-09-11T12:00:00Z'),
  ('saunas', 'Steamworks', 'Edinburgh', 'Scotland', 'sauna',
   'https://planetbaredinburgh.co.uk/steamworks-sauna-edinburgh/', 55.9575428, -3.1923972,
   'green-2026-09:steamworks-edinburgh', '2026-09-11T12:00:00Z')
) AS v(cat_slug, name, city, nation, venue_type, source_url, lat, lng, external_id, verified_at)
  ON c.slug = v.cat_slug
 AND c.is_commercial = TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM hot_spots hs
   WHERE hs.source = 'ops-commercial'
     AND hs.external_id = v.external_id
);

-- Idempotent refresh when re-applied after JSON seed (match on source+external_id).
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
  ('saunas', 'Covent Garden Health Spa', 'London', 'England', 'sauna',
   'https://www.cghspa.uk/', 51.5144751, -0.1246798,
   'green-2026-09:cgh-spa-london', '2026-09-11T12:00:00Z'),
  ('saunas', 'Sailors Health Club', 'London', 'England', 'sauna',
   'https://sailorshealthclub.com/', 51.5126358, -0.0403458,
   'green-2026-09:sailors-limehouse', '2026-09-11T12:00:00Z'),
  ('saunas', 'The Locker Room', 'London', 'England', 'sauna',
   'https://lockerroomsauna.co.uk/', 51.4883427, -0.1105585,
   'green-2026-09:locker-room-kennington', '2026-09-11T12:00:00Z'),
  ('bars', 'Eagle London', 'London', 'England', 'bar',
   'https://www.eaglelondon.com/', 51.4862934, -0.1192937,
   'green-2026-09:eagle-london', '2026-09-11T12:00:00Z'),
  ('saunas', 'Basement Complex', 'Manchester', 'England', 'sauna',
   'https://www.basementmanchester.com/', 53.4814791, -2.2313293,
   'green-2026-09:basement-manchester', '2026-09-11T12:00:00Z'),
  ('saunas', 'Dolphin Sauna', 'New Brighton', 'England', 'sauna',
   'https://www.dolphinsauna.co.uk/', 53.4345635, -3.0533265,
   'green-2026-09:dolphin-new-brighton', '2026-09-11T12:00:00Z'),
  ('saunas', 'Sauna Sauna', 'Northwich', 'England', 'sauna',
   'https://www.saunasauna.co.uk/', 53.2678755, -2.5367846,
   'green-2026-09:sauna-sauna-northwich', '2026-09-11T12:00:00Z'),
  ('saunas', 'Sweat Sauna', 'Carlisle', 'England', 'sauna',
   'https://www.carlislegaysauna.co.uk/', 54.8874225, -2.9424496,
   'green-2026-09:sweat-carlisle', '2026-09-11T12:00:00Z'),
  ('nightlife', 'Cruz 101', 'Manchester', 'England', 'nightlife',
   'https://cruz101.com/', 53.4772188, -2.2396365,
   'green-2026-09:cruz-101-manchester', '2026-09-11T12:00:00Z'),
  ('saunas', 'Heroes Health Club', 'Stourbridge', 'England', 'sauna',
   'https://www.heroessauna.co.uk/', 52.4599872, -2.1487343,
   'green-2026-09:heroes-stourbridge', '2026-09-11T12:00:00Z'),
  ('saunas', 'ME1 Sauna & Steam', 'Rochester', 'England', 'sauna',
   'https://www.me1sauna.co.uk/', 51.38394, 0.514793,
   'green-2026-09:me1-rochester', '2026-09-11T12:00:00Z'),
  ('saunas', 'Tropics Day Spa', 'Portsmouth', 'England', 'sauna',
   'http://www.stickywilly.co.uk/', 50.8035933, -1.0881303,
   'green-2026-09:tropics-portsmouth', '2026-09-11T12:00:00Z'),
  ('bars', 'Affinity Bar', 'Brighton', 'England', 'bar',
   'https://affinitygaybar.co.uk/', 50.8209675, -0.1361202,
   'green-2026-09:affinity-brighton', '2026-09-11T12:00:00Z'),
  ('saunas', 'The Pipeworks Leeds', 'Leeds', 'England', 'sauna',
   'https://thepipeworks.com/leeds', 53.7982128, -1.5453064,
   'green-2026-09:pipeworks-leeds', '2026-09-11T12:00:00Z'),
  ('saunas', 'Plastic Ivy', 'Dewsbury', 'England', 'sauna',
   'https://www.plasticivy.co.uk/', 53.693535, -1.6242,
   'green-2026-09:plastic-ivy-dewsbury', '2026-09-11T12:00:00Z'),
  ('saunas', 'ClubZeus Sheffield', 'Sheffield', 'England', 'sauna',
   'https://www.clubzeus.co.uk/sheffield', 53.3954432, -1.4437824,
   'green-2026-09:clubzeus-sheffield', '2026-09-11T12:00:00Z'),
  ('saunas', 'ClubZeus Mansfield', 'Mansfield', 'England', 'sauna',
   'https://www.clubzeus.co.uk/mansfield', 53.1425734, -1.1879073,
   'green-2026-09:clubzeus-mansfield', '2026-09-11T12:00:00Z'),
  ('cinema', 'Empire Cinema Club', 'Huddersfield', 'England', 'cinema',
   'https://www.empirecinemaclub.com/', 53.6495741, -1.783141,
   'green-2026-09:empire-cinema-huddersfield', '2026-09-11T12:00:00Z'),
  ('saunas', 'Manticore Spa', 'Plymouth', 'England', 'sauna',
   'https://www.manticorespa.com/', 50.3702868, -4.1470462,
   'green-2026-09:manticore-plymouth', '2026-09-11T12:00:00Z'),
  ('saunas', 'Steamer Quay', 'Torquay', 'England', 'sauna',
   'https://www.steamer-quay.co.uk/', 50.4642916, -3.5272361,
   'green-2026-09:steamer-quay-torquay', '2026-09-11T12:00:00Z'),
  ('saunas', 'SaunaBar', 'Bournemouth', 'England', 'sauna',
   'https://www.gaysaunabournemouth.co.uk/', 50.7195996, -1.8856001,
   'green-2026-09:saunabar-bournemouth', '2026-09-11T12:00:00Z'),
  ('saunas', 'Touch Sauna', 'Swindon', 'England', 'sauna',
   'https://www.touchsauna.com/', 51.5629184, -1.7868578,
   'green-2026-09:touch-swindon', '2026-09-11T12:00:00Z'),
  ('saunas', 'Splash Spa', 'Leicester', 'England', 'sauna',
   'https://splashleisure.co.uk/', 52.6398586, -1.1290928,
   'green-2026-09:splash-leicester', '2026-09-11T12:00:00Z'),
  ('saunas', 'Number 52 Sauna', 'Newcastle', 'England', 'sauna',
   'https://www.number52sauna.co.uk/', 54.9666149, -1.6230143,
   'green-2026-09:number-52-newcastle', '2026-09-11T12:00:00Z'),
  ('saunas', 'Steamworks', 'Edinburgh', 'Scotland', 'sauna',
   'https://planetbaredinburgh.co.uk/steamworks-sauna-edinburgh/', 55.9575428, -3.1923972,
   'green-2026-09:steamworks-edinburgh', '2026-09-11T12:00:00Z')
  ) AS v(cat_slug, name, city, nation, venue_type, source_url, lat, lng, external_id, verified_at)
    ON c.slug = v.cat_slug AND c.is_commercial = TRUE
 WHERE hs.source = 'ops-commercial'
   AND hs.external_id = v.external_id;

-- Keep-list must remain active (do not deactivate).
UPDATE hot_spots
   SET is_active = TRUE
 WHERE is_user_generated = FALSE
   AND (
     (city = 'London' AND name = 'Sweatbox Soho')
     OR (city = 'London' AND name = 'Pleasuredrome')
     OR (city = 'Brighton' AND name = 'The Brighton Sauna')
     OR (city = 'Glasgow' AND name = 'The Pipeworks Glasgow')
   );
