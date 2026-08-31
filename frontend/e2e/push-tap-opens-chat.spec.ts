/**
 * Push tap / deep-link must open the 1:1 conversation (PR #158).
 * Simulates the service-worker postMessage path used on iPhone PWAs where
 * WindowClient.navigate() often no-ops after focus().
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

test.describe('push notification tap opens 1:1 chat', () => {
  test('SW navigate message opens /messages/:peerId from another route', async ({ browser }) => {
    const alice = await login(ALICE.email);
    const bob = await login(BOB.email);

    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    await authenticate(ctx, alice);
    const page = await ctx.newPage();

    await page.goto('/discover');
    await expect(page).toHaveURL(/\/discover/);

    await page.evaluate((peerId) => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'MENRUSH_NOTIFICATION_NAVIGATE', url: `/messages/${peerId}` },
        }),
      );
      // usePushDeepLink listens on navigator.serviceWorker — mirror the SW bridge.
      const sw = navigator.serviceWorker as ServiceWorkerContainer & {
        dispatchEvent?: (e: Event) => boolean;
      };
      const listeners = (sw as unknown as { __listeners?: Array<(e: MessageEvent) => void> }).__listeners;
      void listeners;
      navigator.serviceWorker.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'MENRUSH_NOTIFICATION_NAVIGATE', url: `/messages/${peerId}` },
        }),
      );
    }, bob.user.id);

    await expect(page).toHaveURL(new RegExp(`/messages/${bob.user.id}`), { timeout: 10000 });
    await expect(page.getByTestId('chat-composer')).toBeVisible({ timeout: 15000 });

    await ctx.close();
  });
});
