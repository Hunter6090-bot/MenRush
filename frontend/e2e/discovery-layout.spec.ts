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
    localStorage.setItem('menrush_desktop_sidebar_expanded', '1');
  }, result);
}

// Runs under both the desktop-chromium and mobile-chromium projects, so this
// asserts the layout on a small phone and a desktop viewport (P4.2, P4.9).
test('nearby counts and radius controls stay visible and clickable', async ({ browser }) => {
  const ctx = await browser.newContext();
  await authenticate(ctx, alice);
  const page = await ctx.newPage();
  await page.goto('/discover');

  const counts = page.getByTestId('discover-map-panel').getByTestId('nearby-counts');
  await expect(counts).toBeVisible({ timeout: 20_000 });

  const slider = page.getByTestId('proximity-slider');
  await expect(slider).toBeVisible();

  const mapPanel = page.getByTestId('discover-map-panel');
  await expect(mapPanel).toBeVisible();

  // Radius controls remain clickable (Playwright throws if an overlay intercepts).
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

  // Mobile shows fallback when Mapbox token is absent (CI smoke); desktop keeps the host div.
  const tokenFallback = page.getByText('Map is taking a break');
  if (await tokenFallback.isVisible().catch(() => false)) {
    await expect(tokenFallback).toBeVisible();
    await ctx.close();
    return;
  }

  const mapCanvas = panel.locator('canvas.mapboxgl-canvas');
  if ((await mapCanvas.count()) === 0) {
    // No Mapbox canvas (typical in CI) — verify the host is still exposed at center.
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
    return;
  }

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
  // No geolocation permission — seeded users may still have a saved pin; either way
  // the page must not leak internal env/dev copy.
  const page = await ctx.newPage();
  await page.goto('/discover');

  await expect(page.getByTestId('discover-map-panel')).toBeVisible({ timeout: 20_000 });

  const gate = page.getByTestId('location-gate');
  const notice = page.getByTestId('location-notice');
  if (await gate.isVisible().catch(() => false)) {
    await expect(gate).toContainText(/Allow location to unlock Nearby/i);
    await expect(gate.getByRole('button', { name: /Allow location/i })).toBeVisible();
  } else if (await notice.isVisible().catch(() => false)) {
    await expect(notice).not.toContainText(/VITE_|env|dev server|undefined|null/i);
    await expect(page.getByTestId('enable-location')).toBeVisible();
  }

  await expect(page.locator('body')).not.toContainText(/VITE_|env|dev server|undefined|null/i);

  await ctx.close();
});
