# Outdoor Hot Spots — Al residual-risk override (2026-09-12)

**Legal colour stays RED** (not a sign-off). South-first Product hold: cook code + artifact; **do not prod-seed** until Al greens South-first vs wait-for-full-CSV.

## Status (current code)

| Layer | State |
| --- | --- |
| Public Cruise list / get / check-in / comment | **Active commercial OR active ops-curated outdoor** |
| Soft-inactive Batch 1 | `ops-curated-batch1-2026-09:*` stays `is_active=false` unless name appears in override seed |
| Override batch (artifact) | `ops-curated-override-2026-09-12` — **121 names only** (do NOT invent missing ~1100) |
| Scene chips | Toilets / Car / Cruising stay **hidden** |
| Studio / Acquire / FAQ | Density / outdoor claims **held** |
| Prod seed | **Do NOT run** until Al widget greens South-first |

## Artifacts

| Artifact | Path |
| --- | --- |
| Source name list | `docs/data/outdoor-cruising-pins-override-2026-09-12.md` |
| Geocoded JSON | `backend/data/outdoor-hotspots.override-2026-09-12.json` |
| Seed script | `npm run hotspots:seed-outdoor` (refuses without `--allow-reactivate`) |
| Checks | `npm run test:outdoor-hotspots-override` |
| Historical Batch 1 | `docs/outdoor-hotspots-batch1.md` + `outdoor-hotspots.batch1-2026-09.json` |

Fields on override rows: `is_user_generated=false`, `source=ops-curated`, `external_id=ops-curated-override-2026-09-12:*`, category `parks-trails` / `open-spaces` / `parking`, description only `Public park` / `Woodland` / `Car park`. Never invent lat/lng — geocode failures stay in `_meta.skipped`.

## Public map visibility

`isPublicHotSpotVisibilitySql` returns commercial **or** ops-curated outdoor (non-UGC parks-trails/open-spaces/parking). Call sites already require `hs.is_active = TRUE`, so soft-inactive Batch 1 remains hidden until Product seeds/reactivates overlapping names from the override list.

## Product seed (Railway — only after Al greens)

Dry-run first, then:

```bash
cd backend
npm run hotspots:seed-outdoor -- --file ./data/outdoor-hotspots.override-2026-09-12.json --dry-run --allow-reactivate
npm run hotspots:seed-outdoor -- --file ./data/outdoor-hotspots.override-2026-09-12.json --allow-reactivate
```

Optional: `--external-id-prefix ops-curated-override-2026-09-12` (default / `_meta` already set).

## Out of scope

- Inventing the missing ~1100 CSV names
- Scene chip UI (Toilets / Car / Cruising)
- Studio / FAQ / Acquire copy
- Deleting soft-inactive Batch 1 rows
- Agent-run production seed
