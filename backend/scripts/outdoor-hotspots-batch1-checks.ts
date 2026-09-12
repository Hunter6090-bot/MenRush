/**
 * Batch 1 outdoor Hot Spots checks (no DB required).
 * Run: npx ts-node scripts/outdoor-hotspots-batch1-checks.ts
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {
  COMMERCIAL_HOT_SPOT_CATEGORY_SLUGS,
  OUTDOOR_HOT_SPOT_CATEGORY_SLUGS,
  isPublicHotSpotVisibilitySql,
} from '../src/services/hot-spots.service';

const commercial = new Set<string>(COMMERCIAL_HOT_SPOT_CATEGORY_SLUGS);
const outdoor = new Set<string>(OUTDOOR_HOT_SPOT_CATEGORY_SLUGS);

assert.ok(outdoor.has('parks-trails'));
assert.ok(outdoor.has('open-spaces'));
assert.ok(outdoor.has('parking'));
assert.ok(!outdoor.has('saunas'));
assert.ok(!outdoor.has('rest-facilities'));
assert.ok(!outdoor.has('transit'));
for (const slug of outdoor) {
  assert.ok(!commercial.has(slug), `outdoor slug must stay non-commercial: ${slug}`);
}

const sql = isPublicHotSpotVisibilitySql('c', 'hs');
assert.match(sql, /is_commercial\s*=\s*TRUE/i);
assert.match(sql, /ops-curated/);
assert.match(sql, /parks-trails/);

const dataPath = path.join(__dirname, '../data/outdoor-hotspots.batch1-2026-09.json');
const raw = JSON.parse(fs.readFileSync(dataPath, 'utf8')) as {
  spots: Array<{
    name: string;
    city: string;
    category: string;
    description: string;
    lat: number;
    lng: number;
    external_id: string;
  }>;
  _meta?: { skipped?: string[]; legal?: string };
};

assert.ok(Array.isArray(raw.spots));
assert.strictEqual(raw.spots.length, 24, 'Batch 1 expects 24 geocoded spots');
assert.deepStrictEqual(raw._meta?.skipped ?? [], [], 'no geocode skips in this file');
assert.match(String(raw._meta?.legal || ''), /Al Zain|override/i);

const ALLOWED_DESC = new Set(['Public park', 'Woodland', 'Car park']);
const RED =
  /\bsquirt\b|\bcottag(?:e|ing)\b|glory\s*hole|\bcruising\b|\bpse\b|\btoilets?\b|how-to|d-day museum/i;
const seen = new Set<string>();
const names = new Set(raw.spots.map((s) => s.name));

assert.ok(names.has('Southampton Common'));
assert.ok(names.has('Hilsea Lines'));
assert.ok(!names.has('Tropics'));
assert.ok(!names.has('Tropics Day Spa'));
assert.ok(![...names].some((n) => /toilet/i.test(n)));

for (const s of raw.spots) {
  assert.ok(s.name && s.city, `missing name/city: ${JSON.stringify(s)}`);
  assert.ok(outdoor.has(s.category), `bad category: ${s.name} ${s.category}`);
  assert.ok(ALLOWED_DESC.has(s.description), `bad description: ${s.name} → ${s.description}`);
  assert.ok(!RED.test(s.name) && !RED.test(s.description), `RED copy: ${s.name}`);
  assert.ok(Number.isFinite(s.lat) && Number.isFinite(s.lng), `missing coords: ${s.name}`);
  assert.ok(!(s.lat === 0 && s.lng === 0), `0,0 sentinel: ${s.name}`);
  // South Coast / IOW / New Forest / Winchester band
  assert.ok(s.lat > 50.5 && s.lat < 51.2, `lat out of regional band: ${s.name}`);
  assert.ok(s.lng > -1.9 && s.lng < -0.8, `lng out of regional band: ${s.name}`);
  assert.ok(s.external_id.startsWith('ops-curated-batch1-2026-09:'), `external_id: ${s.name}`);
  assert.ok(!seen.has(s.external_id), `duplicate external_id: ${s.external_id}`);
  seen.add(s.external_id);
}

const migPath = path.join(__dirname, '../database/migrations/057_outdoor_hotspots_batch1.sql');
const mig = fs.readFileSync(migPath, 'utf8');
assert.match(mig, /ops-curated-batch1-2026-09:southampton-common/);
assert.match(mig, /ops-curated/);
// Spot VALUES must not seed Tropics or toilets (comment may mention the skip).
const valuesBlocks = mig.split('JOIN (VALUES');
assert.ok(valuesBlocks.length >= 2, 'migration must contain VALUES seed blocks');
for (const block of valuesBlocks.slice(1)) {
  const body = block.split(') AS v(')[0] || '';
  assert.doesNotMatch(body, /'Tropics/i);
  assert.doesNotMatch(body, /toilet/i);
  assert.doesNotMatch(body, /squirt|cruising|\bpse\b/i);
}

const seedPath = path.join(__dirname, 'seed-outdoor-hotspots.ts');
const seed = fs.readFileSync(seedPath, 'utf8');
assert.match(seed, /Never invent lat\/lng/);
assert.match(seed, /Public park/);

console.log('✓ outdoor category allow-list locked (non-commercial)');
console.log('✓ public visibility SQL includes ops-curated outdoor');
console.log(`✓ batch1 JSON: ${raw.spots.length} geocoded spots, 0 skips, no Tropics/toilets`);
console.log('✓ migration 057 present with Batch 1 external_ids');
console.log('outdoor-hotspots-batch1-checks: ok');
