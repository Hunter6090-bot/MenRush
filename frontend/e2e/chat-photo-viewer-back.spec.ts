/**
 * Chat photo viewer — Back/Close returns to the same 1:1 thread;
 * opened images use one standard frame (not native resolution).
 * Mocked API — no live backend required.
 */
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { CHAT_IMAGE_VIEWER_FRAME_BOUNDS } from '../src/lib/chatImageViewerFrame';

const here = path.dirname(fileURLToPath(import.meta.url));
const ARTIFACTS = '/opt/cursor/artifacts';
const TILE_JPEG = fs.readFileSync(path.join(here, 'fixtures/my-photos-tile.jpg'));

const OWNER = {
  token: 'e2ephotoviewerpayload.e2ephotoviewersig000',
  user: {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'viewer@test.menrush',
    name: 'Viewer Owner',
    is_verified: true,
    verification_status: 'approved',
  },
};

const PEER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const PEER_NAME = 'Peer Mate';
const MSG_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const MEDIA_PATH = `/api/messages/${MSG_ID}/media`;

async function authenticate(context: BrowserContext) {
  await context.addInitScript(({ token, user }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('menrush_install_prompt_dismissed', '1');
  }, OWNER);
}

async function mockChatWithPhoto(page: Page) {
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

      if (method === 'GET' && p.includes(MEDIA_PATH)) {
        return route.fulfill({
          status: 200,
          contentType: 'image/jpeg',
          body: TILE_JPEG,
        });
      }

      if (method === 'GET' && (p.endsWith('/users/me') || p.includes('/users/me?'))) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ...OWNER.user,
            photo_url: MEDIA_PATH,
            bio: 'Nearby for real — clear face, clear intent, no waiting around.',
            looking_for: 'Chat and meet',
            interests: ['Chat', 'Fitness', 'Nightlife'],
            lat: 51.5,
            lng: -0.12,
          }),
        });
      }

      if (method === 'GET' && p.includes('/notifications')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ notifications: [], unread_count: 0 }),
        });
      }

      if (method === 'GET' && p.includes(`/messages/conversation/${PEER_ID}`)) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: MSG_ID,
              sender_id: PEER_ID,
              receiver_id: OWNER.user.id,
              message: '📷 Photo',
              created_at: new Date().toISOString(),
              media_type: 'image',
              media_url: MEDIA_PATH,
              is_disappearing: false,
              max_views: null,
              view_count: 0,
              remaining_views: null,
              media_clear: true,
              sender_name: PEER_NAME,
            },
          ]),
        });
      }

      if (method === 'GET' && p.includes(`/users/profile/${PEER_ID}`)) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: PEER_ID,
            name: PEER_NAME,
            age: 32,
            photo_url: null,
            online: true,
            last_seen: new Date().toISOString(),
          }),
        });
      }

      if (method === 'GET' && (p.endsWith('/messages/conversations') || p.endsWith('/messages/unread'))) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(p.endsWith('/unread') ? { total: 0, bySender: {} } : []),
        });
      }

      if (method === 'GET' && p.includes('/meet/')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            my_confirmed: false,
            peer_confirmed: false,
            mutual: false,
            my_confirmed_at: null,
            peer_confirmed_at: null,
          }),
        });
      }

      // Soft-fail anything else so the shell can render.
      if (method === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({}),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    },
  );
}

