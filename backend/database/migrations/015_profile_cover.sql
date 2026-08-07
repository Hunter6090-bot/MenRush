-- Profile header cover image (behind avatar on profile pages)
ALTER TABLE users ADD COLUMN IF NOT EXISTS cover_url TEXT;
