import { expect, test, request as apiRequest, type BrowserContext } from '@playwright/test';
import { TEST_PASSWORD, ALICE } from './test-accounts';

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

// Runs under both the desktop-chromium and mobile-chromium projects, so this
// asserts the layout on a small phone and a desktop viewport (P4.2, P4.9).
test('nearby counts never cover the top category controls and controls stay clickable', async ({
  browser,
}) => {
  const ctx = await browser.newContext();
  await authenticate(ctx, alice);
  const page = await ctx.newPage();
  await page.goto('/discover');

  const counts = page.getByTestId('nearby-counts');
  await expect(counts).toBeVisible();

  // Tribe category pills (Top, Twink, Daddy, …) stay unobstructed at the top.
  const twink = page.getByRole('button', { name: 'Twink', exact: true });
  await expect(twink).toBeVisible();

  const slider = page.getByTestId('proximity-slider');
  await expect(slider).toBeVisible();

  const countsBox = await counts.boundingBox();
  const twinkBox = await twink.boundingBox();
  const sliderBox = await slider.boundingBox();
  expect(countsBox).not.toBeNull();
  expect(twinkBox).not.toBeNull();
  expect(sliderBox).not.toBeNull();
  expect(countsBox!.y).toBeGreaterThan(twinkBox!.y);
  expect(sliderBox!.y).toBeGreaterThan(countsBox!.y);

  // Category and radius controls remain clickable (Playwright throws if an overlay intercepts).
  await twink.click();
  await page.getByRole('button', { name: 'Increase search radius' }).click();

  await ctx.close();
});

test('discover map canvas is not covered by a blocking overlay', async ({ browser }) => {
  const ctx = await browser.newContext({
    geolocation: { latitude: 51.5074, longitude: -0.1278 },
    permissions: ['geolocation'],
  });
  await authenticate(ctx, alice);
  const page = await ctx.newPage();
  await page.goto('/discover');

  const panel = page.getByTestId('discover-map-panel');
  await expect(panel).toBeVisible({ timeout: 20_000 });

  // Height-handle chip must not be a full-bleed veil over the canvas.
  const handle = page.getByTestId('map-drag-handle');
  if (await handle.isVisible().catch(() => false)) {
    const panelBox = await panel.boundingBox();
    const handleBox = await handle.boundingBox();
    expect(panelBox).not.toBeNull();
    expect(handleBox).not.toBeNull();
    expect(handleBox!.height).toBeLessThan(panelBox!.height * 0.35);
  }

  // Center of the map panel must hit the Mapbox host/canvas — not a UI veil.
  const hit = await panel.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const x = r.left + r.width * 0.5;
    const y = r.top + r.height * 0.45;
    const top = document.elementFromPoint(x, y) as HTMLElement | null;
    if (!top) return { ok: false, tag: null, className: null };
    const host = top.closest('[data-testid="discover-map-canvas-host"]');
    const canvas = top.closest('canvas') || top.tagName.toLowerCase() === 'canvas';
    const mapRoot = top.closest('.mapboxgl-map, .mapboxgl-canvas-container');
    return {
      ok: !!(host || canvas || mapRoot),
      tag: top.tagName.toLowerCase(),
      className: typeof top.className === 'string' ? top.className.slice(0, 120) : '',
    };
  });
  expect(hit.ok, `map center hit ${hit.tag}.${hit.className}`).toBeTruthy();

  await ctx.close();
});

test('location-blocked state is customer-facing with an enable action', async ({ browser }) => {
  const ctx = await browser.newContext();
  await authenticate(ctx, alice);
  // No geolocation permission granted → app falls back to central London.
  const page = await ctx.newPage();
  await page.goto('/discover');

  const notice = page.getByTestId('location-notice');
  await expect(notice).toBeVisible({ timeout: 15_000 });
  await expect(notice).toContainText('Showing people near central London for now');
  // No internal/developer wording leaks to the customer.
  await expect(notice).not.toContainText(/VITE_|env|dev server|undefined|null/i);
  // An obvious action to enable location is offered.
  await expect(page.getByTestId('enable-location')).toBeVisible();

  await ctx.close();
});
