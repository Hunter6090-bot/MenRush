/**
 * Assert getNearbyUsers source does not await online cleanup / avatar backfill.
 * Run: npx ts-node scripts/nearby-hotpath-checks.ts
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';

const src = fs.readFileSync(
  path.join(__dirname, '../src/services/user.service.ts'),
  'utf8',
);

const start = src.indexOf('async getNearbyUsers(');
assert.ok(start >= 0, 'getNearbyUsers missing');
const slice = src.slice(start, start + 2500);

assert.match(slice, /void query\(\s*`UPDATE profiles/);
assert.match(slice, /void this\.ensureDefaultAvatar/);
assert.match(slice, /void this\.backfillMissingAvatarsNear/);
assert.doesNotMatch(
  slice,
  /await query\(\s*`UPDATE profiles[\s\S]*online = false/,
  'must not await full-table online cleanup on Nearby hot path',
);
assert.doesNotMatch(slice, /await this\.ensureDefaultAvatar/);
assert.doesNotMatch(slice, /await this\.backfillMissingAvatarsNear/);

console.log('nearby-hotpath-checks: ok');
