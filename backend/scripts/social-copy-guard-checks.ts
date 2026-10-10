/**
 * Social draft copy guard (no DB, never runs the seed or publishes anything).
 * MenRush is open in the UK: there is no waitlist, and it is not a dating app.
 * The Oct 1 seed script and the Social Studio draft pack must not bring back:
 * - 'dating app(s)'
 * - 'waitlist' / 'wait list' (the '#Waitlist' entry in FORBIDDEN_TAGS, which strips
 *   that tag, is the one allowed mention)
 * - em dashes (U+2014 as a literal character)
 * - 'beta'
 * - signup numbers ("1,200 signups", "500 men joined")
 * - 'right now' / 'right-now', and 'dating' (the #GayDating house hashtag is allowed)
 * Every post (seed posts as built, template defaults, and the Studio pack) must also:
 * - tell one timeline: MenRush is open, so no launch dates, countdowns or "opens" lines
 * - be unique: no two posts with the same text once hashtags, links and spacing go
 * Run: npm run test:social-copy-guard
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..', '..');
const FILES = [
  'backend/scripts/seed-social-launch-pack.ts',
  'social-studio/src/drafts/launch-pack.json',
];

const RULES: Array<{ name: string; re: RegExp }> = [
  { name: "'dating app'", re: /dating[\s-]*apps?\b/i },
  { name: "'waitlist'", re: /wait[\s-]*list/i },
  { name: 'em dash', re: /\u2014/ },
  { name: "'beta'", re: /\bbeta\b/i },
  { name: "'right now'", re: /right[\s-]+now/i },
  { name: "'dating'", re: /(?<!#Gay)dating/i },
  {
    name: 'signup number',
    re: /\b\d[\d,.]*\s*k?\+?\s*(sign[\s-]?ups?|signed up|members|men|people|users)\b(\s+(have\s+)?(joined|signed|already))?/i,
  },
];

function scrub(file: string, text: string): string {
  if (!file.endsWith('seed-social-launch-pack.ts')) return text;
  // The tag blocker itself names '#Waitlist' so it can strip it.
  return text.replace(/(const FORBIDDEN_TAGS = \[[^\]]*?)'#Waitlist',?\s*/, '$1');
}

const failures: string[] = [];
for (const rel of FILES) {
  const abs = path.join(ROOT, rel);
  const text = scrub(rel, fs.readFileSync(abs, 'utf8'));
  if (rel.endsWith('.json')) JSON.parse(text);
  text.split('\n').forEach((line, i) => {
    for (const rule of RULES) {
      // "30 days" / "3 months" are durations, not signup counts; the rule needs a people noun.
      const m = line.match(rule.re);
      if (m) failures.push(`${rel}:${i + 1} ${rule.name}: "${m[0]}"`);
    }
  });
}

