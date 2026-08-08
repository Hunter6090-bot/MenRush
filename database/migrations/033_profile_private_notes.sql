-- Premium: private notes a viewer saves about another profile (only visible to the author).
CREATE TABLE IF NOT EXISTS profile_private_notes (
  viewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (viewer_id, target_id),
  CHECK (viewer_id <> target_id)
);

CREATE INDEX IF NOT EXISTS idx_profile_private_notes_viewer ON profile_private_notes(viewer_id);
