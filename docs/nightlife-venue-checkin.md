# Nightlife venue check-in

UK-first Events ↔ Hot Spots bridge. Users check in at a venue from **Events** or
the Discover map Hot Spot sheet. A temporary pin appears on the map using the
existing Hot Spots data shape.

## Behaviour

| Rule | Detail |
| --- | --- |
| TTL | **4 hours** (`ACTIVE_CHECKIN_TTL_HOURS` in `backend/src/services/hot-spots.service.ts`) |
| Check-in | Free for all verified users |
| Promote Your Event | Premium only (`/premium` redirect when not Premium) |
| Pin content | Venue name + approximate check-in count (`live_count` rounded for Free) |
| Shape | Reuses `HotSpotDTO` with `checkin_ttl_hours` + `has_active_checkins` |

## API

- `POST /api/events/:id/check-in` `{ anonymous?: boolean }` → `{ ok, spot }`
- Existing `POST /api/hot-spots/:id/check-in` unchanged (map sheet / Hot Spots page)

Event check-in finds an existing Hot Spot within ~80 m of the venue, or creates a
user-generated nightlife pin linked via `hot_spots.event_id`.

## Migration

`040_nightlife_venue_checkin.sql` — nightlife category + `event_id` column.

## Copy guardrails

- No public marketing claim that venue check-in is “live” (Coming Soon / landing).
- In-app copy refers to temporary map pins / check-ins, not a public live product.
- Rooms remain closed to the public before 1 October 2026 — this feature does not
  invent live rooms or a US launch.
