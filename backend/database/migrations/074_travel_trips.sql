-- Travel (Al, 10 Oct 2026). Premium.
--   Look around: browse another UK or Ireland town or city. Stores nothing.
--   Plan a trip: one trip per member at a time. From starts_at until ends_at the
--   member shows in the destination as "Visiting <city>" at the city centre
--   (a coarse point, never a precise one) and is left out at home.
-- A trip ends when the member ends it (ended_at) or when ends_at passes. No job
-- is needed: every read checks the window.

CREATE TABLE IF NOT EXISTS travel_trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  city_name TEXT NOT NULL,
  country_code TEXT NOT NULL CHECK (country_code IN ('gb', 'ie')),
  -- City centre, rounded to 2 decimal places (about 1 km). Never a member's GPS.
  centre_lat DOUBLE PRECISION NOT NULL,
  centre_lng DOUBLE PRECISION NOT NULL,
  -- City bounding box, so Look around on that city can include visitors.
  south DOUBLE PRECISION NOT NULL,
  north DOUBLE PRECISION NOT NULL,
  west DOUBLE PRECISION NOT NULL,
  east DOUBLE PRECISION NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT travel_trips_window CHECK (ends_at > starts_at),
  CONSTRAINT travel_trips_max_length CHECK (ends_at - starts_at <= INTERVAL '15 days')
);

-- One open trip per member. Planning a new trip ends the old one first.
CREATE UNIQUE INDEX IF NOT EXISTS idx_travel_trips_one_open
  ON travel_trips (user_id) WHERE ended_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_travel_trips_window
  ON travel_trips (starts_at, ends_at) WHERE ended_at IS NULL;

-- "Show me to people looking around". On by default. Off: members using
-- Look around on this member's area do not see them there. Nearby is unchanged.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS show_in_look_around BOOLEAN NOT NULL DEFAULT TRUE;
