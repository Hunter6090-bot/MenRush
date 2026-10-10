/**
 * In-app notification tray: tap a message/photo alert → open that 1:1 chat (PR #158).
 * Owner fail: tap cleared the row (mark-read + unread filter) without routing.
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

test.describe('in-app notification tap opens chat', () => {
  test('message notification row opens /messages/:peerId (does not only clear)', async ({
    browser,
  }) => {
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
      const send = await api.post('/api/messages', {
        headers: { Authorization: `Bearer ${alice.token}` },
        data: { receiver_id: bob.user.id, message: `notif tap ${Date.now()}` },
      });
      expect(send.ok(), await send.text()).toBeTruthy();
    } finally {
      await api.dispose();
    }

    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    await authenticate(ctx, bob);
    const page = await ctx.newPage();

    await page.goto('/notifications');
    await expect(page.getByTestId('notifications-list')).toBeVisible({ timeout: 15000 });

    const openBtn = page.locator('[data-testid^="notification-open-"][data-notification-type="message"]').first();
    await expect(openBtn).toBeVisible({ timeout: 10000 });
    await openBtn.click();

    await expect(page).toHaveURL(new RegExp(`/messages/${alice.user.id}`), { timeout: 10000 });
    await expect(page.getByTestId('chat-composer')).toBeVisible({ timeout: 15000 });

    await ctx.close();
  });
});
