/**
 * Edit Profile: Map photo Brand copy + Hosting Brand options.
 * Mocked API — no competitor wording.
 */
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import fs from 'fs';

const OWNER = {
  token: 'e2emapphoto.e2emapphotosignature00001',
  user: {
    id: '6e9b68ad-7d20-46fc-be94-3c2ac3fa16b9',
    email: 'boa90@test.menrush',
    name: 'BOA90',
    is_verified: false,
    verification_status: 'none',
    is_premium: true,
  },
};

const ME = {
  id: OWNER.user.id,
  email: OWNER.user.email,
  name: 'BOA90',
  age: 35,
  date_of_birth: '1990-01-15',
  bio: 'Owner account nearby for real meetups tonight.',
  headline: 'In town',
  looking_for: 'Chat',
  photo_url: '/uploads/profiles/main.jpg',
  map_photo_url: null,
  interests: ['Otter', 'Chat', 'Fitness', 'Nightlife', 'Casual'],
  height_cm: 180,
  weight_kg: 90,
  relationship_status: 'Single',
  hosting_status: null,
  is_premium: true,
  beta_premium_included: true,
  is_visible: true,
  lat: 51.5074,
  lng: -0.1278,
};

const ARTIFACTS = '/opt/cursor/artifacts';

async function authenticate(context: BrowserContext) {
  await context.addInitScript(({ token, user }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('menrush_install_prompt_dismissed', '1');
    localStorage.setItem('menrush_push_banner_snooze_until', String(Date.now() + 86_400_000));
    localStorage.setItem('menrush_profile_setup_skip', '1');
  }, OWNER);
}

async function mockApis(page: Page) {
  await page.route((url) => {
    try {
      const u = typeof url === 'string' ? new URL(url) : url;
      return u.pathname === '/api' || u.pathname.startsWith('/api/');
    } catch {
      return false;
    }
  }, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const method = req.method();
    const p = url.pathname;

    if (method === 'GET' && (p.endsWith('/users/me') || p.includes('/users/me?'))) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(ME),
      });
    }
    if (method === 'GET' && p.includes('/users/profile-views')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ viewers: [], total: 0, has_more: false, hidden_count: 0 }),
      });
    }
    if (method === 'GET' && p.includes('/profile-meta')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ mood: null, is_ghost: false }),
      });
    }
    if (method === 'GET' && p.includes('/verify')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ is_verified: false, status: 'none' }),
      });
    }
    if (method === 'GET' && p.includes('/users/me/referrals')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          referral_code: 'BOA90TEST',
          verified_count: 0,
          pending_count: 0,
          credited_count: 0,
          unlock_every: 3,
          progress_to_unlock: 0,
          unlocks_earned: 0,
          pending_payout_total: 0,
          referrals: [],
        }),
      });
    }
    if (method === 'POST' && p.includes('/users/profile')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...ME, ...(await req.postDataJSON().catch(() => ({}))) }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    });
  });
}

test.describe('Profile Map photo + Hosting Brand', () => {
  test('Edit Profile shows Map photo helper and Hosting options', async ({ page, context }) => {
    fs.mkdirSync(ARTIFACTS, { recursive: true });
    await authenticate(context);
    await mockApis(page);
    await page.goto('/profile');
    await expect(page.getByTestId('profile-edit-form')).toBeVisible({ timeout: 15_000 });

    const mapSection = page.getByTestId('map-photo-section');
    await expect(mapSection).toBeVisible();
    await expect(mapSection.getByText('Map photo', { exact: true })).toBeVisible();
    await expect(
      mapSection.getByText('Shown on Nearby Map when your main shot stays private.'),
    ).toBeVisible();
    await expect(page.getByText('SFW Alternate')).toHaveCount(0);

    const hosting = page.getByTestId('profile-field-hosting');
    await expect(hosting).toBeVisible();
    await expect(hosting.getByRole('button', { name: 'Not hosting' })).toBeVisible();
    await expect(hosting.getByRole('button', { name: 'Can host' })).toBeVisible();
    await expect(hosting.getByRole('button', { name: 'Hosting now' })).toBeVisible();
    await expect(hosting.getByRole('button', { name: 'Travelling' })).toHaveCount(0);

    await page.screenshot({
      path: `${ARTIFACTS}/profile_map_photo_hosting_edit.png`,
      fullPage: true,
    });
  });
});
