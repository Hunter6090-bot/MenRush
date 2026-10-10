-- "Hide my location from" list (Pete via Quality Check, 8 Oct 2026). Anti-stalking.
-- owner_id hides their location from hidden_user_id: the owner drops out of that
-- person's Nearby roster, map pins, map feed, Community feed and search by town,
-- and a direct profile view carries no distance. Chat is not affected.
-- Adding is Premium (checked in the API). Removing is always allowed.

CREATE TABLE IF NOT EXISTS location_hidden_from (
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hidden_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (owner_id, hidden_user_id),
  CONSTRAINT location_hidden_from_not_self CHECK (owner_id <> hidden_user_id)
);

-- Viewer-side lookups ("does anyone hide from me?") in Nearby / map / search.
CREATE INDEX IF NOT EXISTS idx_location_hidden_from_hidden_user
  ON location_hidden_from (hidden_user_id, owner_id);
