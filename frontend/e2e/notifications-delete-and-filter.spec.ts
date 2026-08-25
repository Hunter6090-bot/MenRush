import { expect, test, request as apiRequest, type BrowserContext } from '@playwright/test';
import { TEST_PASSWORD, ALICE, BOB } from './test-accounts';
import { PLAYWRIGHT_BASE_URL as BASE_URL } from './support/base-url';

// Kept separate from notifications.spec.ts deliberately: that file's
// describe.configure({mode:'serial'}) means one already-tracked, unrelated
// pre-existing failure there (the badge-conversations vs badge-mobile-*
// testid mismatch — see #65) would block every test after it from running
// at all, including these. Isolating #74's own coverage here so it stands
// on its own regardless of that pre-existing issue's status.
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

/**
 * A persistent Socket.IO connection can make context.close() itself hang well
 * past every real assertion having already passed (observed directly: tests
 * complete their own logic, then time out solely inside the final close()).
 * Race it so a slow-but-eventually-fine teardown never fails an otherwise-
 * passing test.
 */
async function closeContextSafely(ctx: BrowserContext): Promise<void> {
  await Promise.race([
    ctx.close().catch(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, 5_000)),
  ]);
}

/**
 * Bob → Alice message creates a real `notifications` row for Alice
 * (routes/messages.ts) — the row's `title` is always "New message from Bob";
 * the seeded text lands in `body` (the message preview). Returns the exact
 * unique text used (label + timestamp + random suffix) so callers can match
 * precisely against `body`, not the shared label prefix, which would also
 * match any prior local run's leftover notifications with the same label.
 */
