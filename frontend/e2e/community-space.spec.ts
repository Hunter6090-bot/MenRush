import { expect, test, request as apiRequest, type BrowserContext } from '@playwright/test';
import { TEST_PASSWORD, ALICE } from './test-accounts';
import { PLAYWRIGHT_BASE_URL as BASE_URL } from './support/base-url';

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

test('MAP | COMMUNITY toggle labels Community (not Live profile list)', async ({ browser }) => {
  const ctx = await browser.newContext({
    geolocation: { latitude: 51.5074, longitude: -0.1278 },
    permissions: ['geolocation'],
    viewport: { width: 390, height: 844 },
  });
  await authenticate(ctx, alice);
  const page = await ctx.newPage();
  await page.goto('/discover');

  const toggle = page.getByTestId('discover-community-toggle');
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveText(/community/i);
  await expect(page.getByText(/live profile list/i)).toHaveCount(0);

  await toggle.click();
  await expect(page).toHaveURL(/\/stream/);
  await expect(page.getByTestId('community-feed')).toBeVisible();
  await expect(page.getByTestId('community-composer')).toBeVisible();
  await expect(page.getByRole('group', { name: 'Discovery surface' })).toContainText(/community/i);

  await ctx.close();
});

test('desktop wide Discover shows Map|Community tabs and Nearby under the map (not Community)', async ({
  browser,
}) => {
  const ctx = await browser.newContext({
    geolocation: { latitude: 51.5074, longitude: -0.1278 },
    permissions: ['geolocation'],
    viewport: { width: 1440, height: 900 },
  });
  await authenticate(ctx, alice);
  const page = await ctx.newPage();
  await page.goto('/discover');

  await expect(page.getByTestId('discover-map-panel')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('discovery-surface-toggle')).toBeVisible();
  await expect(page.getByTestId('discover-community-toggle')).toBeVisible();
  await expect(page.getByTestId('discover-nearby-panel')).toBeVisible();
  // Community must not be dumped under the desktop map.
  await expect(page.getByTestId('discover-community-panel')).toHaveCount(0);
  await expect(page.getByTestId('community-feed')).toHaveCount(0);

  await page.getByTestId('discover-community-toggle').click();
  await expect(page).toHaveURL(/\/stream/);
  await expect(page.getByTestId('community-feed')).toBeVisible();
  await expect(page.getByTestId('discovery-surface-toggle')).toBeVisible();

  await ctx.close();
});

test('phone Discover Map tab keeps Nearby under the map; Community is a separate tab', async ({
  browser,
}) => {
  const ctx = await browser.newContext({
    geolocation: { latitude: 51.5074, longitude: -0.1278 },
    permissions: ['geolocation'],
    viewport: { width: 390, height: 844 },
  });
  await authenticate(ctx, alice);
  const page = await ctx.newPage();
  await page.goto('/discover');

  await expect(page.getByTestId('discover-map-panel')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('discovery-surface-toggle')).toBeVisible();
  await expect(page.getByTestId('nearby-counts')).toBeVisible();
  await expect(page.getByTestId('community-feed')).toHaveCount(0);

  await ctx.close();
});

test('phone map host keeps pinch-zoom handlers enabled (touchZoomRotate + touch-action none)', async ({
  browser,
}) => {
  const ctx = await browser.newContext({
    geolocation: { latitude: 51.5074, longitude: -0.1278 },
    permissions: ['geolocation'],
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });
  await authenticate(ctx, alice);
  const page = await ctx.newPage();
  await page.goto('/discover');

  const host = page.getByTestId('discover-map-canvas-host');
  await expect(host).toBeVisible({ timeout: 20_000 });

  // Without a Mapbox token CI shows the fallback — still assert the surface CSS contract.
  const mapTakingBreak = page.getByText('Map is taking a break');
  if (await mapTakingBreak.isVisible().catch(() => false)) {
    const touchAction = await host.evaluate((el) => getComputedStyle(el).touchAction);
    expect(touchAction).toMatch(/none/i);
    await ctx.close();
    return;
  }

  const gestureState = await page.evaluate(() => {
    const hostEl = document.querySelector('[data-testid="discover-map-canvas-host"]') as HTMLElement | null;
    const canvas = hostEl?.querySelector('canvas') as HTMLCanvasElement | null;
    const container = hostEl?.querySelector('.mapboxgl-canvas-container') as HTMLElement | null;
    return {
      hostTouchAction: hostEl ? getComputedStyle(hostEl).touchAction : null,
      canvasTouchAction: canvas ? getComputedStyle(canvas).touchAction : null,
      containerTouchAction: container ? getComputedStyle(container).touchAction : null,
      hasZoomRotateClass: container?.classList.contains('mapboxgl-touch-zoom-rotate') ?? false,
      hasDragPanClass: container?.classList.contains('mapboxgl-touch-drag-pan') ?? false,
    };
  });

  expect(gestureState.hostTouchAction).toMatch(/none/i);
  expect(gestureState.canvasTouchAction).toMatch(/none/i);
  expect(gestureState.containerTouchAction).toMatch(/none/i);
  expect(gestureState.hasZoomRotateClass).toBe(true);
  expect(gestureState.hasDragPanClass).toBe(true);

  await ctx.close();
});

test('signed-in user can create a ≤280 char Community post', async ({ browser }) => {
  const ctx = await browser.newContext({
    geolocation: { latitude: 51.5074, longitude: -0.1278 },
    permissions: ['geolocation'],
  });
  await authenticate(ctx, alice);
  const page = await ctx.newPage();
  await page.goto('/stream');

  await expect(page.getByTestId('community-feed')).toBeVisible({ timeout: 15_000 });
  const input = page.getByTestId('community-post-input');
  await expect(input).toBeVisible({ timeout: 15_000 });

  const body = `Hosting near Soho — open to drinks ${Date.now()}`;
  await input.fill(body);
  await page.getByTestId('community-post-submit').click();

  await expect(page.getByTestId('community-post-list')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('community-post').first()).toContainText(body);
  await expect(page.getByTestId('community-post').first()).toContainText(/ago|Just now|m ago|h ago/i);

  // No video / rooms chrome inside the feed.
  await expect(page.getByTestId('community-feed').locator('video')).toHaveCount(0);
  await expect(page.getByTestId('community-feed').getByText(/^rooms$/i)).toHaveCount(0);

  await ctx.close();
});
