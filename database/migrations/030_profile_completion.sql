-- Full profile completion fields (dating-app parity).
-- DOB is the source of truth for age; height/weight/relationship/hosting/health are optional.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS height_cm INT,
  ADD COLUMN IF NOT EXISTS weight_kg INT,
  ADD COLUMN IF NOT EXISTS relationship_status TEXT,
  ADD COLUMN IF NOT EXISTS hosting_status TEXT,
  ADD COLUMN IF NOT EXISTS sexual_health_status TEXT,
  ADD COLUMN IF NOT EXISTS on_prep BOOLEAN,
  ADD COLUMN IF NOT EXISTS last_tested_at DATE,
  ADD COLUMN IF NOT EXISTS show_age BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS secondary_photo_urls TEXT[] NOT NULL DEFAULT '{}';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_height_cm_chk'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_height_cm_chk
      CHECK (height_cm IS NULL OR (height_cm >= 120 AND height_cm <= 250));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_weight_kg_chk'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_weight_kg_chk
      CHECK (weight_kg IS NULL OR (weight_kg >= 35 AND weight_kg <= 300));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_relationship_status_chk'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_relationship_status_chk
      CHECK (
        relationship_status IS NULL OR relationship_status IN (
          'Single', 'Taken', 'Open', 'Complicated', 'Prefer not to say'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_hosting_status_chk'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_hosting_status_chk
      CHECK (
        hosting_status IS NULL OR hosting_status IN (
          'Hosting', 'Travelling', 'Public only', 'Depends'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_sexual_health_status_chk'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_sexual_health_status_chk
      CHECK (
        sexual_health_status IS NULL OR sexual_health_status IN (
          'Negative', 'Positive', 'Undetectable', 'Prefer not to say'
        )
      );
  END IF;
END $$;
