/**
 * P0 phone-fit — every main surface opens at ~1× with no horizontal overflow.
 *
 * Builds on #191 (landing + Discover overflow) + #203/#226 (Messaging).
 * Covers Nearby Grid/Map, Messages inbox, Matches, Profile, Rooms,
 * Hot Spots / Cruise, Settings, and auth shells on iPhone + Android widths.
 *
 * Does not set user-scalable=no. Map pinch stays intentional via touch-action:none
 * on discover/hotspots map surfaces.
 */
import { expect, test, request as apiRequest, type BrowserContext, type Page } from '@playwright/test';
import { TEST_PASSWORD, ALICE, BOB } from './test-accounts';
import { PLAYWRIGHT_BASE_URL as BASE_URL } from './support/base-url';

const PHONE_VIEWPORTS = [
  { name: 'iphone-390', width: 390, height: 844 },
  { name: 'android-412', width: 412, height: 915 },
] as const;

type LoginResult = {
  token: string;
  user: { id: string; email: string; name: string };
};

async function loginAlice(): Promise<LoginResult> {
  const api = await apiRequest.newContext({ baseURL: BASE_URL });
  try {
    const response = await api.post('/api/auth/login', {
      data: { email: ALICE.email, password: TEST_PASSWORD },
    });
    expect(response.ok()).toBeTruthy();
    return response.json();
  } finally {
    await api.dispose();
  }
}

async function authenticate(context: BrowserContext, auth: LoginResult) {
  await context.addInitScript(({ token, user }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('menrush_install_prompt_dismissed', '1');
    localStorage.setItem('menrush_push_banner_snooze_until', String(Date.now() + 86_400_000));
  }, auth);
}

async function assertPhoneFit(page: Page, label: string, opts?: { focusSelector?: string }) {
  await page.evaluate(() => document.fonts.ready).catch(() => undefined);
  await page.waitForTimeout(350);

  if (opts?.focusSelector) {
    const target = page.locator(opts.focusSelector).first();
    if (await target.count()) {
      await target.click({ timeout: 5_000 }).catch(() => undefined);
      await page.waitForTimeout(200);
    }
  }

  const metrics = await page.evaluate((focusSel) => {
    const doc = document.documentElement;
    const body = document.body;
    const shell = document.querySelector('[data-testid="app-shell"]') as HTMLElement | null;
    const focused =
      (focusSel ? (document.querySelector(focusSel) as HTMLElement | null) : null) ||
      (document.activeElement as HTMLElement | null);

    let inputFontPx: number | null = null;
    if (
      focused &&
      (focused.tagName === 'INPUT' ||
        focused.tagName === 'TEXTAREA' ||
        focused.tagName === 'SELECT')
    ) {
      const type = (focused as HTMLInputElement).type || '';
      if (!['checkbox', 'radio', 'range', 'file', 'hidden', 'button', 'submit', 'reset', 'image'].includes(type)) {
        const px = parseFloat(getComputedStyle(focused).fontSize);
        inputFontPx = Number.isFinite(px) ? px : null;
      }
    }

    return {
      clientWidth: doc.clientWidth,
      scrollWidth: Math.max(doc.scrollWidth, body.scrollWidth),
      overflow: Math.max(doc.scrollWidth, body.scrollWidth) - doc.clientWidth,
      viewport: document.querySelector('meta[name="viewport"]')?.getAttribute('content') ?? '',
      scale: window.visualViewport?.scale ?? 1,
      touchAction: getComputedStyle(doc).touchAction,
      shellTouch: shell ? getComputedStyle(shell).touchAction : '',
      inputFontPx,
    };
  }, opts?.focusSelector ?? null);

  expect(
    metrics.viewport,
    `${label}: viewport meta must keep device-width + initial-scale=1 (no user-scalable=no-only fix)`,
  ).toMatch(/width\s*=\s*device-width/i);
  expect(metrics.viewport).toMatch(/initial-scale\s*=\s*1(\.0)?/i);
  expect(metrics.viewport).not.toMatch(/user-scalable\s*=\s*no/i);

  expect(
    metrics.overflow,
    `${label}: horizontal overflow (scroll=${metrics.scrollWidth} client=${metrics.clientWidth})`,
  ).toBeLessThanOrEqual(2);

  expect(metrics.scale, `${label}: visualViewport.scale ≈ 1`).toBeCloseTo(1, 1);

  expect(
    metrics.touchAction,
    `${label}: html should use touch-action:manipulation (double-tap zoom off; pinch still allowed)`,
  ).toMatch(/manipulation/);

  if (metrics.inputFontPx != null) {
    expect(
      metrics.inputFontPx,
      `${label}: focused control font-size must be ≥16px (got ${metrics.inputFontPx})`,
    ).toBeGreaterThanOrEqual(16);
  }

  return metrics;
}

