ALTER TABLE album_photos
  ADD COLUMN IF NOT EXISTS storage_key TEXT,
  ADD COLUMN IF NOT EXISTS mime_type TEXT;

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS media_storage_key TEXT,
  ADD COLUMN IF NOT EXISTS media_mime_type TEXT;

UPDATE album_photos
SET storage_key = regexp_replace(photo_url, '^/uploads/albums/', ''),
    mime_type = CASE
      WHEN lower(photo_url) ~ '\.png$' THEN 'image/png'
      WHEN lower(photo_url) ~ '\.webp$' THEN 'image/webp'
      ELSE 'image/jpeg'
    END,
    photo_url = '/api/albums/media/' || id
WHERE storage_key IS NULL
  AND photo_url LIKE '/uploads/albums/%';

UPDATE messages
SET media_storage_key = regexp_replace(media_url, '^/uploads/messages/', ''),
    media_mime_type = CASE
      WHEN lower(media_url) ~ '\.png$' THEN 'image/png'
      WHEN lower(media_url) ~ '\.webp$' THEN 'image/webp'
      WHEN lower(media_url) ~ '\.ogg$' THEN 'audio/ogg'
      WHEN lower(media_url) ~ '\.mp3$' THEN 'audio/mpeg'
      WHEN lower(media_url) ~ '\.(m4a|mp4)$' THEN 'audio/mp4'
      WHEN lower(media_url) ~ '\.webm$' THEN 'audio/webm'
      ELSE 'image/jpeg'
    END,
    media_url = '/api/messages/' || id || '/media'
WHERE media_storage_key IS NULL
  AND media_url LIKE '/uploads/messages/%';

CREATE INDEX IF NOT EXISTS idx_album_photos_storage_key
  ON album_photos(storage_key)
  WHERE storage_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_media_storage_key
  ON messages(media_storage_key)
  WHERE media_storage_key IS NOT NULL;
