CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  age INT NOT NULL,
  bio TEXT,
  photo_url TEXT,
  interests TEXT[] DEFAULT '{}',
  headline TEXT,
  looking_for TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  location GEOGRAPHY(POINT, 4326),
  lat DECIMAL(10, 8),
  lng DECIMAL(11, 8),
  online BOOLEAN DEFAULT false,
  last_seen TIMESTAMP DEFAULT NOW(),
  is_visible BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE messages (
  id UUID PRIMARY KEY,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  liker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  liked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(liker_id, liked_id)
);

CREATE INDEX idx_profiles_location ON profiles USING GIST(location);
CREATE INDEX idx_profiles_online ON profiles(online);
CREATE INDEX idx_profiles_visible ON profiles(is_visible);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_receiver ON messages(receiver_id);
CREATE INDEX idx_messages_created ON messages(created_at);
CREATE INDEX idx_messages_thread ON messages(sender_id, receiver_id, created_at);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_likes_liker ON likes(liker_id);
CREATE INDEX idx_likes_liked ON likes(liked_id);
CREATE INDEX idx_likes_mutual ON likes(liker_id, liked_id);

CREATE TABLE IF NOT EXISTS interests (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL
);

INSERT INTO interests (name) VALUES
  ('Travel'),('Music'),('Food'),('Sports'),('Art'),('Technology'),
  ('Gaming'),('Photography'),('Fitness'),('Movies'),('Books'),('Cooking'),
  ('Dancing'),('Hiking'),('Coffee'),('Fashion'),('Yoga'),('Skateboarding'),
  ('Climbing'),('Cycling'),('Running'),('Swimming'),('Surfing'),('Dogs'),('Cats')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  avatar_url TEXT,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  is_location_based BOOLEAN DEFAULT false,
  location GEOGRAPHY(POINT, 4326),
  lat DECIMAL(10, 8),
  lng DECIMAL(11, 8),
  max_members INT DEFAULT 50,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS room_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'member',
  joined_at TIMESTAMP DEFAULT NOW(),
  last_read_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);

CREATE TABLE IF NOT EXISTS room_messages (
  id UUID PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  reply_to UUID REFERENCES room_messages(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_room_members_room ON room_members(room_id);
CREATE INDEX IF NOT EXISTS idx_room_members_user ON room_members(user_id);
CREATE INDEX IF NOT EXISTS idx_room_messages_room ON room_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_room_messages_created ON room_messages(room_id, created_at);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);

-- ─── Waitlist + drip campaign ──────────────────────────────────────────────
-- Waitlist signups + a self-hosted drip workflow that emails subscribers a
-- 9-step pre-launch sequence. See docs/self-hosted-drip.md.
-- `CREATE TABLE waitlist` mirrors database/migrations/001_waitlist.sql so
-- fresh databases get the table from schema.sql alone.

CREATE TABLE IF NOT EXISTS waitlist (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS unsubscribe_token TEXT UNIQUE;
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS unsubscribed_at TIMESTAMP;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'waitlist_status_chk'
  ) THEN
    ALTER TABLE waitlist ADD CONSTRAINT waitlist_status_chk
      CHECK (status IN ('active', 'unsubscribed', 'bounced'));
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_waitlist_status_created
  ON waitlist(status, created_at)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS waitlist_drip_sends (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id   UUID NOT NULL REFERENCES waitlist(id) ON DELETE CASCADE,
  template_key    TEXT NOT NULL,
  sent_at         TIMESTAMP NOT NULL DEFAULT NOW(),
  smtp_message_id TEXT,
  UNIQUE (subscriber_id, template_key)
);

CREATE INDEX IF NOT EXISTS idx_drip_sends_subscriber
  ON waitlist_drip_sends(subscriber_id);
