import { expect, test, request as apiRequest, type BrowserContext, type Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:4173';

type LoginResult = {
  token: string;
  user: { id: string; email: string; name: string; is_verified: boolean; verification_status: string };
};

async function login(request: any, email: string): Promise<LoginResult> {
  const response = await request.post('/api/auth/login', { data: { email, password: 'password123' } });
  expect(response.ok()).toBeTruthy();
  return response.json();
}

let alice: LoginResult;
let bob: LoginResult;

test.beforeAll(async () => {
  const api = await apiRequest.newContext({ baseURL: BASE_URL });
  try {
    alice = await login(api, 'alice@example.com');
    bob = await login(api, 'bob@example.com');
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

// ── Notification settings (permission gating) ────────────────────────────────

test('notification permission is requested only by a clear user action', async ({ browser }) => {
  const ctx = await browser.newContext();
  await authenticate(ctx, alice);

  // Fake a fresh, supported browser with permission still at "default".
  await ctx.addInitScript(() => {
    const w = window as any;
    w.__permRequests = 0;
    const state = { permission: 'default' };
    class FakeNotification {}
    (FakeNotification as any).requestPermission = () => {
      w.__permRequests += 1;
      state.permission = 'granted';
      return Promise.resolve('granted');
    };
    Object.defineProperty(FakeNotification, 'permission', { get: () => state.permission });
    w.Notification = FakeNotification;
  });

  const page = await ctx.newPage();
  await page.goto('/profile');

  const card = page.getByTestId('notification-settings');
  await expect(card).toBeVisible();
  // Loading the page must NOT trigger a permission prompt.
  expect(await page.evaluate(() => (window as any).__permRequests)).toBe(0);
  await expect(page.getByTestId('notification-settings-status')).toContainText(/turn on alerts/i);

  // The toggle is the explicit user action that requests permission.
  await page.getByTestId('notification-settings-toggle').click();
  await expect
    .poll(async () => page.evaluate(() => (window as any).__permRequests))
    .toBe(1);
  await expect(page.getByTestId('notification-settings-toggle')).toHaveAttribute('aria-pressed', 'true');

  await ctx.close();
});

test('unsupported browsers show an honest, disabled state', async ({ browser }) => {
  const ctx = await browser.newContext();
  await authenticate(ctx, alice);
  await ctx.addInitScript(() => {
    try {
      // Remove push support so the app can't pretend notifications work.
      delete (window as any).PushManager;
    } catch {}
  });

  const page = await ctx.newPage();
  await page.goto('/profile');

  await expect(page.getByTestId('notification-settings-status')).toContainText(/doesn’t support|does not support/i);
  await expect(page.getByTestId('notification-settings-toggle')).toBeDisabled();

  await ctx.close();
});

// ── Foreground unread badge ──────────────────────────────────────────────────

test('a new message raises the unread badge and opening the chat clears it', async ({ browser }) => {
  const bobCtx = await browser.newContext();
  await authenticate(bobCtx, bob);
  const bobPage: Page = await bobCtx.newPage();

  // Bob sits on discovery so his socket is connected but he's not in the chat.
  await bobPage.goto('/discover');
  await bobPage.waitForTimeout(1500); // allow the socket to authenticate

  // Alice sends Bob a message via the API (server pushes it over the socket).
  const aliceApi = await apiRequest.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { Authorization: `Bearer ${alice.token}` },
  });
  try {
    const res = await aliceApi.post('/api/messages', {
      data: { receiver_id: bob.user.id, message: `Hey from the badge test ${Date.now()}` },
    });
    expect(res.ok()).toBeTruthy();
  } finally {
    await aliceApi.dispose();
  }

  // The Messages tab badge reflects the unread message in real time.
  await expect(bobPage.getByTestId('badge-conversations')).toHaveText('1', { timeout: 10_000 });

  // Opening the conversations list clears the unread state.
  await bobPage.goto('/conversations');
  await expect(bobPage.getByTestId('badge-conversations')).toHaveCount(0);

  await bobCtx.close();
});

test('opening a conversation thread clears that sender from the unread badge', async ({ browser }) => {
  const bobCtx = await browser.newContext();
  await authenticate(bobCtx, bob);
  const bobPage = await bobCtx.newPage();

  await bobPage.goto('/discover');
  await bobPage.waitForTimeout(1500);

  const aliceApi = await apiRequest.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { Authorization: `Bearer ${alice.token}` },
  });
  try {
    const res = await aliceApi.post('/api/messages', {
      data: { receiver_id: bob.user.id, message: `Direct thread clear ${Date.now()}` },
    });
    expect(res.ok()).toBeTruthy();
  } finally {
    await aliceApi.dispose();
  }

  await expect(bobPage.getByTestId('badge-conversations')).toHaveText('1', { timeout: 10_000 });

  // Opening the thread directly (full-screen chat) clears that sender's unread.
  await bobPage.goto(`/messages/${alice.user.id}`);
  await expect(bobPage.getByRole('button', { name: /Open .*profile/i })).toBeVisible();
  await bobPage.goto('/discover');
  await expect(bobPage.getByTestId('badge-conversations')).toHaveCount(0);

  await bobCtx.close();
});
