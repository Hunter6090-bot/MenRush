/**
 * P0 Messaging phone-fit: 1:1 chat must not require pinch-to-shrink.
 * Document + messaging root scrollWidth ≤ clientWidth on common phone widths.
 *
 * Builds on phone-fit-no-horizontal-overflow (#191) — Messaging leftovers only.
 * Does not set user-scalable=no.
 */
import { expect, test, request as apiRequest, type BrowserContext, type Page } from '@playwright/test';
import { TEST_PASSWORD, ALICE, BOB } from './test-accounts';
import { PLAYWRIGHT_BASE_URL as BASE_URL } from './support/base-url';

const PHONE_VIEWPORTS = [
  { name: 'android-360', width: 360, height: 800 },
  { name: 'iphone-390', width: 390, height: 844 },
  { name: 'iphone-430', width: 430, height: 932 },
] as const;

type LoginResult = {
  token: string;
  user: { id: string; email: string; name: string };
};

async function login(email: string): Promise<LoginResult> {
  const api = await apiRequest.newContext({ baseURL: BASE_URL });
  try {
    const response = await api.post('/api/auth/login', {
      data: { email, password: TEST_PASSWORD },
    });
    expect(response.ok()).toBeTruthy();
    return response.json();
  } finally {
    await api.dispose();
  }
}

async function authenticate(context: BrowserContext, result: LoginResult) {
  await context.addInitScript(({ token, user }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('menrush_install_prompt_dismissed', '1');
    localStorage.setItem('menrush_push_banner_snooze_until', String(Date.now() + 86_400_000));
  }, result);
}

async function ensureMutualMatch(alice: LoginResult, bob: LoginResult) {
  const api = await apiRequest.newContext({ baseURL: BASE_URL });
  try {
    await api.post(`/api/users/like/${bob.user.id}`, {
      headers: { Authorization: `Bearer ${alice.token}` },
    });
    await api.post(`/api/users/like/${alice.user.id}`, {
      headers: { Authorization: `Bearer ${bob.token}` },
    });
  } finally {
    await api.dispose();
  }
}

async function assertNoHorizontalOverflow(page: Page, label: string) {
  await page.evaluate(() => document.fonts.ready).catch(() => undefined);
  await page.waitForTimeout(350);

  const metrics = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const root = document.querySelector('[data-testid="messaging-root"]') as HTMLElement | null;
    const thread = (document.querySelector('[data-testid="chat-messages-scroll"]') ||
      document.querySelector('[data-messaging-thread="1"]')) as HTMLElement | null;
    const composer = document.querySelector('[data-testid="chat-composer"]') as HTMLElement | null;
    const inbox = document.querySelector('[data-testid="messaging-inbox"]') as HTMLElement | null;

    const measure = (el: HTMLElement | null) => {
      if (!el) return null;
      return {
        clientWidth: el.clientWidth,
        scrollWidth: el.scrollWidth,
        overflow: el.scrollWidth - el.clientWidth,
      };
    };

    return {
      clientWidth: doc.clientWidth,
      scrollWidth: Math.max(doc.scrollWidth, body.scrollWidth),
      overflow: Math.max(doc.scrollWidth, body.scrollWidth) - doc.clientWidth,
      viewport: document.querySelector('meta[name="viewport"]')?.getAttribute('content') ?? '',
      scale: window.visualViewport?.scale ?? 1,
      messagingRoot: measure(root),
      thread: measure(thread),
      composer: measure(composer),
      inbox: measure(inbox),
    };
  });

  expect(
    metrics.viewport,
    'viewport meta must keep device-width + initial-scale=1 (no user-scalable=no-only fix)',
  ).toMatch(/width\s*=\s*device-width/i);
  expect(metrics.viewport).toMatch(/initial-scale\s*=\s*1(\.0)?/i);
  expect(metrics.viewport).not.toMatch(/user-scalable\s*=\s*no/i);

  expect(
    metrics.overflow,
    `${label}: document horizontal overflow (scroll=${metrics.scrollWidth} client=${metrics.clientWidth})`,
  ).toBeLessThanOrEqual(2);

  if (metrics.messagingRoot) {
    expect(
      metrics.messagingRoot.overflow,
      `${label}: messaging-root overflow (scroll=${metrics.messagingRoot.scrollWidth} client=${metrics.messagingRoot.clientWidth})`,
    ).toBeLessThanOrEqual(2);
  }
  if (metrics.thread) {
    expect(
      metrics.thread.overflow,
      `${label}: chat-messages-scroll overflow`,
    ).toBeLessThanOrEqual(2);
  }
  if (metrics.composer) {
    expect(
      metrics.composer.overflow,
      `${label}: chat-composer overflow`,
    ).toBeLessThanOrEqual(2);
  }
  if (metrics.inbox) {
    expect(
      metrics.inbox.overflow,
      `${label}: messaging-inbox overflow`,
    ).toBeLessThanOrEqual(2);
  }

  return metrics;
}

for (const vp of PHONE_VIEWPORTS) {
  test.describe(`messaging phone-fit @ ${vp.name} (${vp.width}×${vp.height})`, () => {
    test('inbox + open thread have no horizontal overflow', async ({ browser }) => {
      const alice = await login(ALICE.email);
      const bob = await login(BOB.email);
      await ensureMutualMatch(alice, bob);

      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        isMobile: true,
        hasTouch: true,
      });
      await authenticate(ctx, alice);
      const page = await ctx.newPage();

      await page.goto('/conversations');
      await expect(page.getByTestId('messaging-inbox')).toBeVisible({ timeout: 20_000 });
      await assertNoHorizontalOverflow(page, `${vp.name} inbox`);

      // Seed a long unbroken string + open the thread so bubbles/media chrome are exercised.
      const long = `phonefit-${'x'.repeat(80)}-${Date.now()}`;
      const api = await apiRequest.newContext({ baseURL: BASE_URL });
      try {
        await api.post('/api/messages', {
          headers: { Authorization: `Bearer ${alice.token}` },
          data: { receiver_id: bob.user.id, message: long },
        });
      } finally {
        await api.dispose();
      }

      await page.goto(`/messages/${bob.user.id}`);
      await expect(page.getByTestId('messaging-root')).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTestId('chat-composer')).toBeVisible();
      await expect(page.getByText(long, { exact: true }).first()).toBeVisible({ timeout: 15_000 });

      // Type so Send replaces Mic — composer width under pressure.
      await page.getByTestId('chat-text-input').fill('fit check');
      await expect(page.getByTestId('chat-send-button')).toBeVisible();

      const metrics = await assertNoHorizontalOverflow(page, `${vp.name} open thread`);
      expect(metrics.scale).toBeCloseTo(1, 1);

      // Guard against overflow-x:clip hiding a still-clipped composer/header.
      const bounds = await page.evaluate(() => {
        const vw = window.innerWidth;
        const send = document.querySelector('[data-testid="chat-send-button"]');
        const composer = document.querySelector('[data-testid="chat-composer"]');
        const root = document.querySelector('[data-testid="messaging-root"]');
        const rect = (el: Element | null) => {
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return {
            left: r.left,
            right: r.right,
            overflows: r.right > vw + 1 || r.left < -1,
          };
        };
        return {
          vw,
          send: rect(send),
          composer: rect(composer),
          root: rect(root),
        };
      });
      expect(bounds.send?.overflows, `${vp.name}: Send clipped`).toBeFalsy();
      expect(bounds.composer?.overflows, `${vp.name}: composer clipped`).toBeFalsy();
      expect(bounds.root?.overflows, `${vp.name}: messaging-root clipped`).toBeFalsy();

      await ctx.close();
    });
  });
}
