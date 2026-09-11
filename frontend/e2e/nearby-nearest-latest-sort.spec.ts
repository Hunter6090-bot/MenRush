/**
 * Nearby Nearest ↔ Latest sort — phone-width Grid order changes with the control.
 */
import { expect, test, request as apiRequest } from '@playwright/test';
import { TEST_PASSWORD, ALICE } from './test-accounts';
import { PLAYWRIGHT_BASE_URL as BASE_URL } from './support/base-url';

const FIXTURE_GEO = { latitude: 51.5136, longitude: -0.1365 };

test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});

test('Nearby sort toggles Nearest distance order vs Latest fresh faces', async ({ browser }) => {
  const api = await apiRequest.newContext({ baseURL: BASE_URL });
  const loginRes = await api.post('/api/auth/login', {
    data: { email: ALICE.email, password: TEST_PASSWORD },
  });
  expect(loginRes.ok()).toBeTruthy();
  const auth = await loginRes.json();
  await api.dispose();

  const now = Date.now();
  const freshCreated = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString();
  const veteranCreated = new Date(now - 40 * 24 * 60 * 60 * 1000).toISOString();

  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    geolocation: FIXTURE_GEO,
    permissions: ['geolocation'],
  });
  await ctx.addInitScript(({ token, user }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('menrush_install_prompt_dismissed', '1');
    // Default Nearest — clear any prior Latest from other tests.
    localStorage.removeItem('menrush_nearby_sort');
    const fixed = { lat: 51.5136, lng: -0.1365 };
    navigator.geolocation.getCurrentPosition = ((success: PositionCallback) => {
      success({
        coords: {
          latitude: fixed.lat,
          longitude: fixed.lng,
          accuracy: 10,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      } as GeolocationPosition);
    }) as typeof navigator.geolocation.getCurrentPosition;
    navigator.geolocation.watchPosition = ((success: PositionCallback) => {
      success({
        coords: {
          latitude: fixed.lat,
          longitude: fixed.lng,
          accuracy: 10,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      } as GeolocationPosition);
      return 1;
    }) as typeof navigator.geolocation.watchPosition;
  }, auth);

  const page = await ctx.newPage();

  await page.route('**/api/users/nearby**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'u-fresh-far',
          name: 'FreshFar',
          age: 28,
          photo_url: '/avatars/generic/20s.svg',
          online: true,
          distance_km: 3.5,
          distance_label: '2.2 mi',
          lat: 51.52,
          lng: -0.14,
          created_at: freshCreated,
          interests: ['Bear'],
        },
        {
          id: 'u-vet-near',
          name: 'VetNear',
          age: 34,
          photo_url: '/avatars/generic/30s.svg',
          online: true,
          distance_km: 0.4,
          distance_label: '0.2 mi',
          lat: 51.514,
          lng: -0.136,
          created_at: veteranCreated,
          interests: ['Otter'],
        },
        {
          id: 'u-mid',
          name: 'MidGuy',
          age: 30,
          photo_url: '/avatars/generic/30s.svg',
          online: true,
          distance_km: 1.5,
          distance_label: '0.9 mi',
          lat: 51.516,
          lng: -0.138,
          created_at: veteranCreated,
          interests: ['Jock'],
        },
      ]),
    });
  });

  await page.goto('/discover', { waitUntil: 'domcontentloaded' });

  const dismiss = page.getByRole('button', { name: /Not now/i });
  if (await dismiss.isVisible().catch(() => false)) {
    await dismiss.click();
  }

  await expect(page.getByTestId('nearby-profile-grid')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('nearby-sort-toggle')).toBeVisible();
  await expect(page.getByTestId('nearby-sort-nearest')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('nearby-sort-latest')).toHaveAttribute('aria-pressed', 'false');

  const cardOrder = async () =>
    page.evaluate(() =>
      Array.from(document.querySelectorAll('[data-testid="nearby-grid-card"]')).map((card) => {
        const photo = card.querySelector('[data-testid^="nearby-grid-photo-"]');
        return photo?.getAttribute('data-testid')?.replace('nearby-grid-photo-', '') ?? '';
      }),
    );

  expect(await cardOrder()).toEqual(['u-vet-near', 'u-mid', 'u-fresh-far']);

  await page.getByTestId('nearby-sort-latest').click();
  await expect(page.getByTestId('nearby-sort-latest')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('nearby-sort-nearest')).toHaveAttribute('aria-pressed', 'false');

  const latestOrder = await cardOrder();
  expect(latestOrder[0]).toBe('u-fresh-far');
  expect(latestOrder).toEqual(expect.arrayContaining(['u-vet-near', 'u-mid', 'u-fresh-far']));
  expect(latestOrder).toHaveLength(3);

  // Session persistence key written.
  const stored = await page.evaluate(() => localStorage.getItem('menrush_nearby_sort'));
  expect(stored).toBe('latest');

  await ctx.close();
});
