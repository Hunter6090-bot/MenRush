/**
 * Chat attach from My Photos — mocked API e2e.
 * Default grid: public + view_once. Private only after open + tap.
 * Send uses /messages/media/from-album and does not mutate album rows.
 */
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const OWNER = {
  token: 'e2echatattachpayload.e2echatattachsignature0',
  user: {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'attach@test.menrush',
    name: 'Attach Owner',
    is_verified: true,
    verification_status: 'approved',
  },
};

const PEER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const ALBUM_ID = '22222222-2222-2222-2222-222222222222';
const TRIPS_ID = '66666666-6666-6666-6666-666666666666';
const PUBLIC_ID = '33333333-3333-3333-3333-333333333333';
const VIEW_ONCE_ID = '44444444-4444-4444-4444-444444444444';
const PRIVATE_ID = '55555555-5555-5555-5555-555555555555';

const ARTIFACTS = '/opt/cursor/artifacts';
const TILE_JPEG = fs.readFileSync(path.join(__dirname, 'fixtures/my-photos-tile.jpg'));

function libraryPayload() {
  const now = new Date().toISOString();
  return {
    public_photos: [
      {
        id: PUBLIC_ID,
        album_id: TRIPS_ID,
        photo_url: '/api/albums/media/public.jpg',
        visibility: 'public',
        position: 0,
        created_at: now,
        media_clear: true,
      },
    ],
    view_once_photos: [
      {
        id: VIEW_ONCE_ID,
        album_id: ALBUM_ID,
        photo_url: '/api/albums/media/viewonce.jpg',
        visibility: 'view_once',
        position: 1,
        created_at: now,
        media_clear: false,
      },
    ],
    private_photos: [
      {
        id: PRIVATE_ID,
        album_id: ALBUM_ID,
        photo_url: '/api/albums/media/private.jpg',
        visibility: 'private',
        position: 2,
        created_at: now,
        media_clear: true,
      },
    ],
    private_album: {
      id: ALBUM_ID,
      user_id: OWNER.user.id,
      name: 'Private album',
      description: null,
      is_locked: true,
      cover_url: null,
      photo_count: 2,
      created_at: now,
      updated_at: now,
    },
    viewers: [],
    photo_total: 3,
    free_cap: 6,
    albums: [
      {
        id: TRIPS_ID,
        user_id: OWNER.user.id,
        name: 'Trips',
        description: null,
        is_locked: false,
        cover_url: null,
        photo_count: 1,
        created_at: now,
        updated_at: now,
      },
      {
        id: ALBUM_ID,
        user_id: OWNER.user.id,
        name: 'Private album',
        description: null,
        is_locked: true,
        cover_url: null,
        photo_count: 2,
        created_at: now,
        updated_at: now,
      },
    ],
  };
}

async function authenticate(context: BrowserContext) {
  await context.addInitScript(({ token, user }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('menrush_install_prompt_dismissed', '1');
  }, OWNER);
}

async function mockApis(
  page: Page,
  state: {
    albumMutations: string[];
    sentPhotoIds: string[];
  },
) {
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

      if (p.includes('/albums/media/')) {
        return route.fulfill({
          status: 200,
          contentType: 'image/jpeg',
          body: TILE_JPEG,
        });
      }

      if (method === 'GET' && p.endsWith('/albums/mine')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(libraryPayload()),
        });
      }

      if (method === 'POST' && p.endsWith('/messages/media/from-album')) {
        const body = req.postDataJSON() as {
          photo_id?: string;
          receiver_id?: string;
          disappearing?: boolean;
          max_views?: number;
        };
        state.sentPhotoIds.push(body.photo_id || '');
        const disappearing = body.disappearing === true;
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: `msg-${state.sentPhotoIds.length}`,
            sender_id: OWNER.user.id,
            receiver_id: body.receiver_id || PEER_ID,
            message: '📷 Photo',
            created_at: new Date().toISOString(),
            media_type: 'image',
            media_url: `/api/messages/msg-${state.sentPhotoIds.length}/media`,
            is_disappearing: disappearing,
            max_views: disappearing ? body.max_views ?? 1 : null,
            view_count: 0,
            remaining_views: disappearing ? body.max_views ?? 1 : null,
            media_clear: true,
            sender_name: OWNER.user.name,
          }),
        });
      }

      if (method === 'GET' && /\/messages\/[^/]+\/media/.test(p)) {
        return route.fulfill({
          status: 200,
          contentType: 'image/jpeg',
          body: TILE_JPEG,
        });
      }

      // Track any album mutation attempts — attach must never hit these.
      if (
        (method === 'DELETE' || method === 'PUT' || method === 'PATCH') &&
        p.includes('/albums')
      ) {
        state.albumMutations.push(`${method} ${p}`);
      }
      if (method === 'POST' && /\/albums\/[^/]+\/upload/.test(p)) {
        state.albumMutations.push(`${method} ${p}`);
      }

      if (method === 'GET' && p.includes(`/messages/conversation/${PEER_ID}`)) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      }

      if (method === 'GET' && (p.endsWith('/messages/conversations') || p.endsWith('/messages/unread'))) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(p.endsWith('/unread') ? { total: 0, bySender: {} } : []),
        });
      }

      if (method === 'GET' && p.includes('/users/')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: PEER_ID,
            name: 'Peer',
            photo_url: null,
            is_online: true,
            is_verified: true,
          }),
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

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}),
      });
    },
  );
}

