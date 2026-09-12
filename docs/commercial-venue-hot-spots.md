# Commercial venue Hot Spots / Cruise

Brand face on the Nearby Map:

| Surface | Copy |
| --- | --- |
| Pin label | **Cruise** (cruise-ship icon) |
| Map chip | **Hot Spots** (same cruise-ship icon). No extra tab. |
| Helper / sheet / page | Commercial venues only. Saunas and gay venues. 18+ only. Follow the venue's rules. MenRush does not run these places. No illegal activity. |
| Consent cue | Meet in public · Consent first |
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

## Growth pointers (verify before seed)

Permissioned / manual curation only. Prefer schema + admin/manual seed if coordinates cannot be hand-verified without scrape. Never invent lat/lng. Never scrape gaysaunas.co.uk wholesale.

- London: Sweatbox Soho; Pleasuredrome; Covent Garden Health Spa; The Locker Room; Sailors Sauna; E15 Club
- Manchester/NW: Basement Complex (Manchester); Nero's Sauna (Bury); Acqua Sauna (Blackpool); W3 Sauna (Blackpool); Dolphin Sauna (New Brighton); Pennine Sauna (Shaw); Sauna Sauna (Northwich); Sweat Sauna (Carlisle)
- Birmingham/WM: Yumbo Birmingham; Spartan Club Birmingham; Heroes Sauna (Stourbridge); The Greenhouse Sauna (Darlaston). Skip Just For You (closed).
- Brighton/SE: The Brighton Sauna; The Boiler Room Sauna (Hove); ME1 Sauna (Rochester); Tropics Day Spa (Portsmouth)
- Leeds/Yorkshire: Pipeworks Leeds; Plastic Ivy (Dewsbury); ClubZeus Sheffield; Gentry Spa (Hull). Skip Steam Complex Leeds (temp closed).
- SW: Manticore Spa (Plymouth); Steamer Quay (Torquay); SaunaBar (Bournemouth); Touch Sauna (Swindon). SKIP Redruth (social-play HOLD until named verified commercial private premises).
- East Midlands: Splash Spa (Leicester); Club Zeus (Mansfield)
- NE/other: Number 52 Sauna (Newcastle); Greenhouse Sauna (Luton) — verify city/region
- Scotland: Steamworks (Edinburgh); The Pipeworks (Glasgow)
- Wales: Greenhouse Gay Sauna (Newport)
- NI: Outside Sauna (Belfast)
- Cinema GREEN: Empire Cinema Club (Huddersfield) — adult cinema / members club framing, not cottage wink

**GREEN filter types** (map into commercial slugs): Bathhouse, Bar, Nightclub, Video Arcade, Theater, Cafe and Restaurant, Gym, Sauna, Hotels.

**RED never seed:** Park, Truck Stop, Cruising Area, Nude Beach, Has Glory Hole, outdoor PSE.

## How ops adds venues (no scrape)

1. Hand-verify name, city, nation, type, and public website.
2. Obtain lat/lng from the venue site, Google Business, or Ordnance (Code-Point / named map POI matching the venue address). Never invent.
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
No hours, prices, or user/activity counts in seed. Description stays null (sheet shows Brand helper).

Legacy `npm run hotspots:import` is locked to the same commercial allow-list and rejects RED text.

## GREEN expand 2026-09 (Zoul merge-green + Legal follow-on)

Migrations `053` + `054` + `055` + ops JSON
`backend/data/commercial-venues.green-expand-2026-09.json` seed **30** hand-verified
commercial venues (25 initial GREEN + 5 Legal follow-on: Fire London, City of Quebec,
EVA Manchester, Fibre Leeds, Equator Bar Birmingham). Keep-list unchanged.

**Soft AMBER (do not seed):** Centre Stage MCR, Eden Bar, Blayds Bar.
Remaining AMBER research names and RED outdoor/PSE omitted. Deferred this pass: **none**.

### BOA90 soft-refresh (Cruise map)

After migrate (or JSON seed) on the BOA90 environment:

1. Nearby Map → enable **Hot Spots** chip (cruise-ship icon). Layer toggles independent of People.
2. Pan UK — new pins show **Cruise** until a real check-in exists; then venue name + count only.
3. Confirm keep-list still present (Sweatbox Soho, Pleasuredrome, Brighton Sauna, Pipeworks Glasgow).
4. Confirm soft AMBER (Centre Stage / Eden Bar / Blayds) and outdoor pins are absent.
5. Open one sheet → Check in / anonymous / Check out (4h TTL) still works.

Re-apply without waiting for deploy migrate:

```bash
cd backend
npm run hotspots:seed-commercial -- --file ./data/commercial-venues.green-expand-2026-09.json --dry-run
npm run hotspots:seed-commercial -- --file ./data/commercial-venues.green-expand-2026-09.json
```

**Brand note:** public Cruise density claims stay held until Brand signs density. Seed only;
no marketing copy that counts or recommends venues.

## Outdoor Batch 1 — PUBLIC OFF (Al ORDER 2026-09-12)

Outdoor Batch 1 was seeded under an Al Legal override, then **pulled off the public map**.
Production DB: Product set `is_active=false` for `ops-curated-batch1-2026-09:*`.
Code: `isPublicHotSpotVisibilitySql` is commercial-only again (no ops-curated outdoor path).
Do **not** re-run `hotspots:seed-outdoor` or import the big outdoor CSV. Soft-inactive rows stay;
do not DELETE. Scene chips Toilets/Car/Cruising stay hidden. See `docs/outdoor-hotspots-batch1.md`.

## Media lock

Never wipe or rewrite real user photos, covers, or albums when touching Cruise / Hot Spots.

## BOA90 test plan

1. Nearby Map → Hot Spots chip (cruise-ship icon) toggles the spot layer independently of People.
2. Helper text shows commercial-only + venue rules when the layer is on.
3. Cruise pin label visible on empty pins; occupied pins show venue name + real check-in count only.
4. Open sheet → Check in / anonymous / Check out still works (4h TTL).
5. No PSE / park / outdoor categories in filters or seed.
6. Empty venues never paint as Active Now from radius alone.
