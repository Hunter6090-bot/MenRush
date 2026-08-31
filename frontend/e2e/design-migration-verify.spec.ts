import { expect, test, request as apiRequest, type BrowserContext, type Page } from '@playwright/test';
import { TEST_PASSWORD, ALICE, BOB } from './test-accounts';
import { PLAYWRIGHT_BASE_URL as BASE_URL } from './support/base-url';

type LoginResult = {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    is_verified: boolean;
    verification_status: string;
  };
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
  }, result);
}

async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth > doc.clientWidth + 2;
  });
  expect(overflow).toBeFalsy();
}

test.describe.configure({ mode: 'serial' });

let alice: LoginResult;

test.beforeAll(async () => {
  alice = await login(ALICE.email);
});

test.describe('desktop design migration @ 1440px', () => {
  const desktopViewport = { width: 1440, height: 900 } as const;

  test('Discover shell and grid', async ({ browser }) => {
    // test.use viewport does not apply to manually created contexts.
    const ctx = await browser.newContext({ viewport: { ...desktopViewport } });
    await authenticate(ctx, alice);
    const page = await ctx.newPage();
    await page.goto('/discover');

    await expect(page.getByRole('link', { name: /MenRush home/i })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Nearby', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Nearby', exact: true })).toBeVisible();
    await expect(page.getByText(/in your radius/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Toggle pulse visibility/i })).toBeVisible();

    await assertNoHorizontalOverflow(page);
    await ctx.close();
  });

  test('Matches page', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { ...desktopViewport } });
    await authenticate(ctx, alice);
    const page = await ctx.newPage();
    await page.goto('/matches');

    await expect(page.getByRole('heading', { name: 'Matches' })).toBeVisible();
    await expect(page.getByText(/Who liked you and mutual matches/i)).toBeVisible();
    await expect(page.getByText('Bob').first()).toBeVisible();

    await assertNoHorizontalOverflow(page);
    await ctx.close();
  });

  test('Messages split view and send text', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { ...desktopViewport } });
    await authenticate(ctx, alice);
    const page = await ctx.newPage();
    await page.goto('/conversations');

    // Chat stays Chat — no nested Rooms tab inside messages.
    await expect(page.getByRole('tab', { name: 'Rooms' })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'Messages' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Video rooms', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Messages', exact: true })).toBeVisible();
    // Hub chrome (not the lg:hidden mobile title).
    await expect(page.locator('aside').getByText('Messages', { exact: true })).toBeVisible();

    const bobThread = page.getByText('Bob').first();
    if (await bobThread.isVisible().catch(() => false)) {
      await bobThread.click();
    } else {
      await page.goto(`/messages/${BOB.id}`);
    }

    await expect(page.getByPlaceholder('Say something direct.')).toBeVisible();

    const probe = `layout probe ${Date.now()}`;
    await page.getByPlaceholder('Say something direct.').fill(probe);
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(page.getByText(probe)).toBeVisible({ timeout: 10_000 });

    await assertNoHorizontalOverflow(page);
    await ctx.close();
  });

  test('Video rooms is a first-class desktop workspace', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { ...desktopViewport } });
    await authenticate(ctx, alice);
    const page = await ctx.newPage();
    await page.goto('/rooms');

    await expect(page.getByRole('link', { name: 'Video rooms', exact: true })).toBeVisible();
    // Room list chrome (not the lg:hidden mobile title).
    await expect(page.locator('aside').getByText('Video rooms', { exact: true })).toBeVisible();
    // Not nested inside Chat / Messages tabs.
    await expect(page.getByRole('tab', { name: 'Messages' })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'Rooms' })).toHaveCount(0);

    await assertNoHorizontalOverflow(page);
    await ctx.close();
  });

  test('Settings page', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { ...desktopViewport } });
    await authenticate(ctx, alice);
    const page = await ctx.newPage();
    await page.goto('/settings');

    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await expect(page.getByText('Push notifications').first()).toBeVisible();

    await assertNoHorizontalOverflow(page);
    await ctx.close();
  });
});

test.describe('mobile design migration @ 390px', () => {
  const mobileViewport = { width: 390, height: 844 } as const;

  test('Discover mobile shell', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { ...mobileViewport } });
    await authenticate(ctx, alice);
    const page = await ctx.newPage();
    await page.goto('/discover');

    await expect(page.getByTestId('nearby-counts')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();

    await assertNoHorizontalOverflow(page);
    await ctx.close();
  });

  test('Matches and messages mobile', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { ...mobileViewport } });
    await authenticate(ctx, alice);
    const page = await ctx.newPage();

    await page.goto('/matches');
    await expect(page.getByRole('heading', { name: 'Matches' })).toBeVisible();

    await page.goto('/conversations');
    await expect(page.locator('nav[aria-label="Primary"]')).toBeVisible();

    await page.goto(`/messages/${BOB.id}`);
    await expect(page.getByPlaceholder('Say something direct.')).toBeVisible();

    await assertNoHorizontalOverflow(page);
    await ctx.close();
  });
});
