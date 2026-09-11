/**
 * P0: /settings and /profile must vertically scroll on phone viewports.
 *
 * Root cause (Layout): min-h-dvh shell let flex children grow with content, so
 * page-enter's overflow-y-auto never engaged; overscroll-y-contain then blocked
 * document scroll chaining. Fix locks app-shell to h-dvh so page-enter scrolls.
 *
 * Preserves #224 map containment, #229 phone-fit, #231 chat thread scroll.
 */
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const OWNER = {
  token: 'e2escrollpayload.e2escrollsignature000',
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
  bio: 'Scroll test bio — enough profile fields to keep the editor tall on phones.',
  headline: 'Nearby now',
  looking_for: 'Friends and more',
  photo_url: '/avatars/generic/01.svg',
  interests: ['Bears', 'Gym', 'Travel', 'Music', 'Coffee'],
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

const ARTIFACTS = '/opt/cursor/artifacts';
const PHONE = { width: 390, height: 700 } as const;

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

type ScrollMetrics = {
  vh: number;
  shellH: number;
  pageEnterCH: number;
  pageEnterSH: number;
  canScroll: boolean;
  scrollTop: number;
  maxScroll: number;
  shellOverflowY: string;
  pageEnterOverflowY: string;
};

async function readScrollMetrics(page: Page): Promise<ScrollMetrics> {
  return page.evaluate(() => {
    const shell = document.querySelector('[data-testid="app-shell"]') as HTMLElement | null;
    const pe = document.querySelector('[data-testid="page-enter"]') as HTMLElement | null;
    if (!shell || !pe) {
      throw new Error('app-shell or page-enter missing');
    }
    return {
      vh: window.innerHeight,
      shellH: Math.round(shell.getBoundingClientRect().height),
      pageEnterCH: pe.clientHeight,
      pageEnterSH: pe.scrollHeight,
      canScroll: pe.scrollHeight > pe.clientHeight + 1,
      scrollTop: pe.scrollTop,
      maxScroll: Math.max(0, pe.scrollHeight - pe.clientHeight),
      shellOverflowY: getComputedStyle(shell).overflowY,
      pageEnterOverflowY: getComputedStyle(pe).overflowY,
    };
  });
}

async function scrollPageEnterTo(page: Page, top: number) {
  await page.evaluate((value) => {
    const pe = document.querySelector('[data-testid="page-enter"]') as HTMLElement | null;
    if (!pe) throw new Error('page-enter missing');
    pe.scrollTop = value;
  }, top);
}

async function assertRouteScrolls(page: Page, label: string, readySelector: string) {
  await expect(page.locator(readySelector).first()).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(250);

  const before = await readScrollMetrics(page);
  expect(before.shellH, `${label}: app-shell must lock to viewport height`).toBeLessThanOrEqual(
    before.vh + 1,
  );
  expect(before.shellH, `${label}: app-shell should fill the viewport`).toBeGreaterThan(before.vh - 8);
  expect(before.pageEnterOverflowY, `${label}: page-enter overflow-y`).toMatch(/auto|scroll/);
  expect(before.canScroll, `${label}: page-enter must overflow (tall content)`).toBe(true);
  expect(before.maxScroll, `${label}: usable scroll range`).toBeGreaterThan(80);

  const target = Math.min(before.maxScroll, Math.max(160, Math.floor(before.maxScroll * 0.55)));
  await scrollPageEnterTo(page, target);
  await page.waitForTimeout(80);

  const after = await readScrollMetrics(page);
  expect(after.scrollTop, `${label}: page-enter scrollTop must advance`).toBeGreaterThanOrEqual(
    target - 2,
  );

  await scrollPageEnterTo(page, after.maxScroll);
  await page.waitForTimeout(80);
  const atEnd = await readScrollMetrics(page);
  expect(atEnd.scrollTop, `${label}: can reach end of page-enter`).toBeGreaterThanOrEqual(
    atEnd.maxScroll - 2,
  );

  return { before, after, atEnd };
}

test.describe('settings + profile vertical scroll', () => {
  test('phone viewport: /settings and /profile scroll inside page-enter', async ({ browser }) => {
    fs.mkdirSync(ARTIFACTS, { recursive: true });

    const ctx = await browser.newContext({
      viewport: PHONE,
      recordVideo: { dir: ARTIFACTS, size: PHONE },
    });
    await authenticate(ctx);
    const page = await ctx.newPage();
    await mockApis(page);

    await page.goto('/settings');
    const settings = await assertRouteScrolls(page, 'settings', '[data-testid="settings-shell"]');
    await page.screenshot({
      path: path.join(ARTIFACTS, 'settings_scroll_mid.png'),
      fullPage: false,
    });

    await page.goto('/profile');
    const profile = await assertRouteScrolls(
      page,
      'profile',
      '[data-testid="profile-edit-form"], [data-testid="profile-field-bio"], textarea',
    );
    await page.screenshot({
      path: path.join(ARTIFACTS, 'profile_scroll_end.png'),
      fullPage: false,
    });

    // Soft sanity: shell stayed viewport-locked on both routes.
    expect(settings.before.shellH).toBe(settings.atEnd.shellH);
    expect(profile.before.shellH).toBe(profile.atEnd.shellH);

    await ctx.close();

    const videos = fs
      .readdirSync(ARTIFACTS)
      .filter((f) => f.endsWith('.webm'))
      .map((f) => ({ f, m: fs.statSync(path.join(ARTIFACTS, f)).mtimeMs }))
      .sort((a, b) => b.m - a.m);
    if (videos[0]) {
      const dest = path.join(ARTIFACTS, 'settings_profile_scroll_phone.webm');
      fs.renameSync(path.join(ARTIFACTS, videos[0].f), dest);
    }
  });
});
