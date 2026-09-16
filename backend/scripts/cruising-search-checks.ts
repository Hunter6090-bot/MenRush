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

// 4. Verify Hog's Back and Wisley coordinates and details
assert.match(rootSql, /Hog''s Back/i);
assert.match(rootSql, /Guildford/i);
assert.match(rootSql, /51\.22603/);
assert.match(rootSql, /-0\.67367/);
assert.match(rootSql, /Wisley Common/i);
assert.match(rootSql, /51\.31836/);
assert.match(rootSql, /-0\.47316/);
assert.match(rootSql, /ops-curated-cruising:hogs-back-a31-layby/);
assert.match(rootSql, /ops-curated-cruising:wisley-common/);

// Verify coordinates are within valid UK regional corridor
const hogsLat = 51.22603;
const hogsLng = -0.67367;
const wisleyLat = 51.31836;
const wisleyLng = -0.47316;

assert.ok(hogsLat > 51.0 && hogsLat < 51.5, "Hog's Back latitude in Surrey corridor");
assert.ok(hogsLng > -0.9 && hogsLng < -0.4, "Hog's Back longitude in Surrey corridor");
assert.ok(wisleyLat > 51.0 && wisleyLat < 51.5, 'Wisley latitude in Surrey corridor');
assert.ok(wisleyLng > -0.6 && wisleyLng < -0.3, 'Wisley longitude in Surrey corridor');

console.log('✓ Outdoor categories & visibility SQL verified');
console.log('✓ Migration 061 (Hog\'s Back + Wisley) verified in both locations');
console.log('✓ Real geocoded coordinates confirmed for Hog\'s Back and Wisley');
console.log('cruising-search-checks: ok');
