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

// Phone Discover chrome: nearby-counts + radius select must stay usable (no covering overlay).
test('nearby counts never cover the radius control and controls stay clickable', async ({
  browser,
}) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await authenticate(ctx, alice);
  const page = await ctx.newPage();
  await page.goto('/discover');

  const counts = page.getByTestId('nearby-counts');
  await expect(counts).toBeVisible({ timeout: 15_000 });

  const radius = page.getByTestId('radius-miles-select');
  await expect(radius).toBeVisible({ timeout: 15_000 });

  const countsBox = await counts.boundingBox();
  const radiusBox = await radius.boundingBox();
  expect(countsBox).not.toBeNull();
  expect(radiusBox).not.toBeNull();
  // Same toolbar row — neither control should be pushed off-screen.
  expect(countsBox!.y).toBeGreaterThan(0);
  expect(radiusBox!.y).toBeGreaterThan(0);
  expect(Math.abs(countsBox!.y - radiusBox!.y)).toBeLessThan(48);

  // Radius control remains interactive (Playwright throws if an overlay intercepts).
  await radius.selectOption({ index: 1 });

  await ctx.close();
});

test('discover map canvas is not covered by a blocking overlay', async ({ browser }) => {
  const ctx = await browser.newContext({
    geolocation: { latitude: 51.5074, longitude: -0.1278 },
    permissions: ['geolocation'],
    viewport: { width: 390, height: 844 },
  });
  await authenticate(ctx, alice);
  const page = await ctx.newPage();
  await page.goto('/discover');

  // Expand map if a show-map bar is present.
  const showMap = page.getByTestId('map-show-bar');
  if (await showMap.isVisible().catch(() => false)) {
    await showMap.click();
  }

  const host = page.getByTestId('discover-map-canvas-host');
  await expect(host).toBeVisible({ timeout: 15_000 });

  const blocked = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="discover-map-canvas-host"]');
    if (!el) return true;
    const rect = el.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const top = document.elementFromPoint(x, y);
    if (!top) return true;
    return !el.contains(top) && top !== el;
  });
  // Mapbox token may be missing in CI — host still must not be under a full-screen blocker.
  expect(blocked).toBeFalsy();

  await ctx.close();
});
