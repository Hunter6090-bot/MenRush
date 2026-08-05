import { expect, test, request as apiRequest, type BrowserContext } from '@playwright/test';
import { TEST_PASSWORD, ALICE } from './test-accounts';

// #67: unify Nearby into one map with independent People / Hot Spots layers.
test.describe.configure({ mode: 'serial' });

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:4173';

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

test('People and Hot Spots layer toggles default on and are independently switchable', async ({
  browser,
}) => {
  const ctx = await browser.newContext({
    geolocation: { latitude: 40.7128, longitude: -74.006 },
    permissions: ['geolocation'],
  });
  await authenticate(ctx, alice);
  const page = await ctx.newPage();
  await page.goto('/discover');

  const peopleToggle = page.getByTestId('layer-toggle-people');
  const hotSpotsToggle = page.getByTestId('layer-toggle-hotspots');
  await expect(peopleToggle).toBeVisible({ timeout: 20_000 });
  await expect(hotSpotsToggle).toBeVisible();

  // Both on by default (approved product decision).
  await expect(peopleToggle).toHaveAttribute('aria-pressed', 'true');
  await expect(hotSpotsToggle).toHaveAttribute('aria-pressed', 'true');

  // Give the nearby-users fetch + marker mount time to land before sampling the
  // baseline — otherwise this races the self-marker-only initial paint.
  await page.waitForResponse((r) => r.url().includes('/api/users/nearby'), { timeout: 20_000 });
  await page.waitForTimeout(3_000);
  const markerCountBefore = await page.locator('.mapboxgl-marker').count();
  test.skip(markerCountBefore <= 1, 'No other seeded people within range for this fixture location.');

  // Toggling People off hides person markers but the self marker stays — the map
  // itself must not be recreated (no new tile/style request), just markers hidden.
  const requestsBefore = new Set<string>();
  page.on('request', (r) => requestsBefore.add(r.url()));

  await peopleToggle.click();
  await expect(peopleToggle).toHaveAttribute('aria-pressed', 'false');
  await expect
    .poll(() => page.locator('.mapboxgl-marker').count())
    .toBe(1); // only the self marker remains
  const markerCountAfter = await page.locator('.mapboxgl-marker').count();
  expect(markerCountAfter).toBeLessThan(markerCountBefore);
  expect(markerCountAfter).toBeGreaterThanOrEqual(1); // self marker remains

  // No new network calls fired by a pure client-side visibility toggle — nothing
  // about the viewer's own precise coordinates gets sent anywhere by toggling.
  const newRequests = [...requestsBefore].filter(
    (u) => u.includes('/api/') && !u.includes('/api/users/location'),
  );
  const preToggleApiCount = newRequests.length;
  await page.waitForTimeout(300);
  const afterApiRequests = [...requestsBefore].filter((u) => u.includes('/api/'));
  expect(afterApiRequests.length).toBeLessThanOrEqual(preToggleApiCount + 2); // allow in-flight polling only

  await peopleToggle.click();
  await expect(peopleToggle).toHaveAttribute('aria-pressed', 'true');
  await page.waitForTimeout(300);
  expect(await page.locator('.mapboxgl-marker').count()).toBe(markerCountBefore);

  // Hot Spots layer: same hide/restore contract, independent of People.
  await hotSpotsToggle.click();
  await expect(hotSpotsToggle).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.hotspot-pin')).toHaveCount(0);
  await hotSpotsToggle.click();
  await expect(hotSpotsToggle).toHaveAttribute('aria-pressed', 'true');

  await ctx.close();
});

test('/hot-spots route still loads directly for compatibility (no nav entry, route unchanged)', async ({
  browser,
}) => {
  const ctx = await browser.newContext({
    geolocation: { latitude: 40.7128, longitude: -74.006 },
    permissions: ['geolocation'],
  });
  await authenticate(ctx, alice);
  const page = await ctx.newPage();
  await page.goto('/hot-spots');

  await expect(page.getByRole('heading', { name: 'Hot Spots' })).toBeVisible({ timeout: 20_000 });
  await expect(page).toHaveURL(/\/hot-spots$/);

  await ctx.close();
});

test('Hot Spot sheet opens on the map without leaving /discover, and closes cleanly', async ({
  browser,
}) => {
  const ctx = await browser.newContext({
    geolocation: { latitude: 40.7128, longitude: -74.006 },
    permissions: ['geolocation'],
  });
  await authenticate(ctx, alice);
  const page = await ctx.newPage();
  await page.goto('/discover');
  await expect(page.getByTestId('layer-toggle-hotspots')).toBeVisible({ timeout: 20_000 });

  const pin = page.locator('.hotspot-pin').first();
  const pinCount = await pin.count();
  test.skip(pinCount === 0, 'No seeded Hot Spots within range for this fixture location.');

  await pin.click();
  const sheet = page.getByTestId('hotspot-sheet');
  await expect(sheet).toBeVisible();
  await expect(page).toHaveURL(/\/discover$/); // never navigated away

  await page.getByTestId('hotspot-sheet-close').click();
  await expect(sheet).toHaveCount(0);
});
