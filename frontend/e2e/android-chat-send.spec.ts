/**
 * Android Chrome–oriented chat send checks (Pixel-sized viewport + Android UA).
 * Complements the Kev production report (Android, not iPhone).
 */
import { expect, test, request as apiRequest, type BrowserContext } from '@playwright/test';
import { TEST_PASSWORD, ALICE, BOB } from './test-accounts';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:4173';

type LoginResult = {
  token: string;
  user: { id: string; email: string; name: string };
};

async function login(request: any, email: string): Promise<LoginResult> {
  const response = await request.post('/api/auth/login', {
    data: { email, password: TEST_PASSWORD },
  });
  expect(response.ok()).toBeTruthy();
  return response.json();
}

async function authenticate(context: BrowserContext, result: LoginResult) {
  await context.addInitScript(({ token, user }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  }, result);
}

test.describe('Android Chrome chat send', () => {
  test.use({
    viewport: { width: 412, height: 915 },
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36',
    isMobile: true,
    hasTouch: true,
  });

  test('Send tap posts text and shows the bubble (no silent failure)', async ({
    browser,
  }) => {
    const api = await apiRequest.newContext({ baseURL: BASE_URL });
    let alice: LoginResult;
    let bob: LoginResult;
    try {
      alice = await login(api, ALICE.email);
      bob = await login(api, BOB.email);
    } finally {
      await api.dispose();
    }

    const ctx = await browser.newContext({
      viewport: { width: 412, height: 915 },
      userAgent:
        'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36',
      isMobile: true,
      hasTouch: true,
    });
    await authenticate(ctx, alice);
    const page = await ctx.newPage();

    await page.goto(`/messages/${bob.user.id}`);
    await expect(page.getByTestId('chat-composer')).toBeVisible({ timeout: 15000 });

    const text = `android chrome send ${Date.now()}`;
    const input = page.getByTestId('chat-text-input');
    await input.tap();
    await input.fill(text);

    // Confirm Android-oriented attributes are present.
    await expect(input).toHaveAttribute('enterkeyhint', 'send');

    const send = page.getByTestId('chat-send-button');
    await expect(send).toBeVisible();
    // Touch path (not mouse click) — matches Android Chrome.
    await send.tap();

    await expect(page.getByText(text, { exact: true })).toBeVisible({ timeout: 10000 });
    // Composer should not leave a silent failure with text stuck + no bubble.
    await expect(input).toHaveValue('');

    await ctx.close();
  });
});
