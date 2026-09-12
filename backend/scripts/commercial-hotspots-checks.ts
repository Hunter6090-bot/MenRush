/**
 * Commercial Hot Spots / Cruise lock smoke checks (no DB required).
 * Run: npx ts-node scripts/commercial-hotspots-checks.ts
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {
  ACTIVE_CHECKIN_TTL_HOURS,
  COMMERCIAL_HOT_SPOT_CATEGORY_SLUGS,
  isPublicHotSpotVisibilitySql,
} from '../src/services/hot-spots.service';

assert.strictEqual(ACTIVE_CHECKIN_TTL_HOURS, 4);

const publicSql = isPublicHotSpotVisibilitySql('c', 'hs');
assert.match(publicSql, /is_commercial\s*=\s*TRUE/i);
assert.doesNotMatch(publicSql, /ops-curated/);
assert.doesNotMatch(publicSql, /parks-trails|open-spaces|parking/);

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

const RED_TEXT =
  /cottage|cottaging|glory\s*hole|truck\s*stop|cruising\s*area|nude\s*beach|public\s*toilet|pse\b|outdoor\s*play|known\s*cruising|redruth|\bpark\b/i;

const KEEP_LIST = new Set([
  'Sweatbox Soho|London',
  'Pleasuredrome|London',
  'The Brighton Sauna|Brighton',
  'The Pipeworks Glasgow|Glasgow',
]);

const AMBER_NEVER = [
  // Soft AMBER held (Zoul + Legal).
  'Centre Stage',
  'Eden Bar',
  'Blayds',
  // Remaining research AMBER not promoted this pass.
  'Vault 139',
  "Nero's",
  'Neros',
  'Acqua',
  'W3',
  'Pennine',
  'Yumbo',
  'Spartan',
  'Greenhouse Darlaston',
  'Hove Den',
  'Gentry',
  'Greenhouse Newport',
  'Outside Belfast',
];

const FOLLOW_ON_GREEN = [
  'Fire London',
  'City of Quebec',
  'EVA Manchester',
  'Fibre Leeds',
  'Equator Bar Birmingham',
];

type ExpandVenue = {
  name: string;
  city: string;
  category: string;
  lat: number;
  lng: number;
  source_url?: string | null;
  external_id?: string | null;
  description?: string | null;
};

const expandPath = path.join(__dirname, '../data/commercial-venues.green-expand-2026-09.json');
const expandRaw = JSON.parse(fs.readFileSync(expandPath, 'utf8')) as {
  venues: ExpandVenue[];
  _deferred?: unknown[];
};
assert.ok(Array.isArray(expandRaw.venues), 'green expand JSON must have venues[]');
assert.strictEqual(expandRaw.venues.length, 30, 'expected 30 GREEN venues (25 + 5 follow-on)');
assert.deepStrictEqual(expandRaw._deferred ?? [], [], 'deferred list must be empty this pass');
for (const name of FOLLOW_ON_GREEN) {
  assert.ok(
    expandRaw.venues.some((v) => v.name === name),
    `follow-on GREEN missing: ${name}`,
  );
}

const seenExt = new Set<string>();
for (const v of expandRaw.venues) {
  assert.ok(v.name && v.city, `missing name/city: ${JSON.stringify(v)}`);
  assert.ok((allowed as Set<string>).has(v.category), `non-commercial category: ${v.name} ${v.category}`);
  assert.ok(!RED_TEXT.test(v.name) && !RED_TEXT.test(v.city), `RED text in seed: ${v.name}`);
  assert.ok(
    !AMBER_NEVER.some((a) => v.name.toLowerCase().includes(a.toLowerCase())),
    `AMBER venue must not be seeded: ${v.name}`,
  );
  assert.ok(!KEEP_LIST.has(`${v.name}|${v.city}`), `keep-list duplicate: ${v.name}`);
  assert.ok(Number.isFinite(v.lat) && Number.isFinite(v.lng), `missing lat/lng: ${v.name}`);
  assert.ok(!(v.lat === 0 && v.lng === 0), `0,0 sentinel: ${v.name}`);
  assert.ok(Math.abs(v.lat) <= 90 && Math.abs(v.lng) <= 180, `out of range: ${v.name}`);
  assert.ok(v.source_url, `prefer venue-owned source_url: ${v.name}`);
  assert.ok(v.external_id, `external_id required: ${v.name}`);
  assert.ok(!seenExt.has(v.external_id!), `duplicate external_id: ${v.external_id}`);
  seenExt.add(v.external_id!);
  assert.ok(
    v.description == null || String(v.description).trim() === '',
    `copy lock — description must be empty: ${v.name}`,
  );
}

console.log('✓ commercial category allow-list locked');
console.log('✓ public visibility SQL is commercial-only (outdoor Batch 1 OFF map)');
console.log('✓ RED outdoor/PSE slugs excluded');
console.log('✓ GREEN filter-type map documented (9 types)');
console.log(`✓ green expand JSON: ${expandRaw.venues.length} venues, 0 deferred, no AMBER/keep-list dupes`);
console.log('commercial-hotspots-checks: ok');
