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

test.describe('chat location privacy', () => {
  test('no continuous live pin bar; one-shot send location remains', async ({ browser }) => {
    const auth = await login(ALICE.email);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await authenticate(ctx, auth);
    const page = await ctx.newPage();

    await page.goto(`/messages/${BOB.id}`);

    // Continuous live tracking UI must be gone.
    await expect(page.getByTestId('match-live-location-bar')).toHaveCount(0);
    await expect(page.getByTestId('match-live-location-map')).toHaveCount(0);

    // WhatsApp-style one-shot current location send stays available.
    await expect(page.getByRole('button', { name: /Send current location/i })).toBeVisible({
      timeout: 15000,
    });

    await ctx.close();
  });
});
