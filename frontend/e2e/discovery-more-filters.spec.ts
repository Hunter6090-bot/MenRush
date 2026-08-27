import { expect, test, type APIRequestContext, type BrowserContext } from '@playwright/test';
import { ALICE, TEST_PASSWORD, TEST_HOT_SPOT } from './test-accounts';

const FIXTURE_GEO = { latitude: TEST_HOT_SPOT.lat, longitude: TEST_HOT_SPOT.lng };

type LoginResult = {
  token: string;
  user: { id: string; email: string; name: string; is_verified: boolean; verification_status: string };
};

async function login(request: APIRequestContext, email: string): Promise<LoginResult> {
  const response = await request.post('/api/auth/login', { data: { email, password: TEST_PASSWORD } });
  expect(response.ok()).toBeTruthy();
  return response.json();
}

async function authenticate(context: BrowserContext, result: LoginResult) {
  await context.addInitScript(({ token, user }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  }, result);
}

/**
 * More filters drawer — vibe/scene/connection compose with Looking for.
 * No new nav tab; lives under Mood & filters on Discover.
 */
test('Discover more filters drawer selects vibe/scene and refetches nearby', async ({
  browser,
  request,
}) => {
  const alice = await login(request, ALICE.email);
  const ctx = await browser.newContext({
    geolocation: FIXTURE_GEO,
    permissions: ['geolocation'],
    viewport: { width: 1280, height: 800 },
  });
  await authenticate(ctx, alice);
  const page = await ctx.newPage();

  const nearbyRequests: string[] = [];
  page.on('request', (req) => {
    const url = req.url();
    if (url.includes('/api/users/nearby')) nearbyRequests.push(url);
  });

  await page.goto('/discover');

  // Mood & filters is a collapsed <details> on desktop — open it to reach More filters.
  const moodFilters = page.locator('details').filter({ hasText: 'Mood & filters' }).first();
  await expect(moodFilters).toBeVisible({ timeout: 30_000 });
  await moodFilters.locator('summary').click();
  await expect(page.getByTestId('more-filters-open')).toBeVisible({ timeout: 10_000 });

  // No new Discovery Engine nav item
  await expect(page.getByRole('link', { name: /discovery engine/i })).toHaveCount(0);

  await page.getByTestId('more-filters-open').click();
  await expect(page.getByTestId('more-filters-drawer')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'More filters' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Vibe' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Scene' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Connection' })).toBeVisible();

  const before = nearbyRequests.length;
  await page.getByTestId('more-filter-tag-Kinky').click();
  await page.getByTestId('more-filter-tag-Gym').click();
  await expect(page.getByTestId('more-filter-tag-Filthy')).toBeVisible();
  await expect(page.getByTestId('more-filter-tag-Glory hole')).toBeVisible();
  await expect(page.getByTestId('more-filter-tag-Threesome')).toBeVisible();
  await expect(page.getByTestId('more-filter-tag-Romantic')).toHaveCount(0);
  await expect(page.getByTestId('more-filter-tag-Coffee')).toHaveCount(0);
  await expect(page.getByTestId('more-filter-tag-Friends')).toHaveCount(0);

  await expect
    .poll(
      () =>
        nearbyRequests
          .slice(before)
          .some((u) => u.includes('interests=') && u.includes('Kinky') && u.includes('Gym')),
      { timeout: 10_000 },
    )
    .toBe(true);

  await page.getByTestId('more-filters-close').click();
  await expect(page.getByTestId('more-filters-drawer')).toHaveCount(0);
  await expect(page.getByTestId('more-filters-open')).toContainText('2');

  await ctx.close();
});
