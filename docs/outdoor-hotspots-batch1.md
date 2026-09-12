# Outdoor Hot Spots Batch 1 — PUBLIC OFF

**Date pulled off map:** 2026-09-12 (Al ORDER)  
**Original seed:** 2026-09-12 (Al Legal override for Batch 1 only)

## Status (current)

| Layer | State |
| --- | --- |
| Public Cruise map / list / get | **Commercial venues only** — outdoor Batch 1 not visible |
| Production DB | Product set `is_active=false` for `source=ops-curated` AND `external_id LIKE 'ops-curated-batch1-2026-09:%'` |
| Code guard | `isPublicHotSpotVisibilitySql` = `is_commercial = TRUE` only (no ops-curated outdoor path) |
| Scene chips | Toilets / Car / Cruising stay **hidden** (unchanged) |
| Soft data | Leave inactive rows; **do not DELETE** user/media data |
| Re-seed | **Do NOT** re-run `hotspots:seed-outdoor` or re-activate Batch 1 |
| CSV | **Do NOT** import the big outdoor CSV |

## Historical artifacts (keep; do not re-apply for public map)

| Artifact | Path |
| --- | --- |
| Migration (already applied) | `database/migrations/057_outdoor_hotspots_batch1.sql` (+ `backend/database/migrations/` copy) |
| Ops JSON | `backend/data/outdoor-hotspots.batch1-2026-09.json` |
| Seed script (refuse-by-default) | `npm run hotspots:seed-outdoor` — exits unless `--allow-reactivate` |
| Checks | `npm run test:outdoor-hotspots-batch1` |

Fields on seeded rows: `is_user_generated=false`, `source=ops-curated`, `external_id=ops-curated-batch1-2026-09:*`, category `parks-trails` / `open-spaces` / `parking`, description only `Public park` / `Woodland` / `Car park`.

## Public map visibility

Cruise list/get returns **commercial venues only**. Outdoor Batch 1 is off the public map in code and deactivated in production DB.

Brand face helper copy stays commercial-only. Commercial importer (`hotspots:seed-commercial` / `hotspots:import`) still rejects outdoor RED.

## Out of scope

- Re-activating Batch 1 outdoor pins
- 1269 CSV bulk insert
- Studio / FAQ / marketing density claims
- Scene filter chip changes (Toilets / Car / Cruising remain hidden)