const AUTH_ROUTES = [
  { path: '/', ready: () => true, label: 'landing' },
  { path: '/login', ready: 'input[type="email"], input[name="email"]', label: 'login', focus: 'input[type="email"], input[name="email"]' },
  { path: '/register', ready: 'input, form', label: 'register', focus: 'input:not([type="checkbox"]):not([type="hidden"])' },
] as const;

const APP_ROUTES = [
  {
    path: '/discover',
    ready: '[data-testid="discover-shell"], [aria-label="Primary"]',
    label: 'nearby',
  },
  {
    path: '/conversations',
    ready: '[data-testid="messaging-inbox"]',
    label: 'messages-list',
  },
  {
    path: '/matches',
    ready: '[data-testid="matches-shell"], [data-testid="matches-empty"]',
    label: 'matches',
  },
  {
    path: '/profile',
    ready: '[data-testid="profile-field-bio"], input[type="text"], textarea',
    label: 'profile-own',
    focus: 'input[type="text"], textarea, input[type="date"]',
  },
  {
    path: '/rooms',
    ready: '[data-testid="rooms-shell"]',
    label: 'rooms',
    focus: 'input[type="search"]',
  },
  {
    path: '/hot-spots',
    ready: '[data-testid="hotspots-shell"]',
    label: 'hot-spots-cruise',
  },
  {
    path: '/settings',
    ready: '[data-testid="settings-shell"]',
    label: 'settings',
  },
] as const;

for (const vp of PHONE_VIEWPORTS) {
  test.describe(`phone-fit all surfaces @ ${vp.name} (${vp.width}×${vp.height})`, () => {
    for (const route of AUTH_ROUTES) {
      test(`auth: ${route.label} opens at 1× without horizontal overflow`, async ({ browser }) => {
        const ctx = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
          isMobile: true,
          hasTouch: true,
        });
        const page = await ctx.newPage();
        await page.goto(route.path);
        if (route.path === '/') {
          await expect(
            page.getByRole('heading', {
              level: 1,
              name: /Real men\.\s*Verified profiles\.\s*Total discretion\./i,
            }),
          ).toBeVisible({ timeout: 20_000 });
        } else if (typeof route.ready === 'string') {
          await expect(page.locator(route.ready).first()).toBeVisible({ timeout: 20_000 });
        }
        await assertPhoneFit(page, `${vp.name} ${route.label}`, {
          focusSelector: 'focus' in route ? route.focus : undefined,
        });
        await ctx.close();
      });
    }

    test('logged-in main surfaces open at 1× without horizontal overflow', async ({ browser }) => {
      const alice = await loginAlice();
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        isMobile: true,
        hasTouch: true,
      });
      await authenticate(ctx, alice);
      const page = await ctx.newPage();

      for (const route of APP_ROUTES) {
        await page.goto(route.path);
        await expect(page.locator(route.ready).first()).toBeVisible({ timeout: 20_000 });
        await assertPhoneFit(page, `${vp.name} ${route.label}`, {
          focusSelector: 'focus' in route ? route.focus : undefined,
        });
      }

      // Other profile (must be someone else — own id routes to /profile editor).
      await page.goto(`/profile/${BOB.id}`);
      await expect(
        page.locator('[data-testid="profile-view-shell"], [data-testid="profile-view-body"]').first(),
      ).toBeVisible({ timeout: 20_000 });
      await assertPhoneFit(page, `${vp.name} profile-other`);

      // Nearby map surface must keep touch-action:none for intentional pinch.
      await page.goto('/discover');
      await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible({
        timeout: 20_000,
      });
      const mapTouch = await page.evaluate(() => {
        const el =
          (document.querySelector('.discover-map-surface') as HTMLElement | null) ||
          (document.querySelector('.discover-map-host') as HTMLElement | null);
        return el ? getComputedStyle(el).touchAction : null;
      });
      if (mapTouch != null) {
        expect(mapTouch, `${vp.name}: Nearby map keeps touch-action none`).toMatch(/none/);
      }

      await ctx.close();
    });
  });
}
