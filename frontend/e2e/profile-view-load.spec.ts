/**
 * Profile view load — covers live-beta "profile opens blank".
 * Opening /profile/:id must render the profile body (name + actions), not hang.
 */
import { expect, test, request as apiRequest, type BrowserContext } from '@playwright/test';
import { TEST_PASSWORD, ALICE, BOB } from './test-accounts';
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

test('opening a profile shows body content (not blank)', async ({ browser }) => {
  const alice = await login(ALICE.email);
  const bob = await login(BOB.email);

  const ctx = await browser.newContext();
  await authenticate(ctx, alice);
  const page = await ctx.newPage();

  await page.goto(`/profile/${bob.user.id}`);
  await expect(page.getByTestId('profile-view-body')).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('heading', { name: bob.user.name })).toBeVisible();
  await expect(page.getByTestId('profile-view-message')).toBeVisible();

  await ctx.close();
});
