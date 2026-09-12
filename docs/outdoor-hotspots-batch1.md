# Outdoor Hot Spots Batch 1 (Al Legal override)

**Date:** 2026-09-12  
**Scope:** Seed + map pins for 24 South Coast / IOW / New Forest outdoor places only.  
**Override:** Al Zain explicitly overrode Legal RED for this Batch 1 only. Brand/Studio density claims remain held. Do not change Scene chips (Toilets / Car / Cruising). Do not add Tropics (already live as Tropics Day Spa). Do not scaffold the 1269 CSV in this workstream.

## What shipped

| Artifact | Path |
| --- | --- |
| Migration (auto on deploy) | `database/migrations/057_outdoor_hotspots_batch1.sql` (+ `backend/database/migrations/` copy) |
| Ops JSON | `backend/data/outdoor-hotspots.batch1-2026-09.json` |
| Soft-refresh seed | `npm run hotspots:seed-outdoor` |
| Checks | `npm run test:outdoor-hotspots-batch1` |

Fields: `is_user_generated=false`, `source=ops-curated`, `external_id=ops-curated-batch1-2026-09:*`, category `parks-trails` / `open-spaces` / `parking`, description only `Public park` / `Woodland` / `Car park`.

Coords from Nominatim/OSM named POIs (and Overpass for named parking / woods). Never invent lat/lng. Public toilets skipped.

## Public map visibility

Cruise list/get now returns commercial venues **or** active `ops-curated` outdoor rows in parks-trails / open-spaces / parking. Commercial importer (`hotspots:seed-commercial` / `hotspots:import`) still rejects outdoor RED.

Brand face helper copy stays commercial-only (claims held).

## Production apply path

1. **Preferred:** merge to `main` → Railway backend deploy runs pending migrations on boot (`057_outdoor_hotspots_batch1.sql` auto-applies).
2. **Soft-refresh without waiting for migrate** (idempotent):

```bash
cd backend
npm run hotspots:seed-outdoor -- --file ./data/outdoor-hotspots.batch1-2026-09.json --dry-run
npm run hotspots:seed-outdoor -- --file ./data/outdoor-hotspots.batch1-2026-09.json
# or: railway run -s <backend-service> -- npm run hotspots:seed-outdoor -- --file ./data/outdoor-hotspots.batch1-2026-09.json
```

3. BOA90: Nearby Map → Hot Spots chip → pan Fareham / Southampton / Portsmouth / IOW / New Forest — Batch 1 pins present. Tropics still commercial sauna only.

## Out of scope

- 1269 CSV bulk insert (prep-only later)
- Studio / FAQ / marketing density claims
- Scene filter chip changes
