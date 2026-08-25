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
  }, result);
}

async function isMobileViewport(page: Page) {
  const size = page.viewportSize();
  return !!size && size.width < MOBILE_BREAKPOINT;
}

// Mobile bottom nav only ships 4 primary tabs (Nearby, Matches, Chat, Profile);
// Events and Settings remain reachable via a "More" sheet (P0 nav parity fix).
// Hot Spots is intentionally NOT here (#67) — it's a layer on the Nearby map now,
// not a separate destination; see the layer-control assertions in
// nearby-people-hotspots-layers.spec.ts.
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
  for (const href of ['/discover', '/matches', '/conversations', '/profile']) {
    await expect(primaryNav.locator(`a[href="${href}"]`)).toBeVisible();
  }

  const moreTab = page.getByTestId('mobile-more-tab');
  await expect(moreTab).toBeVisible();
  await expect(page.getByTestId('mobile-more-menu')).toHaveCount(0);

  await moreTab.click();
  const menu = page.getByTestId('mobile-more-menu');
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('link', { name: 'Events' })).toBeVisible();
  await expect(menu.getByRole('link', { name: 'Settings' })).toBeVisible();
  await expect(menu.getByRole('link', { name: 'Hot Spots' })).toHaveCount(0);

  await menu.getByRole('link', { name: 'Settings' }).click();
  await expect(page).toHaveURL(/\/settings$/);
  // Sheet closes on navigation instead of lingering over the new page.
  await expect(page.getByTestId('mobile-more-menu')).toHaveCount(0);
});

// Desktop sidebar already had these links — asserts feature parity didn't regress desktop.
// Hot Spots is intentionally excluded (#67) — see nearby-people-hotspots-layers.spec.ts.
test('desktop sidebar still exposes every discovery destination directly', async ({ page }) => {
  test.skip(await isMobileViewport(page), 'Desktop-only assertion — mobile uses the More sheet.');

  await authenticate(page.context(), alice);
  await page.goto('/discover');

  for (const label of ['Nearby', 'Events', 'Matches', 'Messages', 'Profile', 'Settings']) {
    await expect(page.getByRole('link', { name: label, exact: true })).toBeVisible();
  }
  await expect(page.getByRole('link', { name: 'Hot Spots', exact: true })).toHaveCount(0);
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
