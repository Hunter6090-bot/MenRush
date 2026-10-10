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
 * Run: npm run test:social-copy-guard
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..', '..');
const FILES = [
  'backend/scripts/seed-social-oct1-2026.ts',
  'social-studio/src/drafts/oct1-2026.json',
];

const RULES: Array<{ name: string; re: RegExp }> = [
  { name: "'dating app'", re: /dating[\s-]*apps?\b/i },
  { name: "'waitlist'", re: /wait[\s-]*list/i },
  { name: 'em dash', re: /\u2014/ },
  { name: "'beta'", re: /\bbeta\b/i },
  {
    name: 'signup number',
    re: /\b\d[\d,.]*\s*k?\+?\s*(sign[\s-]?ups?|signed up|members|men|people|users)\b(\s+(have\s+)?(joined|signed|already))?/i,
  },
];

function scrub(file: string, text: string): string {
  if (!file.endsWith('seed-social-oct1-2026.ts')) return text;
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

if (failures.length) {
  console.error(`social-copy-guard: FAILED\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log(`social-copy-guard: ok (${FILES.length} files)`);