// The scrub must not hide a real mention: only the tag blocker line is exempt.
const seedRaw = fs.readFileSync(path.join(ROOT, FILES[0]), 'utf8');
const rawWaitlistLines = seedRaw.split('\n').filter((l) => /wait[\s-]*list/i.test(l));
assert.ok(
  rawWaitlistLines.every((l) => /^const FORBIDDEN_TAGS = \[/.test(l)),
  `seed mentions waitlist outside FORBIDDEN_TAGS: ${rawWaitlistLines.join(' | ')}`,
);
assert.ok(/'#Waitlist'/.test(seedRaw), "FORBIDDEN_TAGS still strips '#Waitlist'");

// Internal names are neutral: 'oct1' survives only in the stored ids (campaign
// 'oct1-2026' and the 'oct1-*' template slugs), which keep existing rows matched.
const oct1Left = seedRaw
  .replace(/'oct1-[a-z0-9-]+'/g, '')
  .replace(/`oct1-2026`/g, '')
  .match(/oct1/gi);
assert.ok(!oct1Left, `seed still uses 'oct1' outside stored ids (${oct1Left?.length} left)`);

// Self-check: the rules catch what they are for.
for (const [sample, rule] of [
  ['Join the waitlist at menrush.com', "'waitlist'"],
  ['The best dating app for men', "'dating app'"],
  ['MenRush \u2014 UK first', 'em dash'],
  ['Now in beta', "'beta'"],
  ['1,200 men have joined', 'signup number'],
] as const) {
  const r = RULES.find((x) => x.name === rule)!;
  assert.ok(r.re.test(sample), `rule ${rule} should catch "${sample}"`);
}
assert.ok(!RULES.some((r) => r.re.test('#GayDating 30 days of Premium')), 'hashtag and durations allowed');

// ── Post-level checks: one timeline, no duplicates.
const TIMELINE = /\b(opens|opening day|1 Oct(ober)?|October|launch(es|ing|ed)?|countdown|month out|on the way|still early|coming soon|coming with)\b/i;

function normalise(body: string): string {
  return body
    // Pack outlines share a '[OUTLINE · week N]' header; seed stubs carry date and slot.
    .replace(/\[OUTLINE · week \d+\]/g, '')
    .replace(/#\w+/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/menrush\.com/gi, '')
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
    .toLowerCase();
}

type Post = { where: string; body: string };

function checkPosts(label: string, posts: Post[]) {
  const seen = new Map<string, string>();
  for (const p of posts) {
    const t = p.body.match(TIMELINE);
    if (t) failures.push(`${label} ${p.where}: timeline word "${t[0]}" (MenRush is open; no launch dates)`);
    for (const rule of RULES) {
      const m = p.body.match(rule.re);
      if (m) failures.push(`${label} ${p.where} ${rule.name}: "${m[0]}"`);
    }
    const key = normalise(p.body);
    const prev = seen.get(key);
    if (prev) failures.push(`${label} ${p.where}: same text as ${prev}`);
    else seen.set(key, p.where);
  }
}

async function postChecks() {
  const pack = JSON.parse(fs.readFileSync(path.join(ROOT, FILES[1]), 'utf8')) as {
    posts: Array<{ id: string; body: string }>;
  };
  checkPosts('studio pack', pack.posts.map((p) => ({ where: p.id, body: p.body })));

  // The seed module only builds posts here; it is never run and nothing touches the DB.
  const seed = await import('./seed-social-launch-pack');
  checkPosts('seed', seed.buildAllPosts().map((p) => ({ where: p.key, body: p.body })));
  const defaults: Post[] = [];
  for (const t of seed.TEMPLATES) {
    for (const v of t.variables) {
      if (v.key !== 'link') defaults.push({ where: `${t.slug}.${v.key}`, body: String(v.default ?? '') });
    }
  }
  for (const d of defaults) {
    const t = d.body.match(TIMELINE);
    if (t) failures.push(`template ${d.where}: timeline word "${t[0]}"`);
  }

  // Self-check: duplicates ignore hashtags, links and spacing; mixed timelines fail.
  assert.strictEqual(
    normalise('Open now.\n\nhttps://menrush.com\n\n#GayMen #GayUK'),
    normalise('Open  now.\nmenrush.com #GayMen #LGBTQ #GayUK'),
  );
  assert.ok(TIMELINE.test('One month out from October. Open now.'));
  assert.ok(TIMELINE.test('menrush.com. 1 October. UK first'));
  assert.ok(!TIMELINE.test('MenRush is open in the UK. Sign up free.'));
  const re = RULES.find((r) => r.name === "'dating'")!.re;
  assert.ok(re.test('a dating app') && !re.test('#GayDating'), "'dating' rule allows only #GayDating");
}

async function finish() {
  await postChecks();
  try {
    const db = await import('../src/db');
    await db.default.end();
  } catch {
    /* pool was never used */
  }
  if (failures.length) {
    console.error(`social-copy-guard: FAILED\n  ${failures.join('\n  ')}`);
    process.exit(1);
  }
  console.log(`social-copy-guard: ok (${FILES.length} files)`);
}

finish().catch((err) => {
  console.error('social-copy-guard: FAILED', err);
  process.exit(1);
});
