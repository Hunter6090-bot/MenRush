-- Brand-signed Profile extras (8 Sep 2026): Map photo + Hosting options.
-- Media property lock: do not DELETE/NULL other users' photo_url, cover_url, or album_photos.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS map_photo_url TEXT;

-- Remap legacy hosting_status values → Brand options before tightening CHECK.
UPDATE users
SET hosting_status = CASE hosting_status
  WHEN 'Hosting' THEN 'Hosting now'
  WHEN 'Travelling' THEN 'Not hosting'
  WHEN 'Public only' THEN 'Not hosting'
  WHEN 'Depends' THEN 'Can host'
  ELSE hosting_status
END
WHERE hosting_status IN ('Hosting', 'Travelling', 'Public only', 'Depends');

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_hosting_status_chk;

ALTER TABLE users
  ADD CONSTRAINT users_hosting_status_chk
  CHECK (
    hosting_status IS NULL OR hosting_status IN (
      'Not hosting', 'Can host', 'Hosting now'
    )
  );
