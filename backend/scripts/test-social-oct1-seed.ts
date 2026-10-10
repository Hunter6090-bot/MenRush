/**
 * Tests for Oct 1 2026 social seed:
 * - templates render
 * - posts land as draft for campaign oct1-2026
 * - seed is idempotent (second run inserts 0)
 *
 *   cd backend && npm run test:social-oct1
 */
import 'dotenv/config';
import assert from 'assert';
import pool, { query } from '../src/db';
import { renderTemplate } from '../src/services/social.service';
import {
  CAMPAIGN,
  CTA,
  TEMPLATES,
  assertTemplatesRender,
  buildAllPosts,
  buildWeek1And2Posts,
  seedSocialOct1,
  ukWallToUtcIso,
} from './seed-social-oct1-2026';

type Test = { name: string; run: () => void | Promise<void> };
const tests: Test[] = [];

function test(name: string, run: Test['run']) {
  tests.push({ name, run });
}

test('renderTemplate substitutes {{keys}}', () => {
  const out = renderTemplate('Hello {{name}} — {{link}}', {
    name: 'MenRush',
    link: CTA,
  });
  assert.equal(out, `Hello MenRush — ${CTA}`);
});

test('renderTemplate leaves unknown placeholders', () => {
  assert.equal(renderTemplate('{{missing}}', {}), '{{missing}}');
});

test('all campaign templates render with defaults', () => {
  assertTemplatesRender();
  assert.ok(TEMPLATES.length >= 5);
  const categories = new Set(TEMPLATES.map((t) => t.category));
  for (const needed of [
    'launch-signal',
    'nearby-rooms',
    'early-premium',
    'founder-build',
    'trust-discretion',
  ]) {
    assert.ok(categories.has(needed), `missing category ${needed}`);
  }
});

test('week 1–2 coverage includes required platforms each day', () => {
  const posts = buildWeek1And2Posts();
  const byDate = new Map<string, Set<string>>();
  for (const p of posts) {
    if (!byDate.has(p.date)) byDate.set(p.date, new Set());
    byDate.get(p.date)!.add(p.platform);
  }
  assert.ok(byDate.size === 14, `expected 14 days, got ${byDate.size}`);
  for (const [date, platforms] of byDate) {
    for (const need of ['x', 'instagram', 'bluesky', 'tiktok']) {
      assert.ok(platforms.has(need), `${date} missing ${need}`);
    }
    const xCount = posts.filter((p) => p.date === date && p.platform === 'x').length;
    assert.equal(xCount, 2, `${date} should have 2 X posts`);
  }
  const redditDays = [...byDate.entries()].filter(([, p]) => p.has('reddit')).length;
  assert.ok(redditDays >= 4, `expected several Reddit days, got ${redditDays}`);
});

test('ukWallToUtcIso keeps UK morning slot', () => {
  const iso = ukWallToUtcIso('2026-08-18', '08:30');
  assert.equal(iso, '2026-08-18T08:30:00+01:00');
  assert.equal(new Date(iso).toISOString(), '2026-08-18T07:30:00.000Z');
});

test('seed inserts draft oct1-2026 posts and is idempotent', async () => {
  const first = await seedSocialOct1();
  assert.equal(first.templates, TEMPLATES.length);
  assert.ok(first.posts.total === buildAllPosts().length);
  assert.ok(first.posts.inserted + first.posts.skipped === first.posts.total);

  const count = await query(
    `SELECT
       COUNT(*)::text AS n,
       COUNT(*) FILTER (WHERE status = 'draft')::text AS draft_n
     FROM social_posts WHERE campaign = $1`,
    [CAMPAIGN],
  );
  const total = parseInt(count.rows[0].n, 10);
  const drafts = parseInt(count.rows[0].draft_n, 10);
  assert.equal(total, first.posts.total);
  assert.equal(drafts, total, 'every campaign post must remain draft');

  const linkCheck = await query(
    `SELECT COUNT(*)::text AS bad FROM social_posts
     WHERE campaign = $1 AND (link_url IS DISTINCT FROM $2)`,
    [CAMPAIGN, CTA],
  );
  assert.equal(parseInt(linkCheck.rows[0].bad, 10), 0);

  const published = await query(
    `SELECT COUNT(*)::text AS n FROM social_posts
     WHERE campaign = $1 AND status = 'published'`,
    [CAMPAIGN],
  );
  assert.equal(parseInt(published.rows[0].n, 10), 0);

  const second = await seedSocialOct1();
  assert.equal(second.posts.inserted, 0, 're-run must not insert duplicates');
  assert.equal(second.posts.skipped, second.posts.total);

  const count2 = await query(
    `SELECT COUNT(*)::text AS n FROM social_posts WHERE campaign = $1`,
    [CAMPAIGN],
  );
  assert.equal(parseInt(count2.rows[0].n, 10), total);
});

test('seeded templates exist by slug', async () => {
  for (const t of TEMPLATES) {
    const row = await query('SELECT slug, archived_at FROM social_post_templates WHERE slug = $1', [
      t.slug,
    ]);
    assert.equal(row.rows.length, 1, `missing template ${t.slug}`);
    assert.equal(row.rows[0].archived_at, null);
  }
});

async function main() {
  let failed = 0;
  for (const t of tests) {
    try {
      await t.run();
      console.log(`✓ ${t.name}`);
    } catch (err) {
      failed += 1;
      console.error(`✗ ${t.name}`);
      console.error(err);
    }
  }
  if (failed) {
    console.error(`\n${failed} test(s) failed`);
    process.exitCode = 1;
  } else {
    console.log(`\n${tests.length} test(s) passed`);
  }
}

main()
  .then(() => pool.end())
  .catch((err) => {
    console.error(err);
    pool.end().finally(() => process.exit(1));
  });
