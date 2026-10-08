-- Jerk: one-tap nudge, stored apart from likes/matches (a jerk never creates a like or a match).
CREATE TABLE IF NOT EXISTS jerks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  seen_at TIMESTAMPTZ,
  CONSTRAINT jerks_no_self CHECK (from_user_id <> to_user_id)
);

-- Daily limit per sender (rolling 24h).
CREATE INDEX IF NOT EXISTS idx_jerks_from_created ON jerks (from_user_id, created_at DESC);
-- Repeat check for one pair inside 24h.
CREATE INDEX IF NOT EXISTS idx_jerks_pair_created ON jerks (from_user_id, to_user_id, created_at DESC);
-- Recipient unseen lookups.
CREATE INDEX IF NOT EXISTS idx_jerks_to_unseen ON jerks (to_user_id) WHERE seen_at IS NULL;

-- In-app notification type 'jerk'.
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (
  type IN (
    'message',
    'photo',
    'voice',
    'like',
    'match',
    'profile_view',
    'system',
    'missed_call',
    'jerk'
  )
);
