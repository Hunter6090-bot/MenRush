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

// Mobile bottom nav: Nearby, Matches, Chat, Video rooms, Profile + More.
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
  await expect(primaryNav.locator('a[href="/rooms"]')).toContainText(/^Video rooms$/i);
  await expect(primaryNav.locator('a[href="/rooms"]')).not.toHaveText(/^Rooms$/i);

  const moreTab = page.getByTestId('mobile-more-tab');
  await expect(moreTab).toBeVisible();
  await expect(page.getByTestId('mobile-more-menu')).toHaveCount(0);

  await moreTab.click();
  const menu = page.getByTestId('mobile-more-menu');
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('link', { name: 'Events' })).toBeVisible();
  await expect(menu.getByRole('link', { name: 'Settings' })).toBeVisible();
  // Video rooms is primary chrome — not buried in More.
  await expect(menu.getByRole('link', { name: /Video rooms/i })).toHaveCount(0);
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

// Live pill must use online presence — never paint radius ("All") as Live.
test('map Live status uses online count, not radius label', async ({ browser }) => {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    geolocation: { latitude: 40.7128, longitude: -74.006 },
    permissions: ['geolocation'],
  });
  await authenticate(ctx, alice);
  const page = await ctx.newPage();

  await page.route('**/api/users/nearby**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'offline-1',
          name: 'OfflineOne',
          age: 30,
          online: false,
          distance_km: 0.4,
          distance_label: '< 500 m',
          lat: 40.713,
          lng: -74.005,
          last_seen: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: 'offline-2',
          name: 'OfflineTwo',
          age: 32,
          online: false,
          distance_km: 0.8,
          distance_label: '< 1 km',
          lat: 40.714,
          lng: -74.004,
          last_seen: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        },
      ]),
    });
  });

  await page.goto('/discover');
  // Brand Grid-first: switch to Map so the Live status pill is visible.
  const mapToggle = page.getByTestId('nearby-map-grid-toggle');
  await expect(mapToggle).toBeVisible({ timeout: 20_000 });
  if ((await mapToggle.innerText()).trim().toLowerCase() === 'map') {
    await mapToggle.click();
  }

  const status = page.getByTestId('map-live-status');
  await expect(status).toBeVisible({ timeout: 20_000 });
  await expect(status).toHaveAttribute('data-nearby-count', '2');
  await expect(status).toHaveAttribute('data-live-count', '0');
  const liveLine = page.getByTestId('map-live-line');
  await expect(liveLine).toContainText(/None live now/i);
  await expect(liveLine).not.toContainText(/Live · All/i);
  await expect(liveLine).not.toContainText(/Live · 2/i);

  const gridLive = page.getByTestId('nearby-live-count');
  await expect(gridLive).toContainText(/none live/i);

  await ctx.close();
});

test('expanded map hides Pulse FAB so zoom controls stay clear', async ({ browser }) => {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    geolocation: { latitude: 40.7128, longitude: -74.006 },
    permissions: ['geolocation'],
  });
  await authenticate(ctx, alice);
  const page = await ctx.newPage();
  await page.goto('/discover');

  const mapToggle = page.getByTestId('nearby-map-grid-toggle');
  await expect(mapToggle).toBeVisible({ timeout: 20_000 });
  if ((await mapToggle.innerText()).trim().toLowerCase() === 'map') {
    await mapToggle.click();
  }

  const panel = page.getByTestId('discover-map-panel');
  await expect(panel).toBeVisible({ timeout: 20_000 });
  // Default map height: FAB may still show over the grid.
  await expect(page.getByTestId('pulse-fab')).toBeVisible({ timeout: 15_000 });

  await page.getByTestId('map-expand-toggle').click();
  await expect(panel).toHaveAttribute('data-map-mode', 'expanded');
  // Fullscreen map: FAB must not cover Mapbox zoom / geolocate.
  await expect(page.getByTestId('pulse-fab')).toHaveCount(0);

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

  const mapToggle = page.getByTestId('nearby-map-grid-toggle');
  await expect(mapToggle).toBeVisible({ timeout: 20_000 });
  if ((await mapToggle.innerText()).trim().toLowerCase() === 'map') {
    await mapToggle.click();
  }

  const host = page.getByTestId('discover-map-canvas-host');
  await expect(host).toBeVisible({ timeout: 20_000 });

  const touchAction = await host.evaluate((el) => getComputedStyle(el).touchAction);
  expect(touchAction).toMatch(/none/i);

  await ctx.close();
});

