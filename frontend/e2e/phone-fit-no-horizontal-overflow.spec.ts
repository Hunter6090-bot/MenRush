/**
 * P0 phone-fit: first paint on phone-sized viewports must not require
 * pinch-to-shrink. Document scrollWidth must stay ≤ clientWidth.
 *
 * Covers public landing + a logged-in shell (Discover) on:
 * - 390×844 (iPhone-class)
 * - 412×915 (Android-class)
 *
 * Does not disable user scaling (maps/rooms pinch must keep working).
 */
import { expect, test, request as apiRequest, type BrowserContext, type Page } from '@playwright/test';
import { TEST_PASSWORD, ALICE } from './test-accounts';
import { PLAYWRIGHT_BASE_URL as BASE_URL } from './support/base-url';

const PHONE_VIEWPORTS = [
  { name: 'iphone-390', width: 390, height: 844 },
  { name: 'android-412', width: 412, height: 915 },
] as const;

async function assertNoHorizontalOverflow(page: Page) {
  await page.evaluate(() => document.fonts.ready).catch(() => undefined);
  // Settle first paint / lazy chrome without waiting forever on sockets.
  await page.waitForTimeout(400);

  const metrics = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    return {
      clientWidth: doc.clientWidth,
      scrollWidth: Math.max(doc.scrollWidth, body.scrollWidth),
      overflow: Math.max(doc.scrollWidth, body.scrollWidth) - doc.clientWidth,
      viewport: document.querySelector('meta[name="viewport"]')?.getAttribute('content') ?? '',
      scale: window.visualViewport?.scale ?? 1,
    };
  });

  expect(
    metrics.viewport,
    'viewport meta must keep device-width + initial-scale=1 (no user-scalable=no-only fix)',
  ).toMatch(/width\s*=\s*device-width/i);
  expect(metrics.viewport).toMatch(/initial-scale\s*=\s*1(\.0)?/i);
  expect(metrics.viewport).not.toMatch(/user-scalable\s*=\s*no/i);

  // Allow 1–2px subpixel / scrollbar noise; anything larger is a real widen.
  expect(
    metrics.overflow,
    `horizontal overflow on ${page.url()} (scroll=${metrics.scrollWidth} client=${metrics.clientWidth})`,
  ).toBeLessThanOrEqual(2);
}

async function loginAlice() {
  const api = await apiRequest.newContext({ baseURL: BASE_URL });
  try {
    const response = await api.post('/api/auth/login', {
      data: { email: ALICE.email, password: TEST_PASSWORD },
    });
    expect(response.ok()).toBeTruthy();
    return response.json() as Promise<{
      token: string;
      user: { id: string; email: string; name: string };
    }>;
  } finally {
    await api.dispose();
  }
}

async function authenticate(context: BrowserContext, auth: { token: string; user: unknown }) {
  await context.addInitScript(({ token, user }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('menrush_install_prompt_dismissed', '1');
    localStorage.setItem('menrush_push_banner_snooze_until', String(Date.now() + 86_400_000));
  }, auth);
}

for (const vp of PHONE_VIEWPORTS) {
  test.describe(`phone-fit @ ${vp.name} (${vp.width}×${vp.height})`, () => {
    test('public landing has no horizontal overflow', async ({ browser }) => {
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        isMobile: true,
        hasTouch: true,
      });
      const page = await ctx.newPage();
      await page.goto('/');
      await expect(
        page.getByRole('heading', {
          level: 1,
          name: /Real men\.\s*Verified profiles\.\s*Total discretion\./i,
        }),
      ).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText(/LIVE NOW\. UK BETA OPEN/i)).toBeVisible();
      await assertNoHorizontalOverflow(page);
      await ctx.close();
    });

    test('logged-in Discover shell has no horizontal overflow', async ({ browser }) => {
      const alice = await loginAlice();
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        isMobile: true,
        hasTouch: true,
      });
      await authenticate(ctx, alice);
      const page = await ctx.newPage();
      await page.goto('/discover');
      await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible({
        timeout: 20_000,
      });
      await assertNoHorizontalOverflow(page);
      await ctx.close();
    });
  });
}
