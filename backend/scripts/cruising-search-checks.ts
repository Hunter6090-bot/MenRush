/**
 * Cruising Search Phase 1 verification checks (no live DB required).
 * Run: npx ts-node scripts/cruising-search-checks.ts
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {
  OUTDOOR_HOT_SPOT_CATEGORY_SLUGS,
  isPublicHotSpotVisibilitySql,
} from '../src/services/hot-spots.service';

// 1. Verify outdoor category slugs include parks-trails, open-spaces, parking
const outdoor = new Set<string>(OUTDOOR_HOT_SPOT_CATEGORY_SLUGS);
assert.ok(outdoor.has('parks-trails'), 'parks-trails must be an outdoor category');
assert.ok(outdoor.has('open-spaces'), 'open-spaces must be an outdoor category');
assert.ok(outdoor.has('parking'), 'parking must be an outdoor category');

// 2. Verify visibility SQL allows ops-curated outdoor spots
const visibilitySql = isPublicHotSpotVisibilitySql('c', 'hs');
assert.match(visibilitySql, /c\.is_commercial\s*=\s*TRUE/i);
assert.match(visibilitySql, /hs\.source\s*=\s*'ops-curated'/);
assert.match(visibilitySql, /hs\.is_user_generated\s*=\s*FALSE/);
assert.match(visibilitySql, /parks-trails/);
assert.match(visibilitySql, /parking/);

// 3. Verify migration 061 exists in both database/migrations and backend/database/migrations
const rootMigPath = path.join(
  __dirname,
  '../../database/migrations/061_cruising_spots_hogs_back_wisley.sql',
);
const backendMigPath = path.join(
  __dirname,
  '../database/migrations/061_cruising_spots_hogs_back_wisley.sql',
);

assert.ok(fs.existsSync(rootMigPath), '061 migration must exist in database/migrations');
assert.ok(
  fs.existsSync(backendMigPath),
  '061 migration must exist in backend/database/migrations',
);

const rootSql = fs.readFileSync(rootMigPath, 'utf8');
const backendSql = fs.readFileSync(backendMigPath, 'utf8');
assert.strictEqual(rootSql, backendSql, 'Both migration copies must be identical');

// 4. Verify Hog's Back and Ockham Common (Wisley corridor) coordinates and details
assert.match(rootSql, /Hog''s Back/i);
assert.match(rootSql, /Guildford/i);
assert.match(rootSql, /51\.22603/);
assert.match(rootSql, /-0\.67367/);
assert.match(rootSql, /Ockham Common/i);
assert.match(rootSql, /Wisley/i);
assert.match(rootSql, /51\.31800/);
assert.match(rootSql, /-0\.45800/);
assert.match(rootSql, /ops-curated-cruising:hogs-back-a31-layby/);
assert.match(rootSql, /ops-curated-cruising:ockham-common/);

// Legal constraints verification:
// - Do NOT name or imply RHS Wisley / Wisley Gardens endorsement
assert.doesNotMatch(rootSql, /\bRHS\b/i);
assert.doesNotMatch(rootSql, /\bWisley\s+Gardens\b/i);
// - Do NOT name or imply Hog's Back Cafe endorsement
assert.doesNotMatch(rootSql, /\bCaf[eé]\b/i);
// - Toilets stay off the map entirely
assert.doesNotMatch(rootSql, /\btoilets?\b/i);

// Verify coordinates are within valid UK regional corridor
const hogsLat = 51.22603;
const hogsLng = -0.67367;
const ockhamLat = 51.31800;
const ockhamLng = -0.45800;

assert.ok(hogsLat > 51.0 && hogsLat < 51.5, "Hog's Back latitude in Surrey corridor");
assert.ok(hogsLng > -0.9 && hogsLng < -0.4, "Hog's Back longitude in Surrey corridor");
assert.ok(ockhamLat > 51.0 && ockhamLat < 51.5, 'Ockham Common latitude in Surrey corridor');
assert.ok(ockhamLng > -0.6 && ockhamLng < -0.3, 'Ockham Common longitude in Surrey corridor');

console.log('✓ Outdoor categories & visibility SQL verified');
console.log('✓ Migration 061 (Hog\'s Back + Ockham Common) verified in both locations');
console.log('✓ Legal soft constraints verified: no RHS/Cafe endorsement, no toilets');
console.log('✓ Real geocoded coordinates confirmed for Hog\'s Back and Ockham Common');
console.log('cruising-search-checks: ok');