async function mockChatWithViewOncePhoto(page: Page) {
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

      if (method === 'GET' && p.includes(MEDIA_PATH)) {
        return route.fulfill({
          status: 200,
          contentType: 'image/jpeg',
          body: TILE_JPEG,
        });
      }

      if (method === 'POST' && p.includes(`/messages/${MSG_ID}/view`)) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: MSG_ID,
            sender_id: PEER_ID,
            receiver_id: OWNER.user.id,
            message: '📷 Photo',
            created_at: new Date().toISOString(),
            media_type: 'image',
            media_url: MEDIA_PATH,
            is_disappearing: true,
            max_views: 1,
            view_count: 1,
            remaining_views: 0,
            media_clear: true,
            sender_name: PEER_NAME,
          }),
        });
      }

      if (method === 'GET' && (p.endsWith('/users/me') || p.includes('/users/me?'))) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ...OWNER.user,
            photo_url: MEDIA_PATH,
            bio: 'Nearby for real — clear face, clear intent, no waiting around.',
            looking_for: 'Chat and meet',
            interests: ['Chat', 'Fitness', 'Nightlife'],
            lat: 51.5,
            lng: -0.12,
          }),
        });
      }

      if (method === 'GET' && p.includes('/notifications')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ notifications: [], unread_count: 0 }),
        });
      }

      if (method === 'GET' && p.includes(`/messages/conversation/${PEER_ID}`)) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: MSG_ID,
              sender_id: PEER_ID,
              receiver_id: OWNER.user.id,
              message: '📷 Photo',
              created_at: new Date().toISOString(),
              media_type: 'image',
              media_url: MEDIA_PATH,
              is_disappearing: true,
              max_views: 1,
              view_count: 0,
              remaining_views: 1,
              media_clear: true,
              sender_name: PEER_NAME,
            },
          ]),
        });
      }

      if (method === 'GET' && p.includes(`/users/profile/${PEER_ID}`)) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: PEER_ID,
            name: PEER_NAME,
            age: 32,
            photo_url: null,
            online: true,
            last_seen: new Date().toISOString(),
          }),
        });
      }

      if (method === 'GET' && (p.endsWith('/messages/conversations') || p.endsWith('/messages/unread'))) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(p.endsWith('/unread') ? { total: 0, bySender: {} } : []),
        });
      }

      if (method === 'GET' && p.includes('/meet/')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            my_confirmed: false,
            peer_confirmed: false,
            mutual: false,
            my_confirmed_at: null,
            peer_confirmed_at: null,
          }),
        });
      }

      if (method === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({}),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    },
  );
}

