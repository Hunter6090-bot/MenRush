/**
 * Messages thread-list avatars — no square ring chrome; slightly larger circle;
 * Brand faded face for empty/generic only (media lock on real photos).
 * Mocked API — no live backend required.
 */
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ARTIFACTS = '/opt/cursor/artifacts';
const TILE_JPEG = fs.readFileSync(path.join(here, 'fixtures/my-photos-tile.jpg'));

const OWNER = {
  token: 'e2econvavatarspayload.e2econvavatarssig000',
  user: {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'avatars@test.menrush',
    name: 'Avatar Owner',
    is_verified: true,
    verification_status: 'approved',
  },
};

const REAL_PHOTO = '/uploads/profiles/bigbear-real.jpg';

const CONVERSATIONS = [
  {
    other_user_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    other_user_name: 'Bigbear25',
    photo_url: REAL_PHOTO,
    online: true,
    last_message: 'No it hasn\'t',
    last_message_time: new Date().toISOString(),
    unread_count: 0,
  },
  {
    other_user_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    other_user_name: 'Nick',
    photo_url: null,
    online: false,
    last_message: 'Hey',
    last_message_time: new Date(Date.now() - 3600_000).toISOString(),
    unread_count: 0,
  },
  {
    other_user_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    other_user_name: 'ChubbyBear',
    photo_url: '/avatars/generic/03.svg',
    online: true,
    last_message: 'Around later?',
    last_message_time: new Date(Date.now() - 7200_000).toISOString(),
    unread_count: 1,
  },
];

async function authenticate(context: BrowserContext) {
  await context.addInitScript(({ token, user }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('menrush_install_prompt_dismissed', '1');
    localStorage.setItem('menrush_push_banner_snooze_until', String(Date.now() + 86_400_000));
  }, OWNER);
}

async function mockInbox(page: Page) {
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
          body: JSON.stringify({
            ...OWNER.user,
            photo_url: REAL_PHOTO,
            bio: 'Nearby for real — clear face, clear intent, no waiting around.',
            looking_for: 'Chat and meet',
            interests: ['Chat', 'Fitness', 'Nightlife'],
            lat: 51.5,
            lng: -0.12,
          }),
        });
      }

      if (method === 'GET' && (p.endsWith('/messages/conversations') || p.includes('/messages/conversations?'))) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(CONVERSATIONS),
        });
      }

      if (method === 'GET' && (p.endsWith('/messages/unread') || p.includes('/messages/unread?'))) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ unread: 1, by_sender: {} }),
        });
      }

      if (method === 'GET' && p.includes('/notifications')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ notifications: [], unread_count: 0 }),
        });
      }

      if (method === 'GET' && (p.endsWith('/users/matches') || p.includes('/users/matches?'))) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: '[]',
        });
      }

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '{}',
      });
    },
  );

  await page.route(`**${REAL_PHOTO}`, async (route) => {
    await route.fulfill({ status: 200, contentType: 'image/jpeg', body: TILE_JPEG });
  });
}

test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});

test('Messages list: circle-only avatars, Brand empty face, no square ring', async ({ browser }) => {
  fs.mkdirSync(ARTIFACTS, { recursive: true });

  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await authenticate(ctx);
  const page = await ctx.newPage();
  await mockInbox(page);

  await page.goto('/conversations', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('messaging-inbox')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Bigbear25')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('Nick')).toBeVisible();
  await expect(page.getByText('ChubbyBear')).toBeVisible();

  // Empty + generic → Brand faded face cutout (2 rows)
  await expect(page.getByTestId('faded-brand-face')).toHaveCount(2);
  const emptyImg = page.getByTestId('faded-brand-face').first().locator('img');
  await expect(emptyImg).toHaveAttribute('src', '/brand/medallion-transparent.png');

  // Real photo kept
  const realImg = page.locator(`img[alt="Bigbear25"]`);
  await expect(realImg).toBeVisible();
  await expect(realImg).toHaveAttribute('src', /uploads\/profiles\/bigbear-real/);

  // No square ring chrome on the inbox
  const ringCount = await page.locator('[data-testid="messaging-inbox"] [class*="ring-2"]').count();
  expect(ringCount).toBe(0);

  // Thread faces are 52px circles
  const sized = await page.evaluate(() => {
    const faces = Array.from(
      document.querySelectorAll('[data-testid="messaging-inbox"] .rounded-full'),
    ) as HTMLElement[];
    return faces
      .filter((el) => el.className.includes('!w-[52px]') || el.style.width === '52px')
      .map((el) => ({ w: el.getBoundingClientRect().width, h: el.getBoundingClientRect().height }));
  });
  expect(sized.length).toBeGreaterThanOrEqual(3);
  for (const box of sized) {
    expect(box.w).toBeGreaterThanOrEqual(50);
    expect(box.h).toBeGreaterThanOrEqual(50);
    expect(Math.abs(box.w - box.h)).toBeLessThan(1);
  }

  await page.screenshot({
    path: path.join(ARTIFACTS, 'messages_avatars_circle_only.png'),
    fullPage: false,
  });

  await ctx.close();
});
