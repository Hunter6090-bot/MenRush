-- 015_verification_id_metadata.sql
-- Document type, nationality, and licence back image for native verification.

ALTER TABLE verification_submissions
  ADD COLUMN IF NOT EXISTS id_type TEXT
    CHECK (id_type IS NULL OR id_type IN ('passport', 'driving_license'));

ALTER TABLE verification_submissions
  ADD COLUMN IF NOT EXISTS nationality TEXT;

ALTER TABLE verification_submissions
  ADD COLUMN IF NOT EXISTS id_back_key TEXT;
