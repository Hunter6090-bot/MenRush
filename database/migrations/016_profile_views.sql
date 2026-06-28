-- Track who opened another member's profile (for "Who viewed you").
CREATE TABLE IF NOT EXISTS profile_views (
  viewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewed_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (viewer_id, viewed_user_id),
  CHECK (viewer_id <> viewed_user_id)
);

CREATE INDEX IF NOT EXISTS idx_profile_views_viewed_user
  ON profile_views (viewed_user_id, viewed_at DESC);
