/**
 * Mobile logged-in shell still reaches map / matches / chat / profile / rooms
 * after route code-splitting (no feature strip).
 */
import { expect, test, request as apiRequest, type BrowserContext, type Page } from '@playwright/test';
import { TEST_PASSWORD, ALICE } from './test-accounts';
import { PLAYWRIGHT_BASE_URL as BASE_URL } from './support/base-url';

type LoginResult = {
  token: string;
  user: { id: string; email: string; name: string };
};

async function login(email: string): Promise<LoginResult> {
  const api = await apiRequest.newContext({ baseURL: BASE_URL });
  try {
    const response = await api.post('/api/auth/login', {
      data: { email, password: TEST_PASSWORD },
    });
    expect(response.ok()).toBeTruthy();
    return response.json();
  } finally {
    await api.dispose();
  }
}

async function authenticate(context: BrowserContext, result: LoginResult) {
  await context.addInitScript(({ token, user }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('menrush_install_prompt_dismissed', '1');
  }, result);
}

function scriptUrls(page: Page) {
  return page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .filter((r) => /\.js(\?|$)/.test(r.name) || r.initiatorType === 'script')
      .map((r) => r.name),
  );
}

for (const project of [
  { name: 'iphone-sized', viewport: { width: 390, height: 844 }, isMobile: true },
  { name: 'android-sized', viewport: { width: 412, height: 915 }, isMobile: true },
]) {
  test.describe(`mobile shell routes (${project.name})`, () => {
    test('chat/profile open without mapbox; discover still loads map', async ({ browser }) => {
      const alice = await login(ALICE.email);
      const ctx = await browser.newContext({
        viewport: project.viewport,
        isMobile: project.isMobile,
        hasTouch: true,
      });
      await authenticate(ctx, alice);
      const page = await ctx.newPage();

      await page.goto('/conversations');
      await expect(
        page.getByText(/Message|Conversation|Inbox|Chat|No conversation/i).first(),
      ).toBeVisible({ timeout: 20_000 });
      const chatScripts = await scriptUrls(page);
      expect(chatScripts.some((u) => /mapbox/i.test(u))).toBe(false);

      await page.goto('/profile');
      await expect(page.getByText(/Profile|Settings|Edit|Photos/i).first()).toBeVisible({
        timeout: 20_000,
      });
      const profileScripts = await scriptUrls(page);
      expect(profileScripts.some((u) => /mapbox/i.test(u))).toBe(false);

      await page.goto('/matches');
      await expect(page.getByText(/Match|Liked|No matches/i).first()).toBeVisible({
        timeout: 20_000,
      });

      await page.goto('/rooms');
      await expect(page.getByText(/Room|Rooms|Group|Chat/i).first()).toBeVisible({
        timeout: 20_000,
      });

      await page.goto('/discover');
      await expect(page.getByText(/Nearby|Discover|MAP|Community|Pulse/i).first()).toBeVisible({
        timeout: 20_000,
      });
      await page.waitForTimeout(2500);
      const discoverScripts = await scriptUrls(page);
      // Production preview: mapbox-*.js chunk. Vite dev: mapbox-gl in module URL.
      expect(discoverScripts.some((u) => /mapbox/i.test(u))).toBe(true);

      await ctx.close();
    });
  });
}