test.describe('chat photo viewer — back + standard frame', () => {
  test('Back returns to the same 1:1 thread; frame stays phone-safe', async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    await authenticate(ctx);
    const page = await ctx.newPage();
    await mockChatWithPhoto(page);

    await page.goto(`/messages/${PEER_ID}`);
    await expect(page.getByTestId('chat-header-profile')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('image-permanent').first()).toBeVisible({ timeout: 15_000 });

    const threadUrl = page.url();
    expect(threadUrl).toContain(`/messages/${PEER_ID}`);

    await page.getByTestId('image-permanent').first().click();
    await expect(page.getByTestId('image-viewer')).toBeVisible();
    await expect(page.getByTestId('image-viewer-back')).toBeVisible();
    await expect(page.getByTestId('image-viewer-close')).toBeVisible();
    await expect(page.getByTestId('image-viewer-frame')).toBeVisible();

    const viewport = page.viewportSize()!;
    const frameBox = await page.getByTestId('image-viewer-frame').boundingBox();
    expect(frameBox).toBeTruthy();
    expect(frameBox!.width).toBeLessThanOrEqual(viewport.width * CHAT_IMAGE_VIEWER_FRAME_BOUNDS.maxWidthRatio + 2);
    expect(frameBox!.height).toBeLessThanOrEqual(viewport.height * CHAT_IMAGE_VIEWER_FRAME_BOUNDS.maxHeightRatio + 2);
    expect(frameBox!.width).toBeGreaterThanOrEqual(CHAT_IMAGE_VIEWER_FRAME_BOUNDS.minWidthPx);
    expect(frameBox!.height).toBeGreaterThanOrEqual(CHAT_IMAGE_VIEWER_FRAME_BOUNDS.minHeightPx);

    // object-fit: contain on the opened image
    await expect(page.getByTestId('image-viewer-img')).toHaveCSS('object-fit', 'contain');

    // Permanent: trust line under the photo — high contrast, period not em dash
    await expect(page.getByTestId('image-viewer-meta')).toBeVisible({ timeout: 10_000 });
    const trust = page.getByTestId('image-viewer-trust');
    await expect(trust).toBeVisible();
    await expect(trust).toHaveText(/Screenshots can’t be fully blocked on the web\. View with trust\./);
    await expect(trust).not.toHaveText(/—/);
    const trustStyles = await trust.evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        fontSizePx: parseFloat(s.fontSize),
        color: s.color,
        background: s.backgroundColor,
      };
    });
    expect(trustStyles.fontSizePx).toBeGreaterThanOrEqual(14);
    // Must not be the old low-contrast copper (#6B5035)
    expect(trustStyles.color.replace(/\s/g, '')).not.toMatch(/rgb\(107,\s*80,\s*53\)/);

    fs.mkdirSync(ARTIFACTS, { recursive: true });
    await page.screenshot({
      path: path.join(ARTIFACTS, 'chat_photo_viewer_caption_permanent.png'),
      fullPage: false,
    });

    await page.getByTestId('image-viewer-back').click();
    await expect(page.getByTestId('image-viewer')).toHaveCount(0);
    expect(page.url()).toBe(threadUrl);
    await expect(page.getByTestId('chat-header-profile')).toBeVisible();
    await expect(page.getByTestId('image-permanent').first()).toBeVisible();
    await expect(page.getByTestId('chat-messages-scroll')).toBeVisible();

    await page.screenshot({
      path: path.join(ARTIFACTS, 'chat_photo_viewer_back_same_thread.png'),
      fullPage: false,
    });

    // Re-open and Close also returns to the same thread
    await page.getByTestId('image-permanent').first().click();
    await expect(page.getByTestId('image-viewer')).toBeVisible();
    await page.getByTestId('image-viewer-close').click();
    await expect(page.getByTestId('image-viewer')).toHaveCount(0);
    expect(page.url()).toContain(`/messages/${PEER_ID}`);
    await expect(page.getByTestId('chat-header-profile')).toBeVisible();

    await ctx.close();
  });

  test('view-once status + trust captions are large and high-contrast', async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    await authenticate(ctx);
    const page = await ctx.newPage();
    await mockChatWithViewOncePhoto(page);

    await page.goto(`/messages/${PEER_ID}`);
    await expect(page.getByTestId('image-locked').first()).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('image-locked').first().click();

    await expect(page.getByTestId('image-viewer')).toBeVisible();
    await expect(page.getByTestId('image-viewer-meta')).toBeVisible({ timeout: 10_000 });

    const status = page.getByTestId('image-viewer-status');
    await expect(status).toBeVisible();
    await expect(status).toContainText(/closes in \d+s/);
    await expect(status).toContainText(/views? left|No views left|View once/i);

    const statusStyles = await status.evaluate((el) => {
      const s = getComputedStyle(el);
      return { fontSizePx: parseFloat(s.fontSize), color: s.color };
    });
    expect(statusStyles.fontSizePx).toBeGreaterThanOrEqual(14);

    const trust = page.getByTestId('image-viewer-trust');
    await expect(trust).toHaveText(/Screenshots can’t be fully blocked on the web\. View with trust\./);
    await expect(trust).not.toHaveText(/—/);
    const trustStyles = await trust.evaluate((el) => {
      const s = getComputedStyle(el);
      return { fontSizePx: parseFloat(s.fontSize), color: s.color };
    });
    expect(trustStyles.fontSizePx).toBeGreaterThanOrEqual(14);
    expect(trustStyles.color.replace(/\s/g, '')).not.toMatch(/rgb\(107,\s*80,\s*53\)/);

    fs.mkdirSync(ARTIFACTS, { recursive: true });
    await page.screenshot({
      path: path.join(ARTIFACTS, 'chat_photo_viewer_caption_view_once.png'),
      fullPage: false,
    });

    // Countdown / No views left behaviour still live — close returns to thread
    await page.getByTestId('image-viewer-close').click();
    await expect(page.getByTestId('image-viewer')).toHaveCount(0);
    await expect(page.getByTestId('chat-header-profile')).toBeVisible();

    await ctx.close();
  });
});
