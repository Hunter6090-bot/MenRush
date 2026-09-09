# Commercial venue Hot Spots / Cruise

Brand face on the Nearby Map:

| Surface | Copy |
| --- | --- |
| Pin label | **Cruise** (cruise-ship icon) |
| Map chip | **Hot Spots** (same cruise-ship icon). No extra tab. |
| Helper | Commercial venues only. Saunas and gay venues. |
| Rules | Follow the venue's rules. MenRush does not run these places. |
| Check-in | Existing Check in / Check in anonymously / Check out (4h TTL) |

Spot layer ≠ live-user layer. Active / check-in counts only when real check-ins exist.

## Legal

**GREEN** — licensed saunas, clubs, bars, cinema clubs on private commercial premises.

**RED** — never scrape or seed outdoor PSE, cottaging, public toilets, parks, truck stops,
"known cruising spots", glory holes, outdoor play meets, or Social-play / Redruth until a
named verified private premises exists.

Source: venue-supplied data, permission/license, or hand-verified first-party curation only.
Do **not** scrape `gaysaunas.co.uk` or copy substantial competitor listings wholesale.
Do **not** invent lat/lng, hours, prices, partnership claims, or fake occupancy.

## Schema (migration `048`)

- `hot_spot_categories.is_commercial` — public filters only return commercial rows
- Commercial slugs: `saunas`, `nightlife`, `bars`, `cinema`
- Spot columns: `nation`, `venue_type`, `source_url`, `verified_at`
- Prior outdoor / park / transit / parking / rest-facility seeds are deactivated
- Tiny keep-list of prior first-party curated commercial names (London Sweatbox Soho,
  Pleasuredrome, The Brighton Sauna, The Pipeworks Glasgow) kept with existing coords.
  `verified_at` stays NULL until ops hand-verifies. No new coordinates invented.

## How ops adds venues (no scrape)

1. Hand-verify name, city, nation, type, and public website.
2. Obtain lat/lng from the venue (or from a permitted first-party map listing). Never invent.
3. Skip closed venues (e.g. Just For You) and temp-closed (e.g. Steam Complex Leeds).
4. Add a row to a local JSON file (copy `backend/data/commercial-venues.sample.json`).
5. Dry-run, then seed:

```bash
cd backend
npm run hotspots:seed-commercial -- --file ./data/your-verified-venues.json --dry-run
npm run hotspots:seed-commercial -- --file ./data/your-verified-venues.json
```

Fields: `name`, `city`, `nation`, `category` (`saunas`|`nightlife`|`bars`|`cinema`),
`venue_type`, `lat`, `lng`, optional `source_url`, `external_id`, `verified_at`.
No hours, prices, or user/activity counts in seed.

Legacy `npm run hotspots:import` is locked to the same commercial allow-list and rejects RED text.

## Media lock

Never wipe or rewrite real user photos, covers, or albums when touching Cruise / Hot Spots.

## BOA90 test plan

1. Nearby Map → Hot Spots chip (cruise-ship icon) toggles the spot layer independently of People.
2. Helper text shows commercial-only + venue rules when the layer is on.
3. Cruise pin label visible on empty pins; occupied pins show venue name + real check-in count only.
4. Open sheet → Check in / anonymous / Check out still works (4h TTL).
5. No PSE / park / outdoor categories in filters or seed.
6. Empty venues never paint as Active Now from radius alone.
