/**
 * Matches must paint names/cards near Chat's 3–4s control — not wait 25–30s
 * on iPhone for likes + multi‑MB photos. Chat list path is asserted untouched.
 */
import { expect, test, request as apiRequest } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TEST_PASSWORD, ALICE } from './test-accounts';
import { PLAYWRIGHT_BASE_URL as BASE_URL } from './support/base-url';

const here = fileURLToPath(new URL('.', import.meta.url));

const tinyJpeg = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGcP//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//Z',
  'base64',
);

test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});

test('Matches cards paint fast; Chat list stays light (iPhone-sized)', async ({ browser }) => {
  const api = await apiRequest.newContext({ baseURL: BASE_URL });
  const loginRes = await api.post('/api/auth/login', {
    data: { email: ALICE.email, password: TEST_PASSWORD },
  });
  expect(loginRes.ok()).toBeTruthy();
  const auth = await loginRes.json();
  await api.dispose();

  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await ctx.addInitScript(({ token, user }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('menrush_install_prompt_dismissed', '1');
  }, auth);

  const page = await ctx.newPage();

  // Slow likes must NOT block mutual match cards (owner iPhone 25–30s fail mode).
  await page.route('**/api/users/likes/received**', async (route) => {
    await new Promise((r) => setTimeout(r, 8000));
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  await page.route('**/api/users/matches**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'm-1',
          name: 'PeteMatch',
          age: 36,
          photo_url: '/uploads/profiles/match-huge.jpg',
          online: true,
          matched_at: new Date().toISOString(),
        },
      ]),
    });
  });

  await page.route('**/api/media/display**', async (route) => {
    await route.fulfill({ status: 404, body: 'no' });
  });

  await page.route('**/uploads/profiles/match-huge.jpg', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'image/jpeg',
      body: Buffer.concat([tinyJpeg, Buffer.alloc(200_000)]),
    });
  });

  const tMatches = Date.now();
  await page.goto('/matches', { waitUntil: 'domcontentloaded' });
  const dismiss = page.getByRole('button', { name: /Not now/i });
  if (await dismiss.isVisible().catch(() => false)) await dismiss.click();

  // Cards/names must appear well under Chat's ~3–4s control — not after slow likes.
  await expect(page.getByText('PeteMatch').first()).toBeVisible({ timeout: 6_000 });
  expect(Date.now() - tMatches).toBeLessThan(8_000);

  // Chat control: conversations open without mapbox and without grid photo pipeline.
  const tChat = Date.now();
  await page.goto('/conversations', { waitUntil: 'domcontentloaded' });
  await expect(
    page.getByText(/Message|Conversation|Inbox|Chat|No conversation/i).first(),
  ).toBeVisible({ timeout: 8_000 });
  expect(Date.now() - tChat).toBeLessThan(8_000);

  const scripts = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .map((r) => r.name)
      .filter((n) => /\.js(\?|$)/.test(n)),
  );
  expect(scripts.some((u) => /mapbox/i.test(u))).toBe(false);

  // Guard: ConversationList must not use the heavy grid downscale path.
  const convSrc = readFileSync(resolve(here, '../src/components/ConversationList.tsx'), 'utf8');
  expect(convSrc).not.toMatch(/useGridPhotoSrc|nearbyPhotoSrc/);
  const matchesSrc = readFileSync(resolve(here, '../src/pages/Matches.tsx'), 'utf8');
  expect(matchesSrc).toMatch(/clearGridPhotoQueue/);
  expect(matchesSrc).toMatch(/setLoading\(false\)/);

  await ctx.close();
});
