import { expect, test, request as apiRequest, type BrowserContext, type Page } from '@playwright/test';
import { TEST_PASSWORD, ALICE, BOB } from './test-accounts';
import { PLAYWRIGHT_BASE_URL as BASE_URL } from './support/base-url';

/**
 * #74 leftover: login / first sync must stay badge-only — unread backfill must
 * not dump a toast stack. Live socket events after sync may still toast once.
 */
test.describe.configure({ mode: 'serial' });


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
let bob: LoginResult;

test.beforeAll(async () => {
  const api = await apiRequest.newContext({ baseURL: BASE_URL });
  try {
    alice = await login(api, ALICE.email);
    bob = await login(api, BOB.email);
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

async function closeContextSafely(ctx: BrowserContext): Promise<void> {
  await Promise.race([
    ctx.close().catch(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, 5_000)),
  ]);
}

test('login with unread notifications shows badge only — zero toasts from backfill', async ({
  browser,
}) => {
  const uniqueText = `backfill silent ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Seed while Bob is offline so the row exists only as server backfill on his next session.
  const aliceApi = await apiRequest.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { Authorization: `Bearer ${alice.token}` },
  });
  try {
    const res = await aliceApi.post('/api/messages', {
      data: { receiver_id: bob.user.id, message: uniqueText },
    });
    expect(res.ok()).toBeTruthy();
  } finally {
    await aliceApi.dispose();
  }

  // Confirm the unread row is queryable for Bob before opening the app.
  const bobApi = await apiRequest.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { Authorization: `Bearer ${bob.token}` },
  });
  let unreadBefore = 0;
  try {
    for (let attempt = 0; attempt < 10; attempt++) {
      const list = await (await bobApi.get('/api/notifications')).json();
      unreadBefore = list.unread_count ?? 0;
      const hit = (list.notifications as { body?: string; title?: string }[]).some((n) =>
        (n.body ?? n.title ?? '').includes(uniqueText),
      );
      if (hit && unreadBefore > 0) break;
      await new Promise((r) => setTimeout(r, 300));
    }
    expect(unreadBefore).toBeGreaterThan(0);
  } finally {
    await bobApi.dispose();
  }

  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await authenticate(ctx, bob);
  const page: Page = await ctx.newPage();
  await page.goto('/discover');

  // Badge lives on the mobile Alerts control (desktop sidebar has no notifications nav item).
  await expect(page.getByTestId('badge-notifications')).toBeVisible({ timeout: 15_000 });
  const expectedBadge = unreadBefore > 99 ? '99+' : String(unreadBefore);
  await expect(page.getByTestId('badge-notifications')).toHaveText(expectedBadge, {
    timeout: 10_000,
  });
  await page.waitForTimeout(2500);
  // This backfilled message must not appear as a toast (parallel workers may toast other live events).
  await expect(page.getByText(uniqueText, { exact: false })).toHaveCount(0);
  await expect(
    page.getByTestId('toast-notifications').filter({ hasText: uniqueText }),
  ).toHaveCount(0);

  // Bell is how they see the list.
  await page.getByRole('link', { name: 'Alerts' }).click();
  await expect(page).toHaveURL(/\/notifications/);
  await expect(page.getByText(uniqueText, { exact: false })).toBeVisible({ timeout: 10_000 });

  await closeContextSafely(ctx);
});

test('a live notification after sync may toast once', async ({ browser }) => {
  const ctx = await browser.newContext();
  await authenticate(ctx, bob);
  const page = await ctx.newPage();
  await page.goto('/discover');

  // Wait until the first server sync has completed (badge settled or empty).
  await page.waitForTimeout(2000);

  const uniqueText = `live toast ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const aliceApi = await apiRequest.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { Authorization: `Bearer ${alice.token}` },
  });
  try {
    const res = await aliceApi.post('/api/messages', {
      data: { receiver_id: bob.user.id, message: uniqueText },
    });
    expect(res.ok()).toBeTruthy();
  } finally {
    await aliceApi.dispose();
  }

  await expect(page.getByTestId('toast-notifications')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(uniqueText, { exact: false })).toBeVisible();

  await closeContextSafely(ctx);
});
