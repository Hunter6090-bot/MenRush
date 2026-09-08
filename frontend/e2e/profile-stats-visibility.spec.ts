/**
 * Stats per-field Show toggles: hide does not wipe owner values;
 * public profile omits hidden Stats.
 */
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const OWNER = {
  token: 'e2estatsvispayload.e2estatsvissignature0',
  user: {
    id: 'a1b2c3d4-1111-4222-8333-444455556666',
    email: 'statsvis@test.menrush',
    name: 'StatsVis',
    is_verified: false,
    verification_status: 'none',
    is_premium: true,
  },
};

const COMPLETE_ME = {
  id: OWNER.user.id,
  email: OWNER.user.email,
  name: 'StatsVis',
  age: 35,
  date_of_birth: '1990-06-15',
  show_age: true,
  show_height: true,
  show_weight: true,
  show_relationship: true,
  bio: 'Owner account nearby for real meetups tonight.',
  headline: 'Hosting in town',
  looking_for: 'Chat',
  photo_url: '/avatars/generic/02.svg',
  interests: ['Otter', 'Chat', 'Fitness', 'Nightlife', 'Casual'],
  height_cm: 180,
  weight_kg: 82,
  relationship_status: 'Single',
  hosting_status: 'Hosting now',
  is_premium: true,
  beta_premium_included: true,
  is_visible: true,
  lat: 51.5074,
  lng: -0.1278,
};

const ARTIFACTS = '/opt/cursor/artifacts';

let meState = { ...COMPLETE_ME };
let lastProfilePatch: Record<string, unknown> | null = null;

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

    if (method === 'GET' && p.includes('/users/me/referrals')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          referral_code: 'STATSVIS',
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

    if (method === 'GET' && (p.endsWith('/users/me') || p.includes('/users/me?'))) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(meState),
      });
    }

    if (method === 'POST' && p.includes('/users/profile')) {
      const body = req.postDataJSON() as Record<string, unknown>;
      lastProfilePatch = body;
      meState = {
        ...meState,
        ...body,
        height_cm:
          body.height_cm === undefined ? meState.height_cm : (body.height_cm as number | null),
        weight_kg:
          body.weight_kg === undefined ? meState.weight_kg : (body.weight_kg as number | null),
      };
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(meState),
      });
    }

    if (method === 'GET' && /\/users\/profile\/[0-9a-f-]{36}$/i.test(p)) {
      // Public profile view: omit Stats when show_* is false (mirrors backend CASE WHEN).
      const publicProfile = {
        id: meState.id,
        name: meState.name,
        age: meState.show_age ? meState.age : null,
        bio: meState.bio,
        headline: meState.headline,
        looking_for: meState.looking_for,
        photo_url: meState.photo_url,
        interests: meState.interests,
        height_cm: meState.show_height ? meState.height_cm : null,
        weight_kg: meState.show_weight ? meState.weight_kg : null,
        relationship_status: meState.show_relationship ? meState.relationship_status : null,
        hosting_status: meState.hosting_status,
        is_verified: false,
        online: true,
      };
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(publicProfile),
      });
    }

    if (method === 'GET' && p.includes('/auth/account')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ email: OWNER.user.email }),
      });
    }

    if (method === 'GET' && (p.includes('/users/blocked') || p.includes('/users/team'))) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(p.includes('team') ? { is_team: false } : { blocked: [] }),
      });
    }

    if (method === 'GET' && p.includes('/users/profile-views')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ viewers: [], total: 0, has_more: false, hidden_count: 0 }),
      });
    }

    if (method === 'GET' && p.includes('/verify/')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ is_verified: false, status: 'none' }),
      });
    }

    if (method === 'GET' && (p.includes('/notifications') || p.includes('/messages'))) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ notifications: [], conversations: [], unread: 0 }),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    });
  });

  await page.route('**/socket.io/**', (route) => route.abort());
}

test.describe('profile stats field visibility', () => {
  test('Show toggles hide Stats without wiping values', async ({ browser }) => {
    meState = { ...COMPLETE_ME };
    lastProfilePatch = null;

    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      recordVideo: { dir: ARTIFACTS, size: { width: 390, height: 844 } },
    });
    await authenticate(ctx);
    const page = await ctx.newPage();
    await mockApis(page);

    await page.goto('/profile');
    await expect(page.getByTestId('profile-stats-section')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('profile-show-age')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('profile-show-height')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('profile-field-height')).toHaveValue('180');
    await expect(page.getByTestId('profile-field-weight')).toHaveValue('82');

    fs.mkdirSync(ARTIFACTS, { recursive: true });
    await page.screenshot({
      path: path.join(ARTIFACTS, 'profile_stats_show_toggles_on.png'),
      fullPage: false,
    });

    await page.getByTestId('profile-show-height').click();
    await expect(page.getByTestId('profile-show-height')).toHaveAttribute('aria-checked', 'false');
    await page.getByTestId('profile-show-age').click();
    await expect(page.getByTestId('profile-show-age')).toHaveAttribute('aria-checked', 'false');
    // Values kept for owner after hide.
    await expect(page.getByTestId('profile-field-height')).toHaveValue('180');
    await expect(page.getByTestId('profile-field-weight')).toHaveValue('82');

    await page.getByRole('button', { name: /save/i }).first().click();
    await expect.poll(() => lastProfilePatch).not.toBeNull();
    expect(lastProfilePatch).toMatchObject({
      show_age: false,
      show_height: false,
      height_cm: 180,
      weight_kg: 82,
    });

    await page.screenshot({
      path: path.join(ARTIFACTS, 'profile_stats_height_age_hidden.png'),
      fullPage: false,
    });

    await page.waitForTimeout(300);
    const video = page.video();
    await ctx.close();
    if (video) {
      const raw = await video.path();
      const dest = path.join(ARTIFACTS, 'profile_stats_show_toggles_hide_keeps_value.webm');
      if (raw && fs.existsSync(raw)) {
        fs.copyFileSync(raw, dest);
        try {
          fs.unlinkSync(raw);
        } catch {
          /* ignore */
        }
      }
    }

    // Other viewer: hidden Stats omitted on public profile.
    const viewer = {
      token: 'e2estatsviewerpayload.e2estatsviewersig00',
      user: {
        id: 'bbbbbbbb-2222-4333-8444-555566667777',
        email: 'viewer@test.menrush',
        name: 'Viewer',
        is_verified: false,
        verification_status: 'none',
        is_premium: true,
      },
    };
    const viewCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await viewCtx.addInitScript(({ token, user }) => {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('menrush_install_prompt_dismissed', '1');
      localStorage.setItem('menrush_push_banner_snooze_until', String(Date.now() + 86_400_000));
      localStorage.setItem('menrush_profile_setup_skip', '1');
    }, viewer);
    const viewPage = await viewCtx.newPage();
    await mockApis(viewPage);
    await viewPage.goto(`/profile/${OWNER.user.id}`);
    await expect(viewPage.getByText('StatsVis')).toBeVisible({ timeout: 15000 });
    await expect(viewPage.getByText('Age 35')).toHaveCount(0);
    await expect(viewPage.getByText(/5\s*['′]/)).toHaveCount(0);
    await expect(viewPage.getByText('Single', { exact: true })).toBeVisible();
    await expect(viewPage.getByText('Hosting now', { exact: true })).toBeVisible();
    await viewPage.screenshot({
      path: path.join(ARTIFACTS, 'public_profile_hidden_stats_omitted.png'),
      fullPage: false,
    });
    await viewCtx.close();
  });
});
