/**
 * Outdoor override 2026-09-12 checks (no DB required).
 * Run: npx ts-node scripts/outdoor-hotspots-override-checks.ts
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
for (const slug of outdoor) {
  assert.ok(!commercial.has(slug), `outdoor slug must stay non-commercial: ${slug}`);
}

// Public visibility: commercial OR active ops-curated outdoor (Al residual-risk override).
const sql = isPublicHotSpotVisibilitySql('c', 'hs');
assert.match(sql, /is_commercial\s*=\s*TRUE/i);
assert.match(sql, /ops-curated/);
assert.match(sql, /parks-trails/);
assert.match(sql, /open-spaces/);
assert.match(sql, /parking/);
assert.match(sql, /is_user_generated\s*=\s*FALSE/i);

const dataPath = path.join(__dirname, '../data/outdoor-hotspots.override-2026-09-12.json');
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
  _meta?: {
    skipped?: string[];
    legal?: string;
    external_id_prefix?: string;
    names_in_source?: number;
    geocoded?: number;
  };
};

assert.ok(Array.isArray(raw.spots));
assert.ok(raw.spots.length >= 100, `expected ~120 geocoded, got ${raw.spots.length}`);
assert.ok((raw._meta?.names_in_source || 0) === 121, 'source list is 121 names only');
assert.ok(
  (raw._meta?.skipped?.length || 0) <= 5,
  `too many geocode skips: ${raw._meta?.skipped?.length}`,
);
assert.match(String(raw._meta?.legal || ''), /residual-risk|RED|override/i);
assert.strictEqual(raw._meta?.external_id_prefix, 'ops-curated-override-2026-09-12');

const ALLOWED_DESC = new Set(['Public park', 'Woodland', 'Car park']);
const RED =
  /\bsquirt\b|\bcottag(?:e|ing)\b|glory\s*hole|\bcruising\b|\bpse\b|\btoilets?\b|how-to|d-day museum/i;
const seen = new Set<string>();
const names = new Set(raw.spots.map((s) => s.name));

assert.ok(names.has('Southampton Common'));
assert.ok(names.has('Hilsea Lines'));
assert.ok(!names.has('Tropics'));
assert.ok(![...names].some((n) => /toilet/i.test(n)));
// Do not invent missing ~1100 — file must stay near the 121 South set.
assert.ok(raw.spots.length <= 121, 'must not invent rows beyond the 121-name source');

for (const s of raw.spots) {
  assert.ok(s.name && s.city, `missing name/city: ${JSON.stringify(s)}`);
  assert.ok(outdoor.has(s.category), `bad category: ${s.name} ${s.category}`);
  assert.ok(ALLOWED_DESC.has(s.description), `bad description: ${s.name} → ${s.description}`);
  assert.ok(!RED.test(s.name) && !RED.test(s.description), `RED copy: ${s.name}`);
  assert.ok(Number.isFinite(s.lat) && Number.isFinite(s.lng), `missing coords: ${s.name}`);
  assert.ok(!(s.lat === 0 && s.lng === 0), `0,0 sentinel: ${s.name}`);
  // South England band (Fareham ± ~180km spill)
  assert.ok(s.lat > 50.3 && s.lat < 52.0, `lat out of regional band: ${s.name}`);
  assert.ok(s.lng > -2.6 && s.lng < 0.5, `lng out of regional band: ${s.name}`);
  assert.ok(
    s.external_id.startsWith('ops-curated-override-2026-09-12:'),
    `external_id: ${s.name}`,
  );
  assert.ok(!seen.has(s.external_id), `duplicate external_id: ${s.external_id}`);
  seen.add(s.external_id);
}

const seedPath = path.join(__dirname, 'seed-outdoor-hotspots.ts');
const seed = fs.readFileSync(seedPath, 'utf8');
assert.match(seed, /Never invent lat\/lng|never invent coords/i);
assert.match(seed, /Public park/);
assert.match(seed, /allow-reactivate/);
assert.match(seed, /ops-curated-override-2026-09-12/);
assert.match(seed, /external-id-prefix/);
assert.match(seed, /toilet|cottage|PSE/i);
// Refuse-by-default still present
assert.match(seed, /Refused:|requires Product --allow-reactivate/i);

const sourceMd = path.join(
  __dirname,
  '../../docs/data/outdoor-cruising-pins-override-2026-09-12.md',
);
assert.ok(fs.existsSync(sourceMd), 'source list must live under docs/data');
const md = fs.readFileSync(sourceMd, 'utf8');
assert.match(md, /121/);
assert.match(md, /Do NOT invent/i);
assert.doesNotMatch(md, /Studio densit/i); // no Studio claims in source note beyond holds

console.log('✓ public visibility SQL = commercial OR ops-curated outdoor');
console.log(
  `✓ override JSON: ${raw.spots.length} geocoded / ${raw._meta?.names_in_source} source / ${raw._meta?.skipped?.length || 0} skips`,
);
console.log('✓ external_id prefix ops-curated-override-2026-09-12; no toilet/cottage/PSE');
console.log('✓ seed-outdoor refuses without --allow-reactivate; override prefix wired');
console.log('outdoor-hotspots-override-checks: ok');
