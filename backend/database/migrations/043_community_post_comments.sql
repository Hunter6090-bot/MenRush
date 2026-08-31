-- 043_community_post_comments.sql
-- Comments on Community posts — text only (≤280), free for all.
-- Idempotent: safe to run multiple times.

CREATE TABLE IF NOT EXISTS community_post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body VARCHAR(280) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT community_post_comments_body_len
    CHECK (char_length(trim(body)) >= 1 AND char_length(body) <= 280)
);

CREATE INDEX IF NOT EXISTS idx_community_post_comments_post_created
  ON community_post_comments (post_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_community_post_comments_user_created
  ON community_post_comments (user_id, created_at DESC);
