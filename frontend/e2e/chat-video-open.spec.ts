/**
 * Chat video open — no forever-black player / `--:--` duration.
 * Root cause covered: poll re-grants must not remount locked `<video src>`;
 * loading + tap-to-retry must surface on failure.
 * Mocked API — no live backend required.
 */
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { PLAYWRIGHT_BASE_URL as BASE_URL } from './support/base-url';

const OWNER = {
  token: 'e2evideoopenpayload.e2evideoopensig0000000',
  user: {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'video-open@test.menrush',
    name: 'Video Owner',
    is_verified: true,
    verification_status: 'approved',
  },
};

const PEER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const MSG_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const MEDIA_PATH = `/api/messages/${MSG_ID}/media`;

async function authenticate(context: BrowserContext) {
  await context.addInitScript(({ token, user }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('menrush_install_prompt_dismissed', '1');
  }, OWNER);
}

/** Make `<video>` report metadata quickly so we can assert ready without a real MP4 demux. */
async function installFakeVideoMetadata(context: BrowserContext) {
  await context.addInitScript(() => {
    HTMLMediaElement.prototype.play = async function play() {
      return undefined;
    };

    const markReady = (el: HTMLMediaElement, value: string) => {
      const anyEl = el as HTMLMediaElement & { __menrushSrc?: string; __menrushArmed?: boolean };
      anyEl.__menrushSrc = String(value || '');
      el.setAttribute('data-test-src', String(value || ''));
      Object.defineProperty(el, 'readyState', {
        configurable: true,
        get: () => 2,
      });
      Object.defineProperty(el, 'duration', {
        configurable: true,
        get: () => 13,
      });
      Object.defineProperty(el, 'videoWidth', {
        configurable: true,
        get: () => 640,
      });
      Object.defineProperty(el, 'videoHeight', {
        configurable: true,
        get: () => 360,
      });
      if (anyEl.__menrushArmed) return;
      anyEl.__menrushArmed = true;
      queueMicrotask(() => {
        el.dispatchEvent(new Event('loadedmetadata'));
        el.dispatchEvent(new Event('canplay'));
      });
    };

    const proto = HTMLMediaElement.prototype as HTMLMediaElement & {
      __menrushSrc?: string;
    };
    Object.defineProperty(proto, 'src', {
      configurable: true,
      get() {
        return (this as typeof proto).__menrushSrc || '';
      },
      set(value: string) {
        markReady(this, value);
      },
    });

    // React often sets media src via setAttribute — intercept to avoid network error
    // on stub bytes and to fire the same fake metadata path.
    const nativeSetAttribute = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function setAttribute(name: string, value: string) {
      if (
        (this instanceof HTMLVideoElement || this instanceof HTMLAudioElement) &&
        String(name).toLowerCase() === 'src'
      ) {
        markReady(this as HTMLMediaElement, value);
        return;
      }
      return nativeSetAttribute.call(this, name, value);
    };
  });
}

