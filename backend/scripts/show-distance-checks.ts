/**
 * Show distance toggle + fuzzed coarse distance: pure checks (no DB).
 * Run: npx ts-node scripts/show-distance-checks.ts
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { privateMapPointAround } from '../src/lib/mapPinFuzz';
import {
  coarseMilesFromMeters,
  haversineMeters,
  memberDistanceFields,
  memberPublicPin,
  METERS_PER_MILE,
} from '../src/lib/memberDistance';

// ── Coarse UK miles ─────────────────────────────────────────────────────────
assert.deepStrictEqual(coarseMilesFromMeters(0), { distance_km: '0.80', distance_label: '<1 mi' });
assert.strictEqual(coarseMilesFromMeters(150).distance_label, '<1 mi');
assert.strictEqual(coarseMilesFromMeters(METERS_PER_MILE * 0.99).distance_label, '<1 mi');
assert.strictEqual(coarseMilesFromMeters(METERS_PER_MILE * 1.0).distance_label, '1 mi');
assert.strictEqual(coarseMilesFromMeters(METERS_PER_MILE * 1.49).distance_label, '1 mi');
assert.strictEqual(coarseMilesFromMeters(METERS_PER_MILE * 1.5).distance_label, '2 mi');
assert.strictEqual(coarseMilesFromMeters(METERS_PER_MILE * 27.6).distance_label, '28 mi');
// distance_km is the bucket itself (no hidden precision for sorting).
assert.strictEqual(coarseMilesFromMeters(METERS_PER_MILE * 3.2).distance_km, '4.83');
assert.strictEqual(coarseMilesFromMeters(METERS_PER_MILE * 2.8).distance_km, '4.83');
// No metre / decimal labels ever.
for (const m of [10, 90, 299, 450, 999, 1500, 2400, 5000, 12000, 80000]) {
  const { distance_label } = coarseMilesFromMeters(m);
  assert.match(distance_label, /^(<1 mi|\d+ mi)$/, `label for ${m} m: ${distance_label}`);
}
assert.strictEqual(coarseMilesFromMeters(-5).distance_label, '<1 mi');
assert.strictEqual(coarseMilesFromMeters(Number.NaN).distance_label, '<1 mi');

// ── Haversine sanity: 1 degree of latitude ≈ 111.2 km ──────────────────────
const deg = haversineMeters(51, -1, 52, -1);
assert.ok(deg > 111_000 && deg < 111_400, `1° lat = ${deg}`);

// ── Fuzzed pin: same as the map, deterministic per member ──────────────────
const member = 'a2b4c6d8-0000-4000-8000-000000000001';
const real = { lat: 51.5074, lng: -0.1278 };
const pinA = memberPublicPin(member, real.lat, real.lng, 800);
const pinB = memberPublicPin(member, real.lat, real.lng, 800);
assert.deepStrictEqual(pinA, pinB, 'pin is stable across requests (no jitter)');
assert.deepStrictEqual(
  pinA,
  privateMapPointAround(real.lat, real.lng, `map:${member}`, 800),
  'distance uses the exact pin the map shows',
);
const offset = haversineMeters(real.lat, real.lng, pinA.lat, pinA.lng);
assert.ok(offset >= 150 && offset <= 810, `Discretion offset ${offset} m within 25-100% of 800`);

// Distance is measured to the fuzzed pin, not real GPS: put the viewer ON the
// real point. Real distance would be 0; fuzzed distance is the pin offset.
const atReal = memberDistanceFields({
  memberId: member,
  viewerLat: real.lat,
  viewerLng: real.lng,
  memberLat: real.lat,
  memberLng: real.lng,
  fuzzMaxM: 800,
  showDistance: true,
});
assert.deepStrictEqual(atReal, coarseMilesFromMeters(offset));

// Find a viewer position where real-GPS rounding and fuzzed rounding disagree,
// proving the bucket follows the fuzzed pin.
let differs = false;
for (let i = 0; i < 400 && !differs; i++) {
  const vLat = real.lat + 0.0005 * i;
  const fromReal = coarseMilesFromMeters(haversineMeters(vLat, real.lng, real.lat, real.lng));
  const fromFuzz = memberDistanceFields({
    memberId: member,
    viewerLat: vLat,
    viewerLng: real.lng,
    memberLat: real.lat,
    memberLng: real.lng,
    fuzzMaxM: 800,
    showDistance: true,
  });
  const expected = coarseMilesFromMeters(haversineMeters(vLat, real.lng, pinA.lat, pinA.lng));
  assert.deepStrictEqual(fromFuzz, expected);
  if (fromReal.distance_label !== (fromFuzz as { distance_label: string }).distance_label) {
    differs = true;
  }
}
assert.ok(differs, 'some viewer position rounds differently on real vs fuzzed pin');

// Repeated checks from the same spot give the same answer (no per-request noise).
const again = memberDistanceFields({
  memberId: member,
  viewerLat: 51.52,
  viewerLng: -0.1,
  memberLat: real.lat,
  memberLng: real.lng,
  fuzzMaxM: 800,
  showDistance: true,
});
const again2 = memberDistanceFields({
  memberId: member,
  viewerLat: 51.52,
  viewerLng: -0.1,
  memberLat: real.lat,
  memberLng: real.lng,
  fuzzMaxM: 800,
  showDistance: true,
});
assert.deepStrictEqual(again, again2);

// ── Show distance OFF: no fields at all ─────────────────────────────────────
const off = memberDistanceFields({
  memberId: member,
  viewerLat: 51.52,
  viewerLng: -0.1,
  memberLat: real.lat,
  memberLng: real.lng,
  fuzzMaxM: 320,
  showDistance: false,
});
assert.deepStrictEqual(off, {});
assert.ok(!('distance_km' in off) && !('distance_label' in off));
// Missing viewer location looks exactly the same (no reason, no flag).
const noViewer = memberDistanceFields({
  memberId: member,
  viewerLat: null,
  viewerLng: null,
  memberLat: real.lat,
  memberLng: real.lng,
  fuzzMaxM: 320,
  showDistance: true,
});
assert.deepStrictEqual(noViewer, off);
assert.deepStrictEqual(
  memberDistanceFields({
    memberId: member,
    viewerLat: 51.52,
    viewerLng: -0.1,
    memberLat: real.lat,
    memberLng: real.lng,
    fuzzMaxM: 320,
    showDistance: true,
    suppress: true,
  }),
  off,
);
// NULL/undefined setting = default ON.
assert.ok('distance_label' in memberDistanceFields({
  memberId: member,
  viewerLat: 51.52,
  viewerLng: -0.1,
  memberLat: real.lat,
  memberLng: real.lng,
  fuzzMaxM: 320,
  showDistance: null,
}));

// ── Wiring: every member-distance path goes through the helper ─────────────
const read = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
const userSrc = read('src/services/user.service.ts');
const communitySrc = read('src/services/community.service.ts');
const rosterSrc = read('src/lib/nearbyRosterSql.ts');
const feedSrc = read('src/services/map-feed.service.ts');
assert.match(rosterSrc, /COALESCE\(u\.show_distance, TRUE\) AS show_distance/);
assert.match(userSrc, /memberDistanceFields\(/);
assert.doesNotMatch(rosterSrc, /as distance_m/i, 'roster never selects the exact ST_Distance');
assert.match(userSrc, /show_distance: _showDistance/, 'setting itself is not exposed to others');
assert.doesNotMatch(userSrc, /label = '< 300 m'/, 'old metre buckets are gone');
assert.match(userSrc, /ShowDistancePremiumError/);
assert.match(userSrc, /premiumService\.isPremium\(userId\)/, 'gated by the existing isPremium helper');
assert.match(communitySrc, /memberDistanceFields\(/);
assert.doesNotMatch(communitySrc, /ST_Distance\(/, 'Community no longer measures to raw post GPS');
// Map feed carries the fuzzed pin, not raw GPS: SQL list uses the sender's
// public pin (same seed as memberPublicPin), and post() fuzzes the reply.
assert.match(feedSrc, /publicPinSql\('mf\.lat', 'mf\.lng', 'mf\.sender_id'/, 'map feed list uses the public pin');
assert.match(feedSrc, /\$\{SENDER_PIN\.lat\} AS lat, \$\{SENDER_PIN\.lng\} AS lng/, 'map feed returns pin coords');
assert.match(feedSrc, /privateMapPointAround\([\s\S]*?`map:\$\{userId\}`/, 'map feed post reply carries the pin');
assert.doesNotMatch(feedSrc, /mf\.message, mf\.lat, mf\.lng/, 'raw post GPS never selected for the list');

const migration = read('../database/migrations/072_show_distance.sql');
assert.match(migration, /show_distance BOOLEAN NOT NULL DEFAULT TRUE/);
assert.strictEqual(
  read('database/migrations/072_show_distance.sql'),
  migration,
  'backend copy of 072 matches repo root',
);

console.log('show-distance-checks: ok');
