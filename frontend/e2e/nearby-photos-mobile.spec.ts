/**
 * Would have caught Al's report: Nearby cards stuck tens of seconds / iPhone
 * photos blank. Authenticates for real, then mocks nearby + oversized uploads
 * so the grid photo pipeline must show tiles within budget — without Mapbox.
 */
import { expect, test, request as apiRequest } from '@playwright/test';
import { TEST_PASSWORD, ALICE } from './test-accounts';
import { PLAYWRIGHT_BASE_URL as BASE_URL } from './support/base-url';

const tinyJpeg = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGcP//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//Z',
  'base64',
);

test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});

test('Nearby profile cards + photos appear within budget (iPhone-sized)', async ({ browser }) => {
  const api = await apiRequest.newContext({ baseURL: BASE_URL });
  const loginRes = await api.post('/api/auth/login', {
    data: { email: ALICE.email, password: TEST_PASSWORD },
  });
  expect(loginRes.ok()).toBeTruthy();
  const auth = await loginRes.json();
  await api.dispose();

  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
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
          id: 'u-trip',
          name: 'Trip98',
          age: 34,
          photo_url: '/uploads/profiles/trip-huge.jpg',
          online: true,
          distance_km: 0.4,
          distance_label: '0.2 mi',
          lat: 51.514,
          lng: -0.136,
        },
        {
          id: 'u-al',
          name: 'Al',
          age: 40,
          photo_url: '/uploads/profiles/al-missing.png',
          online: true,
          distance_km: 0.8,
          distance_label: '0.5 mi',
          lat: 51.515,
          lng: -0.137,
        },
      ]),
    });
  });

  await page.route('**/api/media/display**', async (route) => {
    await route.fulfill({ status: 404, body: 'no display' });
  });

  await page.route('**/uploads/profiles/trip-huge.jpg', async (route) => {
    const pad = Buffer.concat([tinyJpeg, Buffer.alloc(180_000)]);
    await route.fulfill({ status: 200, contentType: 'image/jpeg', body: pad });
  });
  await page.route('**/uploads/profiles/al-missing.png', async (route) => {
    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: '{"error":"missing"}',
    });
  });

  const t0 = Date.now();
  await page.goto('/discover', { waitUntil: 'domcontentloaded' });

  // Dismiss install sheet if it still appears.
  const dismiss = page.getByRole('button', { name: /Not now/i });
  if (await dismiss.isVisible().catch(() => false)) {
    await dismiss.click();
  }

  await expect(page.getByText('Trip98').first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('Al').first()).toBeVisible({ timeout: 10_000 });
  const cardsMs = Date.now() - t0;
  expect(cardsMs).toBeLessThan(12_000);

  await expect
    .poll(async () => page.locator('[data-testid="nearby-profile-photo"]').count(), {
      timeout: 12_000,
    })
    .toBeGreaterThan(0);

  await ctx.close();
});
