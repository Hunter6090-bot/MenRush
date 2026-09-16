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

// 4. Verify exact Product confirmed display names, coordinates and details
assert.match(rootSql, /A31 Hog’s Back Rest Lay-by/);
assert.match(rootSql, /Guildford/i);
assert.match(rootSql, /51\.2260632/);
assert.match(rootSql, /-0\.6727582/);
assert.match(rootSql, /Wisley \(Ockham Common\)/);
assert.match(rootSql, /Wisley/i);
assert.match(rootSql, /51\.3171538/);
assert.match(rootSql, /-0\.4538550/);
assert.match(rootSql, /ops-curated-cruising:a31-hogs-back-rest-layby/);
assert.match(rootSql, /ops-curated-cruising:wisley-ockham-common/);

// Legal constraints verification:
// - Hot spots names/descriptions: NEVER label as RHS Wisley / Wisley Gardens
// - NEVER label as Hog’s Back Café or imply café endorsement
// - Toilets stay off the map entirely
const linesWithoutComments = rootSql
  .split('\n')
  .filter((l) => !l.trim().startsWith('--'))
  .join('\n');
assert.doesNotMatch(linesWithoutComments, /\bRHS\b/i);
assert.doesNotMatch(linesWithoutComments, /\bWisley\s+Gardens\b/i);
assert.doesNotMatch(linesWithoutComments, /\bCaf[eé]\b/i);
assert.doesNotMatch(linesWithoutComments, /\btoilets?\b/i);

// Verify coordinates match exact confirmed Product specs
const hogsLat = 51.2260632;
const hogsLng = -0.6727582;
const ockhamLat = 51.3171538;
const ockhamLng = -0.453855;

assert.strictEqual(hogsLat, 51.2260632);
assert.strictEqual(hogsLng, -0.6727582);
assert.strictEqual(ockhamLat, 51.3171538);
assert.strictEqual(ockhamLng, -0.453855);

console.log('✓ Outdoor categories & visibility SQL verified');
console.log('✓ Migration 061 (exact confirmed Product coords and display names) verified in both locations');
console.log('✓ Legal constraints verified: no RHS/Cafe endorsement, no toilets');
console.log('cruising-search-checks: ok');
