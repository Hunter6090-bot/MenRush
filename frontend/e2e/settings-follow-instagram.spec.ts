import { expect, test } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const ARTIFACTS = '/opt/cursor/artifacts';
const PHONE = { width: 390, height: 750 } as const;

const OWNER = {
  token: 'e2efollowpayload.e2efollowsignature000',
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
  age: 34,
  date_of_birth: '1991-01-15',
  bio: 'Settings follow Instagram test user',
  headline: 'London south',
  looking_for: 'Friends and more',
  photo_url: '/avatars/generic/01.svg',
  interests: ['Bears', 'Gym', 'Travel'],
  height_cm: 180,
  weight_kg: 85,
  relationship_status: 'single',
  hosting_status: 'can_host',
  is_premium: true,
  beta_premium_included: true,
  is_visible: true,
  lat: 51.5074,
  lng: -0.1278,
};

test.describe('Settings Follow MenRush (Instagram)', () => {
  test('renders real Instagram logo glyph, clickable @menrushsocial handle, and no unverified platforms on dark theme', async ({
    browser,
  }) => {
    fs.mkdirSync(ARTIFACTS, { recursive: true });

    const ctx = await browser.newContext({
      viewport: PHONE,
      colorScheme: 'dark',
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    });

    await ctx.addInitScript(({ token, user }) => {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('menrush_theme', 'dark');
      localStorage.setItem('menrush_install_prompt_dismissed', '1');
      localStorage.setItem('menrush_push_banner_snooze_until', String(Date.now() + 86_400_000));
      localStorage.setItem('menrush_profile_setup_skip', '1');
    }, OWNER);

    const page = await ctx.newPage();

    await page.route(
      (url) => {
        try {
          const u = typeof url === 'string' ? new URL(url) : url;
          return u.pathname === '/api' || u.pathname.startsWith('/api/');
        } catch {
          return false;
        }
      },
      async (route) => {
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
      },
    );

    await page.goto('/settings');
    await page.waitForSelector('[data-testid="settings-shell"]');

    // Scroll to the Follow rows in About section
    const igRow = page.locator('[data-testid="settings-follow-instagram"]');
    await igRow.scrollIntoViewIfNeeded();

    await expect(igRow).toBeVisible();
    await expect(igRow).toHaveAttribute('href', 'https://www.instagram.com/menrushsocial/');
    await expect(igRow).toHaveAttribute('target', '_blank');
    await expect(igRow).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(igRow).toHaveAttribute(
      'aria-label',
      'Follow MenRush on Instagram @menrushsocial',
    );

    // Verify touch target >= 44px
    const igBox = await igRow.boundingBox();
    expect(igBox).not.toBeNull();
    if (igBox) {
      expect(igBox.height).toBeGreaterThanOrEqual(44);
    }

    // Verify Instagram glyph is rendered inside
    const igGlyph = igRow.locator('[data-testid="settings-instagram-glyph"]');
    await expect(igGlyph).toBeVisible();

    // Verify text mentions
    await expect(igRow).toContainText('Follow on Instagram');
    await expect(igRow).toContainText('Instagram @menrushsocial');

    // Bluesky row
    const bskyRow = page.locator('[data-testid="settings-follow-bluesky"]');
    await expect(bskyRow).toBeVisible();
    await expect(bskyRow).toHaveAttribute('href', 'https://bsky.app/profile/menrush.bsky.social');
    await expect(bskyRow).toHaveAttribute('target', '_blank');
    await expect(bskyRow).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(bskyRow).toHaveAttribute(
      'aria-label',
      'Follow MenRush on Bluesky @menrush.bsky.social',
    );

    const bskyBox = await bskyRow.boundingBox();
    expect(bskyBox).not.toBeNull();
    if (bskyBox) {
      expect(bskyBox.height).toBeGreaterThanOrEqual(44);
    }

    const bskyGlyph = bskyRow.locator('[data-testid="settings-bluesky-glyph"]');
    await expect(bskyGlyph).toBeVisible();
    await expect(bskyRow).toContainText('Follow on Bluesky');
    await expect(bskyRow).toContainText('Bluesky @menrush.bsky.social');

    // Verify glyph wrappers keep cream text (monochrome brand glyphs stay monochrome; no copper fill on hover)
    const igWrapper = page.locator('[data-testid="settings-follow-instagram-glyph"]');
    await expect(igWrapper).toHaveClass(/text-\[var\(--cream\)\]/);
    await expect(igWrapper).not.toHaveClass(/group-hover:text-/);

    const bskyWrapper = page.locator('[data-testid="settings-follow-bluesky-glyph"]');
    await expect(bskyWrapper).toHaveClass(/text-\[var\(--cream\)\]/);
    await expect(bskyWrapper).not.toHaveClass(/group-hover:text-/);

    // Verify Soft Brand lock: X / TikTok / Facebook absent entirely
    const shell = page.locator('[data-testid="settings-shell"]');
    await expect(shell.locator('a[href*="twitter.com"]')).toHaveCount(0);
    await expect(shell.locator('a[href*="x.com"]')).toHaveCount(0);
    await expect(shell.locator('a[href*="tiktok.com"]')).toHaveCount(0);
    await expect(shell.locator('a[href*="facebook.com"]')).toHaveCount(0);

    // Capture screenshot for walkthrough artifact on dark theme
    await page.screenshot({
      path: path.join(ARTIFACTS, 'settings_follow_social.png'),
      fullPage: false,
    });

    await ctx.close();
  });
});
