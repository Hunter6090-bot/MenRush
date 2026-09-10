-- Brand-signed Profile extras (8 Sep 2026): Map photo + Hosting options.
-- Media property lock: do not DELETE/NULL other users' photo_url, cover_url, or album_photos.
-- Hotfix: remap EVERY non-Brand hosting_status (incl. Open + leftovers) before CHECK.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS map_photo_url TEXT;

-- Drop legacy/narrow CHECK first so remaps to Brand values are allowed.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_hosting_status_chk;

-- Remap every non-Brand hosting_status → Brand options. NULL stays NULL.
UPDATE users
SET hosting_status = CASE hosting_status
  WHEN 'Hosting' THEN 'Hosting now'
  WHEN 'Travelling' THEN 'Not hosting'
  WHEN 'Public only' THEN 'Not hosting'
  WHEN 'Depends' THEN 'Can host'
  WHEN 'Open' THEN 'Can host'
  ELSE 'Not hosting'
END
WHERE hosting_status IS NOT NULL
  AND hosting_status NOT IN ('Not hosting', 'Can host', 'Hosting now');

ALTER TABLE users
  ADD CONSTRAINT users_hosting_status_chk
  CHECK (
    hosting_status IS NULL OR hosting_status IN (
      'Not hosting', 'Can host', 'Hosting now'
    )
  );
