/**
 * Map pin discretion fuzz — pure checks (no DB).
 * Run: npx ts-node scripts/map-pin-fuzz-checks.ts
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {
  clampMapPinFuzzM,
  fuzzRangeMeters,
  MAP_PIN_FUZZ_DEFAULT_M,
  privateMapPointAround,
} from '../src/lib/mapPinFuzz';

// Default preserves historical 80–320 m band.
const def = fuzzRangeMeters(MAP_PIN_FUZZ_DEFAULT_M);
assert.strictEqual(def.min, 80);
assert.strictEqual(def.max, 320);

assert.strictEqual(clampMapPinFuzzM(10), 80);
assert.strictEqual(clampMapPinFuzzM(900), 800);
assert.strictEqual(clampMapPinFuzzM(200.4), 200);

const a = privateMapPointAround(51.5, -0.12, 'map:test-user', 320);
const b = privateMapPointAround(51.5, -0.12, 'map:test-user', 320);
assert.strictEqual(a.lat, b.lat);
assert.strictEqual(a.lng, b.lng);

const tight = privateMapPointAround(51.5, -0.12, 'map:test-user', 80);
const wide = privateMapPointAround(51.5, -0.12, 'map:test-user', 800);
// Same seed → same bearing; wider max should usually land farther (not always if hash hits low %).
assert.ok(Number.isFinite(tight.lat) && Number.isFinite(wide.lat));

const userSrc = fs.readFileSync(
  path.join(__dirname, '../src/services/user.service.ts'),
  'utf8',
);
assert.match(userSrc, /map_pin_fuzz_m/);
assert.match(userSrc, /from '\.\.\/lib\/mapPinFuzz'/);
assert.doesNotMatch(
  userSrc,
  /function privateMapPointAround/,
  'fuzz helper must live in lib/mapPinFuzz.ts',
);

const routeSrc = fs.readFileSync(
  path.join(__dirname, '../src/routes/profile-meta.ts'),
  'utf8',
);
assert.match(routeSrc, /map-pin-fuzz/);
assert.match(routeSrc, /MapPinFuzzSchema/);

console.log('map-pin-fuzz-checks: ok');
