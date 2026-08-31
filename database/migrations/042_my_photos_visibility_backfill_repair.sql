-- Repair My Photos visibility backfill if 041 was applied with DEFAULT 'private'
-- (which hid existing unlocked-album photos). Idempotent. Never deletes media.
--
-- MEDIA PROPERTY LOCK: do not DELETE album_photos or touch users.photo_url / cover_url.
-- Unlocked album photos must stay public on the grid; locked stay private.

UPDATE album_photos p
SET visibility = 'public'
FROM albums a
WHERE a.id = p.album_id
  AND a.is_locked = false
  AND p.visibility = 'private';

-- Locked albums keep private (and view_once if already set — untouched here).
-- Assert intent in comments: photo counts must not drop; this UPDATE only flips visibility.
