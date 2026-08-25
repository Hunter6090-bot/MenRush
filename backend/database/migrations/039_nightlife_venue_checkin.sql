-- Nightlife venue check-in: short-lived Hot Spot pins linked to Events.
-- Check-ins expire after 4 hours (see ACTIVE_CHECKIN_TTL_HOURS in hot-spots.service.ts).
-- Free for all users. Promote Your Event remains Premium (frontend gate).

INSERT INTO hot_spot_categories (slug, name, icon, description, sort_order)
VALUES ('nightlife', 'Nightlife', '🪩', 'Clubs, bars and live events', 7)
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE hot_spots
  ADD COLUMN IF NOT EXISTS event_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS idx_hot_spots_event
  ON hot_spots (event_id)
  WHERE event_id IS NOT NULL;
