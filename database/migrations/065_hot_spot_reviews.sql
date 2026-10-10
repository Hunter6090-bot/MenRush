-- Migration 065: Hot spot reviews (1-5 rating + short text)
-- Allows community feedback and ratings on commercial and outdoor cruising spots.
-- Supports anonymous reviews for discretion.
-- One review per user per spot (upsertable).

CREATE TABLE IF NOT EXISTS hot_spot_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spot_id UUID NOT NULL REFERENCES hot_spots(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  body TEXT NOT NULL,
  is_anonymous BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_hot_spot_reviews_user_spot UNIQUE (spot_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_hot_spot_reviews_spot ON hot_spot_reviews (spot_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hot_spot_reviews_user ON hot_spot_reviews (user_id);
