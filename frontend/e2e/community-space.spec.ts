import { expect, test, request as apiRequest, type BrowserContext } from '@playwright/test';
import { TEST_PASSWORD, ALICE } from './test-accounts';

test.describe.configure({ mode: 'serial' });

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:4173';

type LoginResult = {
  token: string;
  user: { id: string; email: string; name: string; is_verified: boolean; verification_status: string };
};

async function login(request: any, email: string): Promise<LoginResult> {
  const response = await request.post('/api/auth/login', { data: { email, password: TEST_PASSWORD } });
  expect(response.ok()).toBeTruthy();
  return response.json();
}

let alice: LoginResult;

test.beforeAll(async () => {
  const api = await apiRequest.newContext({ baseURL: BASE_URL });
  try {
    alice = await login(api, ALICE.email);
  } finally {
    await api.dispose();
  }
});

async function authenticate(context: BrowserContext, result: LoginResult) {
  await context.addInitScript(({ token, user }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  }, result);
}

test('MAP | COMMUNITY toggle labels Community (not Live profile list)', async ({ browser }) => {
  const ctx = await browser.newContext({
    geolocation: { latitude: 51.5074, longitude: -0.1278 },
    permissions: ['geolocation'],
    viewport: { width: 390, height: 844 },
  });
  await authenticate(ctx, alice);
  const page = await ctx.newPage();
  await page.goto('/discover');

  const toggle = page.getByTestId('discover-community-toggle');
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveText(/community/i);
  await expect(page.getByText(/live profile list/i)).toHaveCount(0);

  await toggle.click();
  await expect(page).toHaveURL(/\/stream/);
  await expect(page.getByTestId('community-feed')).toBeVisible();
  await expect(page.getByTestId('community-composer')).toBeVisible();
  await expect(page.getByRole('group', { name: 'Discovery surface' })).toContainText(/community/i);

  await ctx.close();
});

test('signed-in user can create a ≤280 char Community post', async ({ browser }) => {
  const ctx = await browser.newContext({
    geolocation: { latitude: 51.5074, longitude: -0.1278 },
    permissions: ['geolocation'],
  });
  await authenticate(ctx, alice);
  const page = await ctx.newPage();
  await page.goto('/stream');

  await expect(page.getByTestId('community-feed')).toBeVisible({ timeout: 15_000 });
  const input = page.getByTestId('community-post-input');
  await expect(input).toBeVisible({ timeout: 15_000 });

  const body = `Hosting near Soho — open to drinks ${Date.now()}`;
  await input.fill(body);
  await page.getByTestId('community-post-submit').click();

  await expect(page.getByTestId('community-post-list')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('community-post').first()).toContainText(body);
  await expect(page.getByTestId('community-post').first()).toContainText(/ago|Just now|m ago|h ago/i);

  // No video / rooms chrome inside the feed.
  await expect(page.getByTestId('community-feed').locator('video')).toHaveCount(0);
  await expect(page.getByTestId('community-feed').getByText(/^rooms$/i)).toHaveCount(0);

  await ctx.close();
});
