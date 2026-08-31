/**
 * Incoming media must paint in an already-open 1:1 without leave/reenter (PR #158).
 * Covers socket delivery + the push-hint / visibility refresh path used when
 * iPhone PWAs miss the WebSocket event while suspended.
 */
import { expect, test, request as apiRequest, type BrowserContext } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { TEST_PASSWORD, ALICE, BOB } from './test-accounts';
import { PLAYWRIGHT_BASE_URL as BASE_URL } from './support/base-url';

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
  }, result);
}

function tinyPngPath(): string {
  const out = path.join('/tmp', 'menrush-e2e-chat-image.png');
  // 1x1 PNG
  const buf = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
  fs.writeFileSync(out, buf);
  return out;
}

test.describe('open-thread incoming media', () => {
  test('image appears in an already-open chat without leave/reenter', async ({ browser }) => {
    const alice = await login(ALICE.email);
    const bob = await login(BOB.email);

    const api = await apiRequest.newContext({ baseURL: BASE_URL });
    try {
      await api.post('/api/users/like/' + bob.user.id, {
        headers: { Authorization: `Bearer ${alice.token}` },
      });
      await api.post('/api/users/like/' + alice.user.id, {
        headers: { Authorization: `Bearer ${bob.token}` },
      });
    } finally {
      await api.dispose();
    }

    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    await authenticate(ctx, bob);
    const page = await ctx.newPage();

    await page.goto(`/messages/${alice.user.id}`);
    await expect(page.getByTestId('chat-composer')).toBeVisible({ timeout: 15000 });

    const beforeCount = await page.getByTestId('image-permanent').count();

    const sendApi = await apiRequest.newContext({ baseURL: BASE_URL });
    try {
      const png = tinyPngPath();
      const res = await sendApi.post('/api/messages/media', {
        headers: { Authorization: `Bearer ${alice.token}` },
        multipart: {
          media: {
            name: 'shot.png',
            mimeType: 'image/png',
            buffer: fs.readFileSync(png),
          },
          receiver_id: bob.user.id,
          kind: 'image',
        },
      });
      expect(res.ok(), await res.text()).toBeTruthy();
    } finally {
      await sendApi.dispose();
    }

    // Live socket path — should paint without navigating away.
    await expect
      .poll(async () => page.getByTestId('image-permanent').count(), { timeout: 15000 })
      .toBeGreaterThan(beforeCount);

    // Still on the same conversation URL (no leave/reenter).
    await expect(page).toHaveURL(new RegExp(`/messages/${alice.user.id}`));

    await ctx.close();
  });

  test('open-thread poll paints media without socket hint or leave/reenter', async ({ browser }) => {
    const alice = await login(ALICE.email);
    const bob = await login(BOB.email);

    const api = await apiRequest.newContext({ baseURL: BASE_URL });
    try {
      await api.post('/api/users/like/' + bob.user.id, {
        headers: { Authorization: `Bearer ${alice.token}` },
      });
      await api.post('/api/users/like/' + alice.user.id, {
        headers: { Authorization: `Bearer ${bob.token}` },
      });
    } finally {
      await api.dispose();
    }

    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    await authenticate(ctx, bob);
    const page = await ctx.newPage();

    // Kill websocket so only the open-thread poll / HTTP path can paint.
    await page.route('**/socket.io/**', (route) => route.abort());

    await page.goto(`/messages/${alice.user.id}`);
    await expect(page.getByTestId('chat-composer')).toBeVisible({ timeout: 15000 });
    const beforeCount = await page.getByTestId('image-permanent').count();

    const sendApi = await apiRequest.newContext({ baseURL: BASE_URL });
    try {
      const png = tinyPngPath();
      const res = await sendApi.post('/api/messages/media', {
        headers: { Authorization: `Bearer ${alice.token}` },
        multipart: {
          media: {
            name: 'poll.png',
            mimeType: 'image/png',
            buffer: fs.readFileSync(png),
          },
          receiver_id: bob.user.id,
          kind: 'image',
        },
      });
      expect(res.ok(), await res.text()).toBeTruthy();
    } finally {
      await sendApi.dispose();
    }

    // Poll interval is 2.5s — wait without leave/reenter and without SW hint.
    await expect
      .poll(async () => page.getByTestId('image-permanent').count(), { timeout: 12000 })
      .toBeGreaterThan(beforeCount);
    await expect(page).toHaveURL(new RegExp(`/messages/${alice.user.id}`));

    await ctx.close();
  });

  test('push chat hint refreshes open thread without navigation', async ({ browser }) => {
    const alice = await login(ALICE.email);
    const bob = await login(BOB.email);

    const api = await apiRequest.newContext({ baseURL: BASE_URL });
    try {
      await api.post('/api/users/like/' + bob.user.id, {
        headers: { Authorization: `Bearer ${alice.token}` },
      });
      await api.post('/api/users/like/' + alice.user.id, {
        headers: { Authorization: `Bearer ${bob.token}` },
      });
    } finally {
      await api.dispose();
    }

    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    await authenticate(ctx, bob);
    const page = await ctx.newPage();

    await page.goto(`/messages/${alice.user.id}`);
    await expect(page.getByTestId('chat-composer')).toBeVisible({ timeout: 15000 });
    const beforeCount = await page.getByTestId('image-permanent').count();

    const sendApi = await apiRequest.newContext({ baseURL: BASE_URL });
    try {
      const png = tinyPngPath();
      const res = await sendApi.post('/api/messages/media', {
        headers: { Authorization: `Bearer ${alice.token}` },
        multipart: {
          media: {
            name: 'hint.png',
            mimeType: 'image/png',
            buffer: fs.readFileSync(png),
          },
          receiver_id: bob.user.id,
          kind: 'image',
        },
      });
      expect(res.ok(), await res.text()).toBeTruthy();
    } finally {
      await sendApi.dispose();
    }

    await page.evaluate((peerId) => {
      navigator.serviceWorker.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: 'MENRUSH_CHAT_HINT',
            url: `/messages/${peerId}`,
            otherId: peerId,
          },
        }),
      );
    }, alice.user.id);

    await expect
      .poll(async () => page.getByTestId('image-permanent').count(), { timeout: 15000 })
      .toBeGreaterThan(beforeCount);
    await expect(page).toHaveURL(new RegExp(`/messages/${alice.user.id}`));

    await ctx.close();
  });
});
