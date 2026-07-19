import { expect, test, request as apiRequest, type BrowserContext } from '@playwright/test';
import { TEST_PASSWORD, ALICE, BOB } from './test-accounts';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5173';

async function login(email: string) {
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

async function authenticate(context: BrowserContext, result: { token: string; user: unknown }) {
  await context.addInitScript(({ token, user }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  }, result);
}

test.describe('match live location in chat', () => {
  test('collapsed bar visible and expands to full map', async ({ browser }) => {
    const auth = await login(ALICE.email);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await authenticate(ctx, auth);
    const page = await ctx.newPage();

    await page.goto(`/messages/${BOB.id}`);

    const bar = page.getByTestId('match-live-location-bar');
    await expect(bar).toBeVisible({ timeout: 15000 });
    await expect(bar.getByText(/Live location/i)).toBeVisible();
    await expect(bar.getByText(/Bob is/i)).toBeVisible();
    await expect(bar.getByText(/Show map/i)).toBeVisible();

    await bar.getByRole('button', { name: /Show map/i }).click();
    await expect(page.getByTestId('match-live-location-map')).toBeVisible();
    await expect(bar.getByText(/Get directions/i)).toBeVisible();
    await expect(bar.getByText(/Open in maps/i)).toBeVisible();

    await ctx.close();
  });
});