/**
 * Matches + Chat must paint from warm cache on tab revisit (stale-while-revalidate).
 * Owner P0: blank placeholders / skeletons must not reappear when last-known rows exist.
 */
import { expect, test } from '@playwright/test';
import { TEST_PASSWORD, ALICE } from './test-accounts';
import { PLAYWRIGHT_BASE_URL as BASE_URL } from './support/base-url';

test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});

test('Matches paints cached cards instantly on remount; Chat list same', async ({
  browser,
  request,
}) => {
  const loginRes = await request.post(`${BASE_URL}/api/auth/login`, {
    data: { email: ALICE.email, password: TEST_PASSWORD },
  });
  expect(loginRes.ok()).toBeTruthy();
  const auth = await loginRes.json();

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
  let matchesHits = 0;
  let convHits = 0;

  await page.route('**/api/users/likes/received**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  await page.route('**/api/users/matches**', async (route) => {
    matchesHits += 1;
    // First response is instant; later remount revalidates slowly — cache must paint first.
    if (matchesHits > 1) {
      await new Promise((r) => setTimeout(r, 2500));
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'm-warm-1',
          name: 'WarmMatch',
          age: 34,
          photo_url: '/uploads/profiles/warm.jpg',
          online: true,
          matched_at: new Date().toISOString(),
        },
      ]),
    });
  });

  await page.route('**/api/messages/conversations**', async (route) => {
    convHits += 1;
    if (convHits > 1) {
      await new Promise((r) => setTimeout(r, 2500));
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          other_user_id: 'c-warm-1',
          other_user_name: 'WarmChat',
          last_message_time: new Date().toISOString(),
          last_message: 'hey',
          online: true,
        },
      ]),
    });
  });

  await page.route('**/api/media/display**', async (route) => {
    await route.fulfill({ status: 404, body: 'no' });
  });
  await page.route('**/uploads/profiles/**', async (route) => {
    await new Promise((r) => setTimeout(r, 3000));
    await route.abort();
  });

  // Prime cache via first Matches visit.
  await page.goto('/matches', { waitUntil: 'domcontentloaded' });
  const dismiss = page.getByRole('button', { name: /Not now/i });
  if (await dismiss.isVisible().catch(() => false)) await dismiss.click();
  await expect(page.getByText('WarmMatch').first()).toBeVisible({ timeout: 6_000 });
  // Name paints even while photo pending.
  await expect(page.getByTestId('match-card-m-warm-1')).toBeVisible();

  // Leave and return — must paint from cache without skeleton wait.
  await page.goto('/discover', { waitUntil: 'domcontentloaded' });
  const tRemount = Date.now();
  await page.goto('/matches', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('WarmMatch').first()).toBeVisible({ timeout: 1_500 });
  expect(Date.now() - tRemount).toBeLessThan(2_000);
  await expect(page.getByTestId('matches-skeleton')).toHaveCount(0);

  // Chat inbox: prime then remount with slow revalidate.
  await page.goto('/conversations', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('WarmChat').first()).toBeVisible({ timeout: 6_000 });
  await page.goto('/discover', { waitUntil: 'domcontentloaded' });
  const tChat = Date.now();
  await page.goto('/conversations', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('WarmChat').first()).toBeVisible({ timeout: 1_500 });
  expect(Date.now() - tChat).toBeLessThan(2_000);
  await expect(page.getByTestId('conversations-skeleton')).toHaveCount(0);

  await ctx.close();
});
