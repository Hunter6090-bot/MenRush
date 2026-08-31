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

test('Community is its own nav destination (not a Map mode)', async ({ browser }) => {
  const ctx = await browser.newContext({
    geolocation: { latitude: 51.5074, longitude: -0.1278 },
    permissions: ['geolocation'],
    viewport: { width: 390, height: 844 },
  });
  await authenticate(ctx, alice);
  const page = await ctx.newPage();
  await page.goto('/discover');

  // MAP | COMMUNITY segmented control is gone.
  await expect(page.getByTestId('discovery-surface-toggle')).toHaveCount(0);
  await expect(page.getByTestId('discover-community-toggle')).toHaveCount(0);
  await expect(page.getByText(/live profile list/i)).toHaveCount(0);

  // Own bottom-nav item opens /stream.
  const communityNav = page.getByTestId('mobile-nav-stream');
  await expect(communityNav).toBeVisible();
  await expect(communityNav).toContainText(/community/i);
  await communityNav.click();
  await expect(page).toHaveURL(/\/stream/);
  await expect(page.getByTestId('community-feed')).toBeVisible();
  await expect(page.getByTestId('community-composer')).toBeVisible();
  await expect(page.getByTestId('discovery-surface-toggle')).toHaveCount(0);

  await ctx.close();
});

test('desktop Nearby has Grid↔Map only; Community is own sidebar destination', async ({
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

  await expect(page.getByTestId('discovery-surface-toggle')).toHaveCount(0);
  await expect(page.getByTestId('discover-community-toggle')).toHaveCount(0);
  await expect(page.getByTestId('nearby-map-grid-toggle')).toBeVisible();
  await expect(page.getByTestId('discover-nearby-panel')).toBeVisible();
  await expect(page.getByTestId('community-feed')).toHaveCount(0);

  // Open Map view — still Nearby people, not Community under the map.
  const mapToggle = page.getByTestId('nearby-map-grid-toggle');
  if ((await mapToggle.innerText()).trim().toLowerCase() === 'map') {
    await mapToggle.click();
  }
  await expect(page.getByTestId('discover-map-panel')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('discover-nearby-panel')).toBeVisible();
  await expect(page.getByTestId('community-feed')).toHaveCount(0);

  await page.goto('/stream');
  await expect(page.getByTestId('community-feed')).toBeVisible();
  await expect(page.getByTestId('discovery-surface-toggle')).toHaveCount(0);

  await ctx.close();
});

test('phone Nearby starts Grid; Map toggle only; Community not under map', async ({ browser }) => {
  const ctx = await browser.newContext({
    geolocation: { latitude: 51.5074, longitude: -0.1278 },
    permissions: ['geolocation'],
    viewport: { width: 390, height: 844 },
  });
  await authenticate(ctx, alice);
  const page = await ctx.newPage();
  await page.goto('/discover');

  await expect(page.getByTestId('discovery-surface-toggle')).toHaveCount(0);
  await expect(page.getByTestId('nearby-map-grid-toggle')).toBeVisible();
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

  // Grid-first: switch to Map before asserting map host.
  const mapToggle = page.getByTestId('nearby-map-grid-toggle');
  await expect(mapToggle).toBeVisible({ timeout: 15_000 });
  if ((await mapToggle.innerText()).trim().toLowerCase() === 'map') {
    await mapToggle.click();
  }

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
    viewport: { width: 390, height: 844 },
  });
  await authenticate(ctx, alice);
  const page = await ctx.newPage();
  await page.goto('/stream');

  await expect(page.getByTestId('community-feed')).toBeVisible({ timeout: 15_000 });
  const composer = page.getByTestId('community-post-input');
  await expect(composer).toBeVisible({ timeout: 15_000 });
  const body = `ci-community-${Date.now()}`;
  await composer.fill(body);
  await page.getByTestId('community-post-submit').click();
  await expect(page.getByText(body)).toBeVisible({ timeout: 15_000 });

  await ctx.close();
});
