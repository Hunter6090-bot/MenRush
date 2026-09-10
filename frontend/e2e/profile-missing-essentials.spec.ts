/**
 * Profile essentials: Settings lists every missing item; /profile highlights them.
 * Mocked API — incomplete owner-style path (BOA90-shaped display name).
 */
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const OWNER = {
  token: 'e2eprofilepayload.e2eprofilesignature00',
  user: {
    id: '6e9b68ad-7d20-46fc-be94-3c2ac3fa16b9',
    email: 'boa90@test.menrush',
    name: 'B',
    is_verified: false,
    verification_status: 'none',
    is_premium: true,
  },
};

const INCOMPLETE_ME = {
  id: OWNER.user.id,
  email: OWNER.user.email,
  name: 'B',
  age: null,
  date_of_birth: null,
  bio: '',
  headline: '',
  looking_for: '',
  photo_url: '/avatars/generic/01.svg',
  interests: [] as string[],
  height_cm: null,
  weight_kg: null,
  relationship_status: null,
  hosting_status: null,
  is_premium: true,
  beta_premium_included: true,
  is_visible: true,
  lat: 51.5074,
  lng: -0.1278,
};

const ARTIFACTS = '/opt/cursor/artifacts';

const EXPECTED_MISSING = [
  'Display name',
  'Date of birth',
  'Real photo',
  'Bio',
  'Headline',
  'Looking for',
  'Tags',
  'Height',
  'Body / vibe tags',
  'Relationship status',
  'Hosting',
];

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

    if (method === 'GET' && (p.endsWith('/users/me') || p.includes('/users/me?'))) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(INCOMPLETE_ME),
      });
    }

    if (method === 'GET' && p.includes('/auth/account')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ email: OWNER.user.email }),
      });
    }

    if (method === 'GET' && p.includes('/users/blocked')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ blocked: [] }),
      });
    }

    if (method === 'GET' && p.includes('/users/team')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ is_team: false }),
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

test.describe('profile missing essentials highlight', () => {
  test('Settings lists all missing chips; Profile highlights incomplete fields', async ({
    browser,
  }) => {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      recordVideo: { dir: ARTIFACTS, size: { width: 390, height: 844 } },
    });
    await authenticate(ctx);
    const page = await ctx.newPage();
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(String(err?.stack || err?.message || err)));
    await mockApis(page);

    await page.goto('/settings');
    await expect(page.getByTestId('settings-profile-completion')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('settings-profile-completion-score')).toContainText('0/11 filled');

    const missingList = page.getByTestId('settings-profile-missing-list');
    await expect(missingList).toBeVisible();
    await expect(missingList.getByText('Still missing', { exact: true })).toBeVisible();
    for (const label of EXPECTED_MISSING) {
      await expect(missingList.getByText(label, { exact: true })).toBeVisible();
    }
    // Must not truncate to three items with an ellipsis trail.
    await expect(missingList).not.toContainText('…');

    fs.mkdirSync(ARTIFACTS, { recursive: true });
    await page.screenshot({
      path: path.join(ARTIFACTS, 'settings_complete_profile_all_missing.png'),
      fullPage: true,
    });

    const edit = page.getByTestId('settings-profile-edit');
    await expect(edit).toHaveAttribute('href', /\/profile#profile-essential-/);
    await edit.click();

    await expect(page.getByTestId('profile-edit-form')).toBeVisible({ timeout: 15000 });
    if (pageErrors.length) {
      throw new Error(`Profile pageerror(s):\n${pageErrors.join('\n\n')}`);
    }
    await expect(page.getByTestId('profile-missing-essentials-banner')).toBeVisible();
    await expect(page.getByTestId('profile-missing-essentials-banner').getByText('Still missing')).toBeVisible();
    await expect(page.getByTestId('profile-missing-named-jump')).toHaveText('Missing · Display name');
    await expect(page.getByTestId('profile-missing-essentials-list')).toBeVisible();

    for (const label of EXPECTED_MISSING) {
      await expect(
        page.getByTestId('profile-missing-essentials-list').getByText(label, { exact: true }),
      ).toBeVisible();
    }

    await expect(page.locator('[data-essential-missing="true"]')).toHaveCount(10);
    // Tags + body/vibe share one section; display name through hosting cover the rest.
    await expect(page.getByTestId('profile-field-bio')).toBeVisible();
    await expect(page.locator('#profile-essential-bio[data-essential-missing="true"]')).toHaveCount(1);
    await expect(page.locator('#profile-essential-tags[data-essential-missing="true"]')).toHaveCount(1);
    await expect(page.getByTestId('essential-needed-cue').first()).toHaveText('Missing');

    await page.screenshot({
      path: path.join(ARTIFACTS, 'profile_edit_missing_essentials_highlighted.png'),
      fullPage: true,
    });

    // Sticky named cue jumps to the first missing control and focuses it.
    await page.getByTestId('profile-missing-named-jump').click();
    await expect(page.locator('#profile-essential-name')).toBeInViewport();
    await expect(page.getByTestId('profile-field-display-name')).toBeFocused();

    await page.getByTestId('profile-missing-bio').click();
    await expect(page.locator('#profile-essential-bio')).toBeInViewport();
    await expect(page.getByTestId('profile-field-bio')).toBeFocused();

    // Settings chip → exact field on Profile.
    await page.goto('/settings');
    await expect(page.getByTestId('settings-missing-headline')).toBeVisible();
    await page.getByTestId('settings-missing-headline').click();
    await expect(page.getByTestId('profile-edit-form')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#profile-essential-headline')).toBeInViewport();
    await expect(page.getByTestId('profile-field-headline')).toBeFocused();

    await page.waitForTimeout(400);
    const video = page.video();
    await ctx.close();

    if (video) {
      const raw = await video.path();
      const dest = path.join(ARTIFACTS, 'profile_missing_essentials_settings_to_highlight.webm');
      if (raw && fs.existsSync(raw)) {
        fs.copyFileSync(raw, dest);
        try {
          fs.unlinkSync(raw);
        } catch {
          /* ignore */
        }
      }
    }
  });
});
