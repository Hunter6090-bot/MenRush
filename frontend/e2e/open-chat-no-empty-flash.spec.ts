/**
 * Opening an existing 1:1 must not flash the empty/new-chat icebreakers while
 * history is still fetching. Slow the conversation API and assert loading (or
 * preview) instead of "No messages yet".
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

test.describe('open existing chat — no empty flash', () => {
  test.use({
    viewport: { width: 412, height: 915 },
    isMobile: true,
    hasTouch: true,
  });

  test('slow history fetch does not show icebreakers for an existing thread', async ({
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
      await api.post(
        '/api/messages',
        { receiver_id: bob.user.id, message: `history seed ${Date.now()}` },
        { headers: { Authorization: `Bearer ${alice.token}` } },
      );
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

    // Warm inbox so rememberInboxThread seeds the session cache / known-non-empty.
    await page.goto('/conversations');
    await expect(page.getByTestId(`conversation-open-chat-${bob.user.id}`)).toBeVisible({
      timeout: 20000,
    });

    let releaseConversation: (() => void) | null = null;
    const conversationGate = new Promise<void>((resolve) => {
      releaseConversation = resolve;
    });

    await page.route(`**/api/messages/conversation/${bob.user.id}**`, async (route) => {
      await conversationGate;
      await route.continue();
    });

    await page.getByTestId(`conversation-open-chat-${bob.user.id}`).click();
    await expect(page.getByTestId('chat-composer')).toBeVisible({ timeout: 15000 });

    // While history is held: never show empty/new-chat icebreakers.
    await expect(page.getByTestId('chat-icebreakers')).toHaveCount(0);
    // Either inbox preview text or loading skeleton must be present — not blank empty-state.
    const previewOrLoading = page
      .getByTestId('chat-history-loading')
      .or(page.getByText(/history seed/));
    await expect(previewOrLoading.first()).toBeVisible({ timeout: 5000 });

    releaseConversation?.();
    await expect(page.getByText(/history seed/)).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId('chat-icebreakers')).toHaveCount(0);

    await ctx.close();
  });

  test('true empty chat may still show icebreakers after history resolves', async ({
    browser,
  }) => {
    const alice = await login(ALICE.email);
    const emptyPeerId = '00000000-0000-4000-8000-0000000000e1';

    const ctx = await browser.newContext({
      viewport: { width: 412, height: 915 },
      isMobile: true,
      hasTouch: true,
    });
    await authenticate(ctx, alice);
    const page = await ctx.newPage();

    await page.route(`**/api/messages/conversation/${emptyPeerId}**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '[]',
      });
    });
    await page.route(`**/api/users/${emptyPeerId}**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ name: 'EmptyPeer', online: false }),
      });
    });
    await page.route(`**/api/meet/**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          my_confirmed: false,
          peer_confirmed: false,
          mutual: false,
          my_confirmed_at: null,
          peer_confirmed_at: null,
        }),
      });
    });

    await page.goto(`/messages/${emptyPeerId}`);
    await expect(page.getByTestId('chat-composer')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('chat-icebreakers')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('No messages yet')).toBeVisible();

    await ctx.close();
  });
});