test.describe('Chat attach My Photos', () => {
  test('attach sheet lists albums + public/view-once; private only after open; send one private', async ({
    browser,
  }) => {
    fs.mkdirSync(ARTIFACTS, { recursive: true });
    const state = { albumMutations: [] as string[], sentPhotoIds: [] as string[] };
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    await authenticate(ctx);
    const page = await ctx.newPage();
    await mockApis(page, state);

    await page.goto(`/messages/${PEER_ID}`);
    await expect(page.getByTestId('chat-attach-button')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('chat-attach-button').click();

    await expect(page.getByTestId('chat-attach-library-sheet')).toBeVisible();
    await expect(page.getByTestId('chat-attach-default-grid')).toBeVisible();

    // Default grid: public + view_once tiles present; private tiles absent.
    await expect(page.getByTestId('chat-attach-photo-public')).toHaveCount(1);
    await expect(page.getByTestId('chat-attach-photo-view_once')).toHaveCount(1);
    await expect(page.getByTestId('chat-attach-photo-private')).toHaveCount(0);
    await expect(page.getByText('Trips')).toBeVisible();

    await page.screenshot({
      path: path.join(ARTIFACTS, 'chat-attach-sheet-default.png'),
      fullPage: false,
    });

    // Open private section — only then can a private photo be picked.
    await page.getByTestId('chat-attach-private-toggle').click();
    await expect(page.getByTestId('chat-attach-private-grid')).toBeVisible();
    await expect(page.getByTestId('chat-attach-photo-private')).toHaveCount(1);

    await page.locator(`[data-photo-id="${PRIVATE_ID}"]`).click();
    await expect(page.locator(`[data-photo-id="${PRIVATE_ID}"]`)).toHaveAttribute(
      'data-selected',
      '1',
    );

    // Public also selectable in same session — but confirm only private for this assert.
    await page.locator(`[data-photo-id="${PRIVATE_ID}"]`).click(); // deselect
    await page.locator(`[data-photo-id="${PRIVATE_ID}"]`).click(); // select again
    await page.getByTestId('chat-attach-confirm').click();

    await expect(page.getByTestId('image-composer')).toBeVisible();
    await expect(page.getByTestId('chat-attach-library-sheet')).toHaveCount(0);

    await expect(page.getByTestId('image-composer-send')).toHaveText('Send', { timeout: 10_000 });
    await page.getByTestId('image-composer-send').click();

    await expect.poll(() => state.sentPhotoIds).toEqual([PRIVATE_ID]);
    expect(state.albumMutations).toEqual([]);

    await expect(page.getByTestId('image-composer')).toHaveCount(0, { timeout: 10_000 });
    await expect(page.getByTestId('image-sent-status')).toBeVisible();

    await page.screenshot({
      path: path.join(ARTIFACTS, 'chat-attach-sent-library-photo.png'),
      fullPage: false,
    });

    await ctx.close();
  });

  test('default attach does not dump private album; public attach works', async ({ browser }) => {
    const state = { albumMutations: [] as string[], sentPhotoIds: [] as string[] };
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await authenticate(ctx);
    const page = await ctx.newPage();
    await mockApis(page, state);

    await page.goto(`/messages/${PEER_ID}`);
    await page.getByTestId('chat-attach-button').click();
    await expect(page.getByTestId('chat-attach-library-sheet')).toBeVisible();

    // Private grid must stay hidden until toggle.
    await expect(page.getByTestId('chat-attach-private-grid')).toHaveCount(0);
    await page.locator(`[data-photo-id="${PUBLIC_ID}"]`).click();
    await page.getByTestId('chat-attach-confirm').click();

    await expect(page.getByTestId('image-composer')).toBeVisible();
    await page.getByTestId('rule-permanent').click();
    await page.getByTestId('image-composer-send').click();

    await expect.poll(() => state.sentPhotoIds).toEqual([PUBLIC_ID]);
    expect(state.albumMutations).toEqual([]);
    await expect(page.getByTestId('image-permanent')).toBeVisible({ timeout: 10_000 });
    await ctx.close();
  });
});