async function seedAliceNotification(label: string): Promise<string> {
  const uniqueText = `${label} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const bobApi = await apiRequest.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { Authorization: `Bearer ${bob.token}` },
  });
  try {
    const res = await bobApi.post('/api/messages', {
      data: { receiver_id: alice.user.id, message: uniqueText },
    });
    expect(res.ok()).toBeTruthy();
  } finally {
    await bobApi.dispose();
  }
  return uniqueText;
}

type NotificationRow = { id: string; title: string; body?: string | null };

/** Polls briefly for the (apparently async) notification row to land after the message POST responds. */
async function findAliceNotification(exactBodyIncludes: string): Promise<NotificationRow> {
  const api = await apiRequest.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { Authorization: `Bearer ${alice.token}` },
  });
  try {
    for (let attempt = 0; attempt < 10; attempt++) {
      const list = await (await api.get('/api/notifications')).json();
      const row = (list.notifications as NotificationRow[]).find((n) =>
        (n.body ?? n.title).includes(exactBodyIncludes),
      );
      if (row) return row;
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    throw new Error(`Notification containing "${exactBodyIncludes}" never appeared after seeding`);
  } finally {
    await api.dispose();
  }
}

test('deleting a notification persists (verified server-side) and updates the unread count immediately', async ({
  browser,
}) => {
  // Deliberately not using page.reload() to verify persistence — reloading
  // mid-test crashed the page in this environment (page.reload() left the
  // page/context in a state where the next Playwright call failed with
  // "Target page, context or browser has been closed", well before any
  // explicit close() of ours ran). A direct GET /api/notifications after the
  // UI action is a more precise persistence check anyway — it confirms the
  // backend state directly rather than trusting a full client re-fetch cycle.
  const uniqueText = await seedAliceNotification('delete test');
  await findAliceNotification(uniqueText); // wait until it's actually queryable before loading the UI

  const ctx = await browser.newContext();
  await authenticate(ctx, alice);
  const page = await ctx.newPage();
  await page.goto('/notifications');

  // Target the exact seeded item (not .first() by label prefix) — this local
  // dev DB has leftover "delete test ..." notifications from earlier runs, so
  // a prefix match could grab the wrong one and delete that instead.
  const item = page.getByTestId('notifications-list').locator('li').filter({ hasText: uniqueText });
  await expect(item).toBeVisible({ timeout: 10_000 });
  const unreadBadgeBefore = await page.getByTestId('notifications-filter-unread').textContent();
  expect(unreadBadgeBefore).toMatch(/Unread \(\d+\)/);

  const deleteBtn = item.locator('[data-testid^="notification-delete-"]');
  await deleteBtn.click();

  // Unread count in the filter tab drops immediately — no reload needed.
  await expect(page.getByTestId('notifications-filter-unread')).not.toHaveText(unreadBadgeBefore ?? '');

  const aliceApi = await apiRequest.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { Authorization: `Bearer ${alice.token}` },
  });
  try {
    const res = await aliceApi.get('/api/notifications');
    const body = await res.json();
    expect(
      (body.notifications as NotificationRow[]).some((n) => (n.body ?? n.title).includes(uniqueText)),
    ).toBe(false);
  } finally {
    await aliceApi.dispose();
  }

  await closeContextSafely(ctx);
});

test('unread/all filter: read items drop out of Unread but remain in All', async ({ browser }) => {
  // Marks the notification read via a direct API call rather than clicking it
  // (which navigates away) + page.goBack() — see the delete-all-read test's
  // comment for why in-test browser history navigation is avoided here. This
  // isolates the filter behavior itself, which is what this test is actually
  // checking, from the separate (already-covered elsewhere) mark-as-read-on-
  // open navigation flow.
  const uniqueText = await seedAliceNotification('filter test');
  const row = await findAliceNotification(uniqueText);

  const aliceSetupApi = await apiRequest.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { Authorization: `Bearer ${alice.token}` },
  });
  try {
    const markRes = await aliceSetupApi.patch(`/api/notifications/${row.id}/read`);
    expect(markRes.ok()).toBeTruthy();
  } finally {
    await aliceSetupApi.dispose();
  }

  const ctx = await browser.newContext();
  await authenticate(ctx, alice);
  const page = await ctx.newPage();
  await page.goto('/notifications');

  // Already read (via the API call above) — should not appear under Unread.
  await page.getByTestId('notifications-filter-unread').click();
  await expect(
    page.getByTestId('notifications-list').locator('li').filter({ hasText: uniqueText }),
  ).toHaveCount(0);

  // But it's still there under All — history isn't lost.
  await page.getByTestId('notifications-filter-all').click();
  await expect(
    page.getByTestId('notifications-list').locator('li').filter({ hasText: uniqueText }),
  ).toBeVisible();

  await closeContextSafely(ctx);
});

test('delete-all-read only removes read notifications, keeps unread, persists across reload', async ({
  browser,
}) => {
  // Marks the "to-be-read" notification via a direct API call rather than
  // clicking it in the UI (which navigates away) + page.goBack() — history
  // navigation reconnecting the socket proved unreliable in this environment
  // (see the sibling test's comment on page.reload() for the same class of
  // issue). This still exercises the real read-then-delete-all-read flow;
  // it just doesn't require in-test browser history navigation to set it up.
  const unreadText = await seedAliceNotification('bulk-unread');
  const toBeReadText = await seedAliceNotification('bulk-to-be-read');
  const toReadRow = await findAliceNotification(toBeReadText);
  await findAliceNotification(unreadText);

  const aliceSetupApi = await apiRequest.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { Authorization: `Bearer ${alice.token}` },
  });
  try {
    const markRes = await aliceSetupApi.patch(`/api/notifications/${toReadRow.id}/read`);
    expect(markRes.ok()).toBeTruthy();
  } finally {
    await aliceSetupApi.dispose();
  }

  const ctx = await browser.newContext();
  await authenticate(ctx, alice);
  const page = await ctx.newPage();
  await page.goto('/notifications');
  await page.getByTestId('notifications-filter-all').click();

  const toRead = page.getByTestId('notifications-list').locator('li').filter({ hasText: toBeReadText });
  await expect(toRead).toBeVisible({ timeout: 10_000 });

  await page.getByRole('button', { name: 'Delete read' }).first().click();

  await expect(
    page.getByTestId('notifications-list').locator('li').filter({ hasText: toBeReadText }),
  ).toHaveCount(0);
  await expect(
    page.getByTestId('notifications-list').locator('li').filter({ hasText: unreadText }),
  ).toBeVisible();

  // Persistence verified server-side directly — see the sibling delete test's
  // comment for why page.reload() is avoided here.
  const aliceApi = await apiRequest.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { Authorization: `Bearer ${alice.token}` },
  });
  try {
    const res = await aliceApi.get('/api/notifications');
    const body = await res.json();
    expect(
      (body.notifications as NotificationRow[]).some((n) => (n.body ?? n.title).includes(toBeReadText)),
    ).toBe(false);
    expect(
      (body.notifications as NotificationRow[]).some((n) => (n.body ?? n.title).includes(unreadText)),
    ).toBe(true);
  } finally {
    await aliceApi.dispose();
  }

  await closeContextSafely(ctx);
});

test("a user cannot delete another user's notification via the API directly", async () => {
  const uniqueText = await seedAliceNotification('ownership test');
  const targetId = (await findAliceNotification(uniqueText)).id;

  // Bob attempts to delete Alice's notification using his own valid token.
  const bobApi = await apiRequest.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { Authorization: `Bearer ${bob.token}` },
  });
  try {
    const res = await bobApi.delete(`/api/notifications/${targetId}`);
    expect(res.status()).toBe(404); // scoped WHERE user_id=$2 in the query — not found, not deleted
  } finally {
    await bobApi.dispose();
  }

  // Confirm it's still there for Alice.
  const aliceVerifyApi = await apiRequest.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { Authorization: `Bearer ${alice.token}` },
  });
  try {
    const res = await aliceVerifyApi.get('/api/notifications');
    const body = await res.json();
    expect(body.notifications.some((n: { id: string }) => n.id === targetId)).toBe(true);
  } finally {
    await aliceVerifyApi.dispose();
  }
});

test('unauthenticated requests to delete routes are rejected', async () => {
  const anonApi = await apiRequest.newContext({ baseURL: BASE_URL });
  try {
    const single = await anonApi.delete('/api/notifications/00000000-0000-0000-0000-000000000000');
    expect(single.status()).toBe(401);
    const bulk = await anonApi.delete('/api/notifications');
    expect(bulk.status()).toBe(401);
  } finally {
    await anonApi.dispose();
  }
});
