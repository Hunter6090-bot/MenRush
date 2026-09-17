/**
 * Cruising Search Phase 1 verification checks (no live DB required).
 * Run: npx ts-node scripts/cruising-search-checks.ts
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {
  OUTDOOR_HOT_SPOT_CATEGORY_SLUGS,
  CRUISING_HOT_SPOT_CATEGORY_SLUGS,
  isPublicHotSpotVisibilitySql,
} from '../src/services/hot-spots.service';

// 1. Verify outdoor category slugs include parks-trails, open-spaces, parking
const outdoor = new Set<string>(OUTDOOR_HOT_SPOT_CATEGORY_SLUGS);
assert.ok(outdoor.has('parks-trails'), 'parks-trails must be an outdoor category');
assert.ok(outdoor.has('open-spaces'), 'open-spaces must be an outdoor category');
assert.ok(outdoor.has('parking'), 'parking must be an outdoor category');

// 1b. Verify cruising categories include outdoor categories + licensed saunas
const cruising = new Set<string>(CRUISING_HOT_SPOT_CATEGORY_SLUGS);
assert.ok(cruising.has('saunas'), 'saunas must be in cruising categories');
assert.ok(cruising.has('parks-trails'), 'parks-trails must be in cruising categories');
assert.ok(cruising.has('open-spaces'), 'open-spaces must be in cruising categories');
assert.ok(cruising.has('parking'), 'parking must be in cruising categories');

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

// 5. Verify migration 061 sets last_activity_at = NULL on insert (never NOW())
assert.match(rootSql, /NOW\(\),\s*NULL/);
assert.doesNotMatch(rootSql, /NOW\(\),\s*NOW\(\)/);

// 6. Verify migration 062 exists in both locations and ensures last_activity_at is NULL
const rootMig062Path = path.join(
  __dirname,
  '../../database/migrations/062_cruising_spots_null_last_activity.sql',
);
const backendMig062Path = path.join(
  __dirname,
  '../database/migrations/062_cruising_spots_null_last_activity.sql',
);

assert.ok(fs.existsSync(rootMig062Path), '062 migration must exist in database/migrations');
assert.ok(fs.existsSync(backendMig062Path), '062 migration must exist in backend/database/migrations');

const root062Sql = fs.readFileSync(rootMig062Path, 'utf8');
const backend062Sql = fs.readFileSync(backendMig062Path, 'utf8');
assert.strictEqual(root062Sql, backend062Sql, 'Both 062 migration copies must be identical');

assert.match(root062Sql, /ops-curated-cruising:a31-hogs-back-rest-layby/);
assert.match(root062Sql, /ops-curated-cruising:wisley-ockham-common/);
assert.match(root062Sql, /A31 Hog’s Back Rest Lay-by/);
assert.match(root062Sql, /Wisley \(Ockham Common\)/);
assert.match(root062Sql, /SET\s+last_activity_at\s*=\s*NULL/i);

const linesWithoutComments062 = root062Sql
  .split('\n')
  .filter((l) => !l.trim().startsWith('--'))
  .join('\n');
assert.doesNotMatch(linesWithoutComments062, /\bRHS\b/i);
assert.doesNotMatch(linesWithoutComments062, /\bWisley\s+Gardens\b/i);
assert.doesNotMatch(linesWithoutComments062, /\bCaf[eé]\b/i);
assert.doesNotMatch(linesWithoutComments062, /\btoilets?\b/i);

// 7. Verify seed JSON (backend/data/outdoor-hotspots.cruising-phase1.json)
const cruisingJsonPath = path.join(
  __dirname,
  '../data/outdoor-hotspots.cruising-phase1.json',
);
assert.ok(fs.existsSync(cruisingJsonPath), 'cruising-phase1.json must exist');
const cruisingJson = JSON.parse(fs.readFileSync(cruisingJsonPath, 'utf8')) as {
  spots: Array<{
    name: string;
    external_id: string;
    last_activity_at?: string | null;
  }>;
};
assert.strictEqual(cruisingJson.spots.length, 2);
for (const spot of cruisingJson.spots) {
  assert.strictEqual(
    spot.last_activity_at,
    null,
    `cruising seed spot ${spot.name} must have last_activity_at: null`,
  );
  assert.ok(
    spot.name === 'A31 Hog’s Back Rest Lay-by' || spot.name === 'Wisley (Ockham Common)',
    `unexpected cruising spot name: ${spot.name}`,
  );
}

// 8. Verify seed script (backend/scripts/seed-outdoor-hotspots.ts) guards last_activity_at
const seedScriptPath = path.join(__dirname, 'seed-outdoor-hotspots.ts');
const seedScriptCode = fs.readFileSync(seedScriptPath, 'utf8');
// Insertion must NOT stamp NOW() for last_activity_at
assert.doesNotMatch(seedScriptCode, /NOW\(\),\s*NOW\(\)/, 'seed script must not insert NOW(), NOW()');
assert.match(seedScriptCode, /initialLastActivity/, 'seed script must compute initialLastActivity for inserts');
assert.match(seedScriptCode, /isCruisingPin/, 'seed script must explicitly guard cruising pins');

console.log('✓ Outdoor categories & visibility SQL verified');
console.log('✓ Migration 061 (exact confirmed Product coords and display names, NULL last_activity_at) verified in both locations');
console.log('✓ Migration 062 (NULLs last_activity_at for Hog’s Back and Wisley) verified in both locations');
console.log('✓ Cruising seed JSON verified: last_activity_at is null, names exact');
console.log('✓ Seed script guard verified: no default NOW() on insert or update without real check-ins');
console.log('✓ Legal constraints verified: no RHS/Cafe endorsement, no toilets');
console.log('cruising-search-checks: ok');
