-- migrate.sql
--
-- Purpose: Idempotent migration for databases that were created with an older
--          version of schema.sql. It adds every column, index, table, and seed
--          row that was introduced after the initial schema was deployed.
--
-- When to run:
--   - Run this file against any existing NearNow database to bring it up to
--     date with the current schema.sql without dropping or recreating anything.
--   - Do NOT run this on a brand-new database. For fresh installs, apply
--     schema.sql directly via `npm run db:migrate` (from backend/) instead.
--
-- Safety:
--   - Every statement uses IF NOT EXISTS, DO $$ EXCEPTION blocks, or
--     ON CONFLICT DO NOTHING, so the file is safe to run multiple times.
--
-- Usage:
--   psql "$DATABASE_URL" -f database/migrate.sql


-- ============================================================
-- users table: new columns
-- ============================================================

DO $$ BEGIN
  ALTER TABLE users ADD COLUMN headline TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE users ADD COLUMN looking_for TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE users ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;


-- ============================================================
-- profiles table: new columns
-- ============================================================

DO $$ BEGIN
  ALTER TABLE profiles ADD COLUMN is_visible BOOLEAN DEFAULT true;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE profiles ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;


-- ============================================================
-- New indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_profiles_visible ON profiles(is_visible);

CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(sender_id, receiver_id, created_at);

CREATE INDEX IF NOT EXISTS idx_likes_mutual ON likes(liker_id, liked_id);


-- ============================================================
-- interests table + seed data
-- ============================================================

CREATE TABLE IF NOT EXISTS interests (
  id   SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL
);

INSERT INTO interests (name) VALUES
  ('Travel'),('Music'),('Food'),('Sports'),('Art'),('Technology'),
  ('Gaming'),('Photography'),('Fitness'),('Movies'),('Books'),('Cooking'),
  ('Dancing'),('Hiking'),('Coffee'),('Fashion'),('Yoga'),('Skateboarding'),
  ('Climbing'),('Cycling'),('Running'),('Swimming'),('Surfing'),('Dogs'),('Cats')
ON CONFLICT (name) DO NOTHING;
