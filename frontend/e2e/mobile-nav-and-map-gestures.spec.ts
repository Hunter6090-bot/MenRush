import { expect, test, request as apiRequest, type BrowserContext, type Page } from '@playwright/test';
import { TEST_PASSWORD, ALICE } from './test-accounts';
import { PLAYWRIGHT_BASE_URL as BASE_URL } from './support/base-url';

test.describe.configure({ mode: 'serial' });

/** Matches the site's own `lg` breakpoint (Tailwind) for mobile vs desktop nav. */
const MOBILE_BREAKPOINT = 1024;

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

test.beforeAll(async () => {
  const api = await apiRequest.newContext({ baseURL: BASE_URL });
  try {
    alice = await login(api, ALICE.email);
  } finally {
    await api.dispose();
  }
});

async function authenticate(context: BrowserContext, result: LoginResult) {
  await context.addInitScript(({ token, user }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    // Keep Get-the-App sheet from covering bottom nav / Sign out in mobile e2e.
    localStorage.setItem('menrush_install_prompt_dismissed', '1');
  }, result);
}

async function isMobileViewport(page: Page) {
  const size = page.viewportSize();
  return !!size && size.width < MOBILE_BREAKPOINT;
}

// Mobile bottom nav: Nearby, Matches, Chat, Rooms (Video rooms), Profile + More.
// Video rooms is first-class chrome — not nested under Chat. Events and Settings
// remain in the More sheet. Cruise (formerly Hot Spots) stays a Nearby map layer (#67).
test('mobile More menu restores Events and Settings without losing primary tabs', async ({
  page,
}) => {
  test.skip(!(await isMobileViewport(page)), 'Mobile-only nav pattern — desktop uses the full sidebar.');

  await authenticate(page.context(), alice);
  await page.goto('/discover');

  // Existing primary tabs must still be present — nothing removed. Matched by
  // href, not accessible name, since unread/match badges prepend a count to
  // the link's text (e.g. "1 Matches").
  const primaryNav = page.getByRole('navigation', { name: 'Primary' });
  for (const href of ['/discover', '/matches', '/conversations', '/rooms', '/profile']) {
    await expect(primaryNav.locator(`a[href="${href}"]`)).toBeVisible();
  }
  await expect(primaryNav.locator('a[href="/conversations"]')).toContainText(/Chat/i);
  await expect(primaryNav.locator('a[href="/rooms"]')).toContainText(/Rooms/i);

  const moreTab = page.getByTestId('mobile-more-tab');
  await expect(moreTab).toBeVisible();
  await expect(page.getByTestId('mobile-more-menu')).toHaveCount(0);

  await moreTab.click();
  const menu = page.getByTestId('mobile-more-menu');
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('link', { name: 'Events' })).toBeVisible();
  await expect(menu.getByRole('link', { name: 'Settings' })).toBeVisible();
  // Video rooms is primary chrome — not buried in More.
  await expect(menu.getByRole('link', { name: /Video rooms|Rooms/i })).toHaveCount(0);
  await expect(menu.getByRole('link', { name: 'Hot Spots' })).toHaveCount(0);
  await expect(menu.getByRole('link', { name: 'Cruise' })).toHaveCount(0);

  await menu.getByRole('link', { name: 'Settings' }).click();
  await expect(page).toHaveURL(/\/settings$/);
  // Sheet closes on navigation instead of lingering over the new page.
  await expect(page.getByTestId('mobile-more-menu')).toHaveCount(0);
});

// Cruise (formerly Hot Spots) is intentionally excluded from nav (#67) —
// see nearby-people-hotspots-layers.spec.ts.
test('desktop sidebar still exposes every discovery destination directly', async ({ page }) => {
  test.skip(await isMobileViewport(page), 'Desktop-only assertion — mobile uses the More sheet.');

  await authenticate(page.context(), alice);
  await page.goto('/discover');

  for (const label of ['Nearby', 'Events', 'Matches', 'Messages', 'Video rooms', 'Profile', 'Settings']) {
    await expect(page.getByRole('link', { name: label, exact: true })).toBeVisible();
  }
  await expect(page.getByRole('link', { name: 'Hot Spots', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Cruise', exact: true })).toHaveCount(0);
});

// Regression guard: dismissible banners above the map used to push the "expanded"
// mobile map past the bottom of the viewport, leaving part of it unreachable by
// touch and reintroducing page-level scroll that fought the map's own gestures.
test('expanded mobile map stays fully within the viewport', async ({ browser }) => {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    geolocation: { latitude: 40.7128, longitude: -74.006 },
    permissions: ['geolocation'],
  });
  await authenticate(ctx, alice);
  const page = await ctx.newPage();
  await page.goto('/discover');

  const panel = page.getByTestId('discover-map-panel');
  await expect(panel).toBeVisible({ timeout: 20_000 });

  await page.getByTestId('map-expand-toggle').click();
  await expect(panel).toHaveAttribute('data-map-mode', 'expanded');

  const box = await panel.boundingBox();
  expect(box).not.toBeNull();
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  // The whole panel — not just its top — must be on-screen for gestures to reach it anywhere.
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height + 1);

  await ctx.close();
});

// Phone web must keep Mapbox pinch-zoom armed (same contract as desktop touch).
test('mobile map canvas advertises pinch-ready touch handlers', async ({ browser }) => {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    geolocation: { latitude: 40.7128, longitude: -74.006 },
    permissions: ['geolocation'],
  });
  await authenticate(ctx, alice);
  const page = await ctx.newPage();
  await page.goto('/discover');

  const host = page.getByTestId('discover-map-canvas-host');
  await expect(host).toBeVisible({ timeout: 20_000 });

  const touchAction = await host.evaluate((el) => getComputedStyle(el).touchAction);
  expect(touchAction).toMatch(/none/i);

  await ctx.close();
});
