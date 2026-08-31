-- My Photos: per-photo discretion (public / view_once / private).
-- Revoke access is viewers-only — album_grants rows only; never wipe media.
-- DISCREET_MEDIA_BLUR stays an opt-in flag (default off); view-once blur is per-photo.

ALTER TABLE album_photos
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'album_photos_visibility_check'
  ) THEN
    ALTER TABLE album_photos
      ADD CONSTRAINT album_photos_visibility_check
      CHECK (visibility IN ('public', 'view_once', 'private'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_album_photos_user_visibility
  ON album_photos (user_id, visibility);

-- View-once opens: one row per viewer who opened the clear photo.
CREATE TABLE IF NOT EXISTS album_photo_views (
  photo_id UUID NOT NULL REFERENCES album_photos(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewed_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (photo_id, viewer_id)
);

CREATE INDEX IF NOT EXISTS idx_album_photo_views_viewer
  ON album_photo_views (viewer_id);
