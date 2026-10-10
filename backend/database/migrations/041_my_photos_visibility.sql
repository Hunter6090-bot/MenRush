-- My Photos: per-photo discretion (public / view_once / private).
--
-- MEDIA PROPERTY LOCK (Owner / Zoul — non-negotiable):
--   We are not going to lose anyone's property. Profile picture, cover picture,
--   albums, and album photos already on an account stay as they had them.
--   Nobody is asked to re-upload.
--   This migration must NOT DELETE or NULL users.photo_url, cover_url,
--   album_photos rows, or files on disk.
--   Revoke stays VIEWERS ONLY (album_grants only) — see album.service revokeAllAccess.
--
-- Backfill (preserve what people already posted):
--   existing photos on an UNLOCKED album → visibility = 'public'  (stay on public grid)
--   existing photos on a LOCKED album   → visibility = 'private' (stay in private album)
--   Do NOT default existing rows to private if that would hide unlocked posts.
--   New uploads may still choose public / view_once / private.
-- DISCREET_MEDIA_BLUR stays opt-in (default off); view-once blur is per-photo.

-- Add nullable first so we can backfill before NOT NULL (never hide unlocked posts).
ALTER TABLE album_photos
  ADD COLUMN IF NOT EXISTS visibility TEXT;

-- Backfill from album lock state. Also repairs an earlier draft that DEFAULT'd
-- everything to 'private' (unlocked album photos wrongly hidden).
-- Does not touch view_once rows once set; only NULL or wrongly-private-on-unlocked.
UPDATE album_photos p
SET visibility = CASE
  WHEN a.is_locked THEN 'private'
  ELSE 'public'
END
FROM albums a
WHERE a.id = p.album_id
  AND (
    p.visibility IS NULL
    OR (p.visibility = 'private' AND a.is_locked = false)
  );

-- Orphans without an album join (should not exist) — keep private, do not delete.
UPDATE album_photos
SET visibility = 'private'
WHERE visibility IS NULL;

-- New inserts without an explicit visibility default to private; existing rows are set.
ALTER TABLE album_photos
  ALTER COLUMN visibility SET DEFAULT 'private';

ALTER TABLE album_photos
  ALTER COLUMN visibility SET NOT NULL;

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
-- Never used to delete the owner's photo.
CREATE TABLE IF NOT EXISTS album_photo_views (
  photo_id UUID NOT NULL REFERENCES album_photos(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewed_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (photo_id, viewer_id)
);

CREATE INDEX IF NOT EXISTS idx_album_photo_views_viewer
  ON album_photo_views (viewer_id);
