ALTER TABLE users
  ADD COLUMN IF NOT EXISTS secondary_photo_urls TEXT[] NOT NULL DEFAULT '{}';