// Expanded map must fill the Discover flex shell — not 100dvh math that overflows
// past header/tab padding and reintroduces page rubber-band (#216 leftover).
test('expanded mobile map uses flex fill and stays within the shell', async ({ browser }) => {
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

  const mapToggle = page.getByTestId('nearby-map-grid-toggle');
  await expect(mapToggle).toBeVisible({ timeout: 20_000 });
  if ((await mapToggle.innerText()).trim().toLowerCase() === 'map') {
    await mapToggle.click();
  }

  const panel = page.getByTestId('discover-map-panel');
  await expect(panel).toBeVisible({ timeout: 20_000 });
  await page.getByTestId('map-expand-toggle').click();
  await expect(panel).toHaveAttribute('data-map-mode', 'expanded');

  const metrics = await panel.evaluate((el) => {
    const box = el.getBoundingClientRect();
    const main = document.querySelector('main');
    const mainBox = main?.getBoundingClientRect();
    return {
      top: box.top,
      bottom: box.bottom,
      height: box.height,
      mainBottom: mainBox?.bottom ?? 0,
      mainTop: mainBox?.top ?? 0,
      inlineHeight: (el as HTMLElement).style.height || '',
      flexGrow: getComputedStyle(el).flexGrow,
    };
  });

  // Must not use the old 100dvh inline height that overflowed the padded main.
  expect(metrics.inlineHeight).not.toMatch(/100dvh|100vh/);
  expect(Number(metrics.flexGrow)).toBeGreaterThan(0);
  expect(metrics.top).toBeGreaterThanOrEqual(metrics.mainTop - 1);
  expect(metrics.bottom).toBeLessThanOrEqual(metrics.mainBottom + 1);
  // Near-fullscreen within the shell — not a short default strip.
  expect(metrics.height).toBeGreaterThan(500);

  // List scroll region must not sit under the expanded map (gesture conflict).
  await expect(page.getByTestId('nearby-counts')).toHaveCount(0);

  await ctx.close();
});

// HTML pins must advertise gesture forwarding so pan/pinch starting on a face works.
test('map markers wire drag/pinch pass-through onto Mapbox', async ({ browser }) => {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    geolocation: { latitude: 40.7128, longitude: -74.006 },
    permissions: ['geolocation'],
  });
  await authenticate(ctx, alice);
  const page = await ctx.newPage();

  await page.route('**/api/users/nearby**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'pin-1',
          name: 'PinOne',
          age: 30,
          online: true,
          distance_km: 0.3,
          distance_label: '< 500 m',
          lat: 40.7135,
          lng: -74.0055,
          last_seen: new Date().toISOString(),
          photo_url: '/uploads/fake-pin.jpg',
        },
      ]),
    });
  });

  await page.goto('/discover');
  const mapToggle = page.getByTestId('nearby-map-grid-toggle');
  await expect(mapToggle).toBeVisible({ timeout: 20_000 });
  if ((await mapToggle.innerText()).trim().toLowerCase() === 'map') {
    await mapToggle.click();
  }

  const host = page.getByTestId('discover-map-canvas-host');
  await expect(host).toBeVisible({ timeout: 20_000 });

  // Wait for Mapbox markers; self pin always exists once map loads.
  await expect
    .poll(async () =>
      page.locator('.mapboxgl-marker[data-map-gesture-wired="1"]').count(),
    )
    .toBeGreaterThan(0);

  const wiredTouchAction = await page
    .locator('.mapboxgl-marker[data-map-gesture-wired="1"]')
    .first()
    .evaluate((el) => getComputedStyle(el).touchAction);
  expect(wiredTouchAction).toMatch(/none/i);

  await ctx.close();
});

// Grid ↔ Map toggle must still preserve surface after expand/shrink (do not regress).
test('Grid Map toggle state survives expand shrink', async ({ browser }) => {
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

  const toggle = page.getByTestId('nearby-map-grid-toggle');
  await expect(toggle).toBeVisible({ timeout: 20_000 });
  // Start from Grid (Brand default) → Map → expand → shrink → still Map.
  if ((await toggle.innerText()).trim().toLowerCase() === 'map') {
    // already showing Map button means current view is Grid
  } else {
    // showing Grid button means current view is Map — switch to Grid first
    await toggle.click();
  }
  await toggle.click(); // → Map
  await expect(page.getByTestId('discover-map-panel')).toBeVisible();
  await page.getByTestId('map-expand-toggle').click();
  await expect(page.getByTestId('discover-map-panel')).toHaveAttribute('data-map-mode', 'expanded');
  await page.getByTestId('map-expand-toggle').click();
  await expect(page.getByTestId('discover-map-panel')).toHaveAttribute('data-map-mode', 'default');
  // Toggle still offers Grid (meaning we are on Map).
  await expect(toggle).toContainText(/grid/i);

  await ctx.close();
});
