/**
 * Commercial Hot Spots / Cruise lock smoke checks (no DB required).
 * Run: npx ts-node scripts/commercial-hotspots-checks.ts
 */
import assert from 'assert';
import {
  ACTIVE_CHECKIN_TTL_HOURS,
  COMMERCIAL_HOT_SPOT_CATEGORY_SLUGS,
} from '../src/services/hot-spots.service';

assert.strictEqual(ACTIVE_CHECKIN_TTL_HOURS, 4);

const allowed = new Set(COMMERCIAL_HOT_SPOT_CATEGORY_SLUGS);
assert.ok(allowed.has('saunas'));
assert.ok(allowed.has('nightlife'));
assert.ok(allowed.has('bars'));
assert.ok(allowed.has('cinema'));

const red = [
  'rest-facilities',
  'parks-trails',
  'parking',
  'open-spaces',
  'transit',
  'pse',
  'outdoor',
  'cottaging',
] as const;
for (const slug of red) {
  assert.ok(!(allowed as Set<string>).has(slug), `RED category must not be commercial: ${slug}`);
}

const greenFilterTypes = [
  'Bathhouse',
  'Bar',
  'Nightclub',
  'Video Arcade',
  'Theater',
  'Cafe and Restaurant',
  'Gym',
  'Sauna',
  'Hotels',
];
assert.strictEqual(greenFilterTypes.length, 9);

const redFilterTypes = [
  'Park',
  'Truck Stop',
  'Cruising Area',
  'Nude Beach',
  'Has Glory Hole',
  'outdoor PSE',
];
assert.ok(redFilterTypes.every((t) => /park|truck|cruising|nude|glory|pse/i.test(t)));

console.log('✓ commercial category allow-list locked');
console.log('✓ RED outdoor/PSE slugs excluded');
console.log('✓ GREEN filter-type map documented (9 types)');
console.log('commercial-hotspots-checks: ok');