async function mockChatWithVideo(page: Page, state: { accessToken: string; failMedia: boolean }) {
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

      if (method === 'GET' && p === `/api/messages/conversation/${PEER_ID}`) {
        // Rotate grant every poll — fingerprint must ignore this or video remounts forever.
        state.accessToken = `poll-${Date.now()}`;
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: MSG_ID,
              sender_id: PEER_ID,
              receiver_id: OWNER.user.id,
              message: '🎥 Video',
              created_at: new Date().toISOString(),
              media_type: 'video',
              media_url: `${MEDIA_PATH}?access=${state.accessToken}`,
              audio_duration_ms: 13000,
              is_disappearing: false,
              expires_at: null,
              viewed_at: null,
              expired: false,
              media_clear: true,
            },
          ]),
        });
      }

      if (method === 'GET' && p === `/api/messages/${MSG_ID}/media-url`) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            url: `${MEDIA_PATH}?access=fresh-open-grant`,
            mime_type: 'video/mp4',
            media_type: 'video',
          }),
        });
      }

      if (method === 'GET' && p === MEDIA_PATH) {
        if (state.failMedia) {
          return route.fulfill({
            status: 404,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'media_unavailable' }),
          });
        }
        return route.fulfill({
          status: 200,
          contentType: 'video/mp4',
          headers: { 'Accept-Ranges': 'bytes' },
          body: Buffer.from('fake-mp4-bytes'),
        });
      }

      if (method === 'GET' && (p.endsWith('/users/me') || p.includes('/users/me?'))) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ...OWNER.user,
            photo_url: '/avatars/generic/02.svg',
            bio: 'Nearby for real — clear face, clear intent, no waiting around.',
            looking_for: 'Chat and meet',
            interests: ['Chat', 'Fitness', 'Nightlife'],
            lat: 51.5,
            lng: -0.12,
            age: 32,
            onboarding_complete: true,
          }),
        });
      }

      if (method === 'GET' && (p === `/api/users/${PEER_ID}` || p.includes(`/users/profile/${PEER_ID}`))) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: PEER_ID,
            name: 'BOA90',
            photo_url: null,
            online: true,
            last_seen: new Date().toISOString(),
          }),
        });
      }

      if (method === 'GET' && p.includes('/notifications')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      }

      if (method === 'GET' && p.includes('/messages/unread')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ total: 0, bySender: {} }),
        });
      }

      if (method === 'GET' && p.includes('/meet/')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(null),
        });
      }

      if (method === 'GET' && p.includes('/conversations')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      }

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}),
      });
    },
  );
}

test.describe('chat video open (no black forever player)', () => {
  test('locks play src across poll re-grants and shows tap-to-retry on error', async ({
    browser,
  }) => {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    await authenticate(ctx);
    await installFakeVideoMetadata(ctx);
    const page = await ctx.newPage();
    const state = { accessToken: 'initial', failMedia: false };
    await mockChatWithVideo(page, state);

    await page.goto(`${BASE_URL}/messages/${PEER_ID}`);
    await expect(page.getByTestId('video-bubble-open')).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('0:13')).toBeVisible();
    await page.screenshot({
      path: '/opt/cursor/artifacts/chat_video_tap_to_open.png',
      fullPage: false,
    });

    await page.getByTestId('video-bubble-open').click();
    // Loading can be brief with a warm grant — assert player readiness as the gate.
    const player = page.getByTestId('video-bubble-player');
    await expect(player).toBeVisible({ timeout: 10000 });
    await expect(player).toHaveAttribute('data-load-state', 'ready');
    const srcAfterOpen = await player.getAttribute('data-test-src');
    expect(srcAfterOpen).toContain('fresh-open-grant');
    await page.screenshot({
      path: '/opt/cursor/artifacts/chat_video_ready_playing.png',
      fullPage: false,
    });

    // Open-thread poll (~2.5s) rotates conversation access tokens — src must stay locked.
    await page.waitForTimeout(3200);
    await expect(player).toHaveAttribute('data-test-src', srcAfterOpen!);
    await expect(player).toHaveAttribute('data-load-state', 'ready');
    await page.screenshot({
      path: '/opt/cursor/artifacts/chat_video_src_locked_after_poll.png',
      fullPage: false,
    });

    // Honest retry — never leave a fake ready player on a void.
    await page.evaluate(() => {
      const el = document.querySelector(
        '[data-testid="video-bubble-player"]',
      ) as HTMLVideoElement | null;
      el?.dispatchEvent(new Event('error'));
    });
    await expect(page.getByTestId('video-bubble-retry')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('video-bubble-retry')).toContainText(/try again/i);
    await page.screenshot({
      path: '/opt/cursor/artifacts/chat_video_tap_to_retry.png',
      fullPage: false,
    });

    await page.getByTestId('video-bubble-retry').click();
    await expect(page.getByTestId('video-bubble-player')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('video-bubble-player')).toHaveAttribute(
      'data-load-state',
      'ready',
    );
    await page.screenshot({
      path: '/opt/cursor/artifacts/chat_video_retry_recovered.png',
      fullPage: false,
    });

    await ctx.close();
  });
});
