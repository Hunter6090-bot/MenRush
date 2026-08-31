/**
 * 1:1 reply send — covers the live-beta "reply will not send" path.
 * Asserts the composer posts text and shows the bubble (no silent failure).
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

test.describe('1:1 chat reply send', () => {
  test('text reply posts and appears in the thread', async ({ browser }) => {
    const alice = await login(ALICE.email);
    const bob = await login(BOB.email);

    const api = await apiRequest.newContext({ baseURL: BASE_URL });
    try {
      await api.post('/api/users/like/' + bob.user.id, {
        headers: { Authorization: `Bearer ${alice.token}` },
      });
      await api.post('/api/users/like/' + alice.user.id, {
        headers: { Authorization: `Bearer ${bob.token}` },
      });
    } finally {
      await api.dispose();
    }

    const ctx = await browser.newContext({
      viewport: { width: 412, height: 915 },
      isMobile: true,
      hasTouch: true,
    });
    await authenticate(ctx, alice);
    const page = await ctx.newPage();

    await page.goto(`/messages/${bob.user.id}`);
    await expect(page.getByTestId('chat-composer')).toBeVisible({ timeout: 15000 });

    const text = `reply send ${Date.now()}`;
    const input = page.getByTestId('chat-text-input');
    await input.fill(text);

    const send = page.getByTestId('chat-send-button');
    await expect(send).toBeVisible();
    await send.click();

    await expect(page.getByText(text, { exact: true })).toBeVisible({ timeout: 10000 });
    await expect(input).toHaveValue('');

    await ctx.close();
  });
});
