-- Per-field Stats visibility (extend show_age). Hidden fields stay stored; public/nearby omit them.
-- Hosting visibility / label work is out of scope for this migration (separate Brand PR).

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS show_height BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS show_weight BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS show_relationship BOOLEAN NOT NULL DEFAULT TRUE;
