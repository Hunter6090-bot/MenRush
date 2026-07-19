-- Pan/zoom framing for profile cover photos (object-position + scale)
ALTER TABLE users ADD COLUMN IF NOT EXISTS cover_position_x REAL NOT NULL DEFAULT 50;
ALTER TABLE users ADD COLUMN IF NOT EXISTS cover_position_y REAL NOT NULL DEFAULT 50;
ALTER TABLE users ADD COLUMN IF NOT EXISTS cover_zoom REAL NOT NULL DEFAULT 1;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_cover_position_x_check;
ALTER TABLE users ADD CONSTRAINT users_cover_position_x_check
  CHECK (cover_position_x >= 0 AND cover_position_x <= 100);

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_cover_position_y_check;
ALTER TABLE users ADD CONSTRAINT users_cover_position_y_check
  CHECK (cover_position_y >= 0 AND cover_position_y <= 100);

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_cover_zoom_check;
ALTER TABLE users ADD CONSTRAINT users_cover_zoom_check
  CHECK (cover_zoom >= 1 AND cover_zoom <= 3);
