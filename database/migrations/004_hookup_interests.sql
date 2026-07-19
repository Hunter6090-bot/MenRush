-- Replace the wholesome lifestyle seed (Travel/Music/Coffee/Skateboarding/etc.)
-- with hookup-relevant tribes, positions, body types, and intent tags.
-- users.interests (TEXT[]) entries that no longer exist in the lookup table
-- still display on profiles; they just stop being recommended in the chip picker.

DELETE FROM interests;

INSERT INTO interests (name) VALUES
  -- Position
  ('Top'),('Vers Top'),('Vers'),('Vers Bottom'),('Bottom'),('Side'),
  -- Tribes
  ('Twink'),('Twunk'),('Otter'),('Bear'),('Cub'),('Daddy'),('Wolf'),('Jock'),('Leather'),('Rugged'),('Geek'),
  -- Body
  ('Slim'),('Athletic'),('Muscular'),('Stocky'),('Chubby'),('Hairy'),('Smooth'),('Tatted'),
  -- Looking for / availability
  ('NSA'),('Hookup'),('Casual'),('Dating'),('FWB'),('Discreet'),('Hosting'),('Can Travel'),('Right Now'),
  -- Vibe / play style
  ('Kinky'),('Vanilla'),('Open'),('Sober'),('PnP-Free'),('Verified Only')
ON CONFLICT (name) DO NOTHING;
