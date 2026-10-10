/**
 * Welcome emails use the official MenRush mark, never a typed wordmark.
 *
 * Run from backend/:
 *   npm run test:welcome-email-brand
 */
import assert from 'assert';
import fs from 'fs';
import {
  OFFICIAL_MARK_URL,
  REMOVED_WELCOME_PAGES,
  renderWelcomeTemplates,
  repoPath,
} from './welcome-email-templates';

type Test = { name: string; run: () => void };
const tests: Test[] = [];
const test = (name: string, run: Test['run']) => tests.push({ name, run });

/** Visible text only: drop comments, head/style blocks, tags and attributes. */
function visibleText(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(head|style|script)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ');
}

const imgTags = (html: string) => html.match(/<img\b[^>]*>/gi) ?? [];
const attr = (tag: string, name: string) =>
  tag.match(new RegExp(`\\b${name}="([^"]*)"`, 'i'))?.[1];

const templates = renderWelcomeTemplates();

for (const { name, html } of templates) {
  test(`${name}: no typed MENRUSH wordmark`, () => {
    assert.ok(!/MENRUSH/.test(visibleText(html)), 'typed MENRUSH wordmark found');
    assert.ok(!/letter-spacing:\s*[3-9]px[^"]*"[^>]*>\s*MenRush\s*</i.test(html), 'spaced-out MenRush wordmark found');
  });

  test(`${name}: header logo is the official mark, unmodified`, () => {
    const logos = imgTags(html).filter((t) => /alt="MenRush"/.test(t));
    // waitlist-welcome.html has never had a logo; it must still not fake one.
    if (name.endsWith('waitlist-welcome.html') && logos.length === 0) return;
    assert.strictEqual(logos.length, 1, 'expected exactly one MenRush logo <img>');
    const tag = logos[0];
    assert.strictEqual(attr(tag, 'src'), OFFICIAL_MARK_URL);
    const width = Number(attr(tag, 'width'));
    assert.ok(width >= 120 && width <= 160, `logo width ${width} outside 120-160px`);
    assert.ok(!/border-radius/i.test(tag), 'logo must not be cropped into a circle');
    assert.ok(!/background/i.test(tag), 'logo must not sit on a filled backdrop');
  });

  test(`${name}: no other logo files or inlined copies`, () => {
    for (const tag of imgTags(html)) {
      const src = attr(tag, 'src') ?? '';
      assert.ok(!/menrush-logo[^"]*\.png/i.test(src), `black-plate logo used: ${src}`);
      assert.ok(!src.startsWith('data:'), 'logo must be the hosted file, not an inlined copy');
    }
  });
}

test('unused welcome.html is gone (both copies)', () => {
  for (const rel of REMOVED_WELCOME_PAGES) {
    assert.ok(!fs.existsSync(repoPath(rel)), `${rel} should be deleted`);
  }
});

let failed = 0;
for (const t of tests) {
  try {
    t.run();
    console.log(`ok   ${t.name}`);
  } catch (err) {
    failed += 1;
    console.error(`FAIL ${t.name}\n     ${(err as Error).message}`);
  }
}
console.log(`\n${tests.length - failed}/${tests.length} passed`);
if (failed) process.exit(1);
