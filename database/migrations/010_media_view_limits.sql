-- Disappearing media: move from a time-based 10s burn to an explicit
-- view-count model (Telegram-style "view once / N views / permanent").
--
--   max_views   NULL  -> permanent (kept in the conversation)
--               N>=1  -> disappearing, allows N recipient views
--   view_count        -> number of views the recipient has actually consumed
--                        (incremented only after the image loaded & was shown)
--
-- A disappearing image is "exhausted" once view_count >= max_views, after
-- which the media endpoint stops serving it and the row is scrubbed.

ALTER TABLE messages ADD COLUMN IF NOT EXISTS max_views INT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS view_count INT NOT NULL DEFAULT 0;

-- Backfill legacy disappearing images (created under the old 10s-burn model)
-- so they keep "view once" semantics rather than silently becoming permanent.
UPDATE messages
   SET max_views = 1
 WHERE media_type = 'image'
   AND is_disappearing = TRUE
   AND max_views IS NULL;

-- Legacy rows whose burn window already elapsed are treated as already viewed.
UPDATE messages
   SET view_count = 1
 WHERE media_type = 'image'
   AND is_disappearing = TRUE
   AND max_views IS NOT NULL
   AND view_count = 0
   AND expires_at IS NOT NULL
   AND expires_at <= NOW();
