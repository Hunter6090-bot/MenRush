/**
 * Nearby NEW joiners — Grid badge + Status filter (Brand placeholder `NEW`).
 * Mocks nearby payload with created_at so soft-refresh surfaces fresh accounts.
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

test('Nearby Grid shows NEW badge and Status NEW filter surfaces fresh joiners', async ({
  browser,
}) => {
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
          id: 'u-fresh',
          name: 'FreshGuy',
          age: 28,
          photo_url: '/avatars/generic/20s.svg',
          online: true,
          distance_km: 1.2,
          distance_label: '0.7 mi',
          lat: 51.515,
          lng: -0.137,
          created_at: freshCreated,
          interests: ['Bear'],
        },
        {
          id: 'u-visitor',
          name: 'TownVisitor',
          age: 31,
          photo_url: '/avatars/generic/30s.svg',
          online: true,
          distance_km: 0.9,
          distance_label: '0.6 mi',
          lat: 51.5145,
          lng: -0.1368,
          created_at: veteranCreated,
          is_visitor: true,
          visitor_expires_at: new Date(now + 36 * 60 * 60 * 1000).toISOString(),
          interests: ['Otter'],
        },
        {
          id: 'u-vet',
          name: 'Veteran',
          age: 34,
          photo_url: '/avatars/generic/30s.svg',
          online: true,
          distance_km: 0.5,
          distance_label: '0.3 mi',
          lat: 51.514,
          lng: -0.136,
          created_at: veteranCreated,
          interests: ['Otter'],
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
  await expect(page.getByText('FreshGuy').first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('TownVisitor').first()).toBeVisible();
  await expect(page.getByText('Veteran').first()).toBeVisible();

  // NEW badge on newly joined + visitor; not on veteran.
  const freshCard = page.locator('[data-testid="nearby-grid-card"]').filter({ hasText: 'FreshGuy' });
  const visitorCard = page.locator('[data-testid="nearby-grid-card"]').filter({ hasText: 'TownVisitor' });
  const vetCard = page.locator('[data-testid="nearby-grid-card"]').filter({ hasText: 'Veteran' });
  await expect(freshCard.getByTestId('nearby-new-badge')).toBeVisible();
  await expect(freshCard.getByTestId('nearby-new-badge')).toHaveText('NEW');
  await expect(freshCard.getByTestId('nearby-new-badge')).toHaveAttribute('aria-label', 'Just joined');
  await expect(visitorCard.getByTestId('nearby-new-badge')).toBeVisible();
  await expect(visitorCard.getByTestId('nearby-new-badge')).toHaveText('NEW');
  await expect(vetCard.getByTestId('nearby-new-badge')).toHaveCount(0);

  // Open Filters & mood → Status → NEW.
  const filtersDetails = page.locator('details').filter({ hasText: 'Filters & mood' }).first();
  await expect(filtersDetails).toBeVisible({ timeout: 10_000 });
  await filtersDetails.locator('summary').click();
  await page.getByRole('button', { name: /^Status/ }).click();
  await expect(page.getByTestId('status-filter-new')).toBeVisible();
  await page.getByTestId('status-filter-new').click();

  await expect(page.getByText('FreshGuy').first()).toBeVisible();
  await expect(page.getByText('TownVisitor').first()).toBeVisible();
  await expect(page.getByText('Veteran')).toHaveCount(0);
  // Grid-scoped: map peek can also show NEW pins for the same guys (expected).
  await expect(page.getByTestId('nearby-profile-grid').getByTestId('nearby-new-badge')).toHaveCount(2);

  await ctx.close();
});
