-- Per-field Stats visibility (extend show_age). Hidden fields stay stored; public/nearby omit them.
-- Numbered 047 after #210 Map photo + Hosting Brand migration. Stats Show excludes Hosting.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS show_height BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS show_weight BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS show_relationship BOOLEAN NOT NULL DEFAULT TRUE;
