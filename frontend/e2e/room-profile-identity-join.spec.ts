/**
 * Room join gate: choose real profile OR temp name (photo optional).
 * Stubbed API — proves gate appears with both choices; neither path blocks on missing temp photo.
 */
import { test, expect, type Page } from '@playwright/test';

const FAKE_TOKEN = 'e2e-test-token-payload.e2e-test-token-signature';

const FAKE_USER = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Profile Bear',
  email: 'bear@example.com',
  photo_url: '/uploads/profiles/bear.jpg',
  bio: 'Looking for real men nearby tonight and always.',
  looking_for: 'Right now',
  interests: ['Gym', 'Bars', 'Chat'],
  is_verified: false,
  is_premium: true,
  premium_tier: 'premium',
  lat: 51.5074,
  lng: -0.1278,
};

async function stubRoomJoin(page: Page) {
  const calls: string[] = [];

  await page.addInitScript(
    ({ token, user }) => {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem(
        'menrush_last_location',
        JSON.stringify({ lat: user.lat, lng: user.lng, at: Date.now() }),
      );
    },
    { token: FAKE_TOKEN, user: FAKE_USER },
  );

  await page.route('**/*', async (route) => {
    let pathname = '';
    try {
      pathname = new URL(route.request().url()).pathname;
    } catch {
      return route.continue();
    }
    if (!pathname.startsWith('/api/')) {
      return route.continue();
    }

    const method = route.request().method();
    calls.push(`${method} ${pathname}`);

    if (pathname === '/api/users/me' || pathname.startsWith('/api/auth/')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(FAKE_USER),
      });
    }
    if (pathname.startsWith('/api/notifications')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    if (pathname.startsWith('/api/users/nearby') || pathname.startsWith('/api/users/search')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    if (pathname.startsWith('/api/likes')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    if (
      pathname.startsWith('/api/messages/conversations') ||
      pathname.startsWith('/api/users/matches')
    ) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    if (pathname.match(/^\/api\/rooms\/[^/]+\/temp-identity/) && method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ display_name: null, photo_url: null }),
      });
    }
    if (pathname.match(/^\/api\/rooms\/[^/]+\/temp-identity/) && method === 'PUT') {
      const body = route.request().postDataJSON() as {
        display_name?: string;
        photo_url?: string;
      };
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          display_name: body.display_name ?? 'Anon Bear',
          photo_url: body.photo_url ?? null,
        }),
      });
    }
    if (pathname.match(/^\/api\/rooms\/[^/]+\/temp-identity\/photo/) && method === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ photo_url: '/uploads/room-temp/x.jpg' }),
      });
    }
    if (pathname.match(/^\/api\/rooms\/[^/]+\/temp-identity\/clear/) && method === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ cleared: true }),
      });
    }
    if (pathname.match(/^\/api\/rooms\/[^/]+\/temp-identity/) && method === 'DELETE') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ deleted: true }),
      });
    }
    if (pathname.match(/^\/api\/rooms\/[^/]+\/messages$/) && method === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    if (pathname.match(/^\/api\/rooms\/[^/]+\/members$/)) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: FAKE_USER.id,
            name: FAKE_USER.name,
            photo_url: FAKE_USER.photo_url,
            role: 'member',
            using_temp_identity: false,
          },
        ]),
      });
    }
    if (pathname.match(/^\/api\/rooms\/[^/]+$/) && method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'room-profile-1',
          name: 'London Bears',
          description: 'Dual-choice identity gate',
          member_count: 1,
          user_role: 'member',
          is_location_based: true,
        }),
      });
    }
    if (pathname === '/api/rooms' && method === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  return () => calls;
}

test.describe('room identity gate join', () => {
  test('cold enter shows gate with profile and temp choices', async ({ page }) => {
    await stubRoomJoin(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/rooms/room-profile-1');

    await expect(page.getByTestId('room-temp-identity-gate')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('room-use-real-profile')).toBeVisible();
    await expect(page.getByText(/Use a temporary name/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Room settings' })).toHaveCount(0);
  });

  test('real profile path enters with profile name', async ({ page }) => {
    const getCalls = await stubRoomJoin(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/rooms/room-profile-1');

    await expect(page.getByTestId('room-temp-identity-gate')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('room-use-real-profile').click();

    await expect(page.getByTestId('room-temp-identity-gate')).toHaveCount(0, { timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'Room settings' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Profile Bear/i }).first()).toBeVisible();

    const calls = getCalls();
    expect(calls.some((c) => c.startsWith('DELETE ') && c.includes('/temp-identity'))).toBe(true);
  });

  test('temp name without photo enters — no hard stop', async ({ page }) => {
    const getCalls = await stubRoomJoin(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/rooms/room-profile-1');

    await expect(page.getByTestId('room-temp-identity-gate')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Anon Bear' }).click();
    await page.getByTestId('room-temp-enter').click();

    await expect(page.getByTestId('room-temp-identity-gate')).toHaveCount(0, { timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'Room settings' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Anon Bear/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Profile Bear/i })).toHaveCount(0);

    const calls = getCalls();
    expect(calls.some((c) => c.startsWith('PUT ') && c.includes('/temp-identity'))).toBe(true);
    expect(calls.some((c) => c.includes('/temp-identity/photo'))).toBe(false);
  });

  test('Not now leaves without joining video chrome', async ({ page }) => {
    await stubRoomJoin(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/rooms/room-profile-1');

    await expect(page.getByTestId('room-temp-identity-gate')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('room-temp-not-now').click();
    await expect(page.getByTestId('room-temp-identity-gate')).toHaveCount(0, { timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'Room settings' })).toHaveCount(0);
  });
});
