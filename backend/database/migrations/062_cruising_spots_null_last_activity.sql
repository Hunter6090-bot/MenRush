-- Migration 062: Ensure last_activity_at is NULL for Hog’s Back and Wisley
-- outdoor cruising spots until a real check-in occurs (honest activity state).
-- Fixes migration 061 which stamped NOW() on insert.
-- Targets:
--   - 'ops-curated-cruising:a31-hogs-back-rest-layby'
--   - 'ops-curated-cruising:wisley-ockham-common'
-- Exact display names:
--   - 'A31 Hog’s Back Rest Lay-by'
--   - 'Wisley (Ockham Common)'
-- Legal: Pure outdoor woodland and layby only. Never imply commercial/gardens endorsement.

UPDATE hot_spots
   SET last_activity_at = NULL
 WHERE (
   external_id IN (
     'ops-curated-cruising:a31-hogs-back-rest-layby',
     'ops-curated-cruising:wisley-ockham-common'
   )
   OR name IN (
     'A31 Hog’s Back Rest Lay-by',
     'Wisley (Ockham Common)'
   )
   OR (
     source = 'ops-curated' AND (
       lower(name) LIKE '%hog%back%'
       OR lower(name) IN ('wisley common', 'ockham common', 'wisley (ockham common)')
     )
   )
 )
 AND NOT EXISTS (
   SELECT 1 FROM hot_spot_checkins c WHERE c.spot_id = hot_spots.id
 );
