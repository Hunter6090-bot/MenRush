# Outdoor Hot Spots Batch 1 — soft-inactive (historical)

**Original seed:** 2026-09-12 (Al Legal override for Batch 1 only)  
**Pulled off public map:** 2026-09-12 (`#256`)  
**Visibility path reopened for active ops-curated outdoor:** 2026-09-12 residual-risk override (see `docs/outdoor-hotspots-override-2026-09-12.md`)

## Status (Batch 1 rows)

| Layer | State |
| --- | --- |
| Production DB | Soft-inactive: `is_active=false` for `external_id LIKE 'ops-curated-batch1-2026-09:%'` |
| Public map | Batch 1 stays hidden **unless** Product override seed reactivates a matching name |
| Scene chips | Toilets / Car / Cruising stay **hidden** |
| Soft data | Leave inactive rows; **do not DELETE** |
| Re-seed Batch 1 JSON | Prefer override file (`ops-curated-override-2026-09-12`) — do not invent CSV rows |

## Historical artifacts (keep)

| Artifact | Path |
| --- | --- |
| Migration (already applied) | `database/migrations/057_outdoor_hotspots_batch1.sql` (+ `backend/database/migrations/` copy) |
| Ops JSON | `backend/data/outdoor-hotspots.batch1-2026-09.json` |
| Seed script | `npm run hotspots:seed-outdoor` — requires `--allow-reactivate` |
| Checks | `npm run test:outdoor-hotspots-batch1` |

## Public map visibility (code)

Cruise list/get/check-in/comment: **active commercial OR active ops-curated outdoor**. Soft-inactive Batch 1 does not qualify until reactivated via Product seed of the override list.

Brand / Studio density claims stay held. Scene filter chips unchanged. Commercial importer still rejects outdoor RED.

## Out of scope

- 1269 / ~1100 missing CSV invent
- Studio / FAQ / marketing density claims
- Scene filter chip changes (Toilets / Car / Cruising remain hidden)
