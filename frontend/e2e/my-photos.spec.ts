/**
 * My Photos — four album states + viewers-only revoke (mocked API).
 * Does not require a live backend DB. DISCREET_MEDIA_BLUR is not flipped.
 */
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const OWNER = {
  // Must look like custom JWT (payload.signature) or client clears the session.
  token: 'e2emyphotospayload.e2emyphotossignature00',
  user: {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'photos@test.menrush',
    name: 'Photos Owner',
    is_verified: true,
    verification_status: 'approved',
  },
};

const ALBUM_ID = '22222222-2222-2222-2222-222222222222';
const PUBLIC_ID = '33333333-3333-3333-3333-333333333333';
const VIEW_ONCE_ID = '44444444-4444-4444-4444-444444444444';
const PRIVATE_ID = '55555555-5555-5555-5555-555555555555';

// Minimal 1x1 JPEG
const TINY_JPEG =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k=';

const ARTIFACTS = '/opt/cursor/artifacts';
const TILE_JPEG = fs.readFileSync(path.join(__dirname, 'fixtures/my-photos-tile.jpg'));

function libraryPayload(viewers: Array<{ id: string; name: string; photo_url: string | null }>) {
  const now = new Date().toISOString();
  return {
    public_photos: [
      {
        id: PUBLIC_ID,
        album_id: ALBUM_ID,
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
      photo_count: 3,
      created_at: now,
      updated_at: now,
      media_clear: true,
    },
    viewers,
    photo_total: 3,
    free_cap: 6,
    albums: [],
  };
}

async function authenticate(context: BrowserContext) {
  await context.addInitScript(({ token, user }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('menrush_install_prompt_dismissed', '1');
  }, OWNER);
}

async function mockApis(page: Page, state: { viewers: typeof VIEWERS; revoked: boolean }) {
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
        body: JSON.stringify(libraryPayload(state.viewers)),
      });
    }

    if (method === 'DELETE' && /\/albums\/[^/]+\/grants$/.test(p)) {
      const removed = state.viewers.length;
      state.viewers = [];
      state.revoked = true;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ revoked: true, viewers_removed: removed, photo_count: 3 }),
      });
    }

    if (method === 'POST' && /\/albums\/photos\/[^/]+\/open$/.test(p)) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ opened: true, media_clear: true }),
      });
    }

    if (method === 'GET' && (p.endsWith('/users/me') || p.includes('/users/me?'))) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...OWNER.user,
          photo_url: '/api/albums/media/public.jpg',
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

    // Default: empty ok so chrome does not explode
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    });
  });
}

const VIEWERS = [
  {
    id: '66666666-6666-6666-6666-666666666661',
    name: 'Alex',
    photo_url: null,
    granted_at: new Date().toISOString(),
  },
  {
    id: '66666666-6666-6666-6666-666666666662',
    name: 'Sam',
    photo_url: null,
    granted_at: new Date().toISOString(),
  },
  {
    id: '66666666-6666-6666-6666-666666666663',
    name: 'Jordan',
    photo_url: null,
    granted_at: new Date().toISOString(),
  },
];

test.describe('My Photos four album states', () => {
  test.describe.configure({ mode: 'serial' });

  test('public / view once blur / private album / add + revoke viewers only', async ({
    browser,
  }, testInfo) => {
    // Desktop project only — one artifact set.
    test.skip(testInfo.project.name !== 'desktop-chromium', 'one project');

    const state = { viewers: [...VIEWERS], revoked: false };
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    await authenticate(ctx);
    const page = await ctx.newPage();
    await mockApis(page, state);

    page.on('dialog', (d) => d.accept());

    await page.goto('/albums');
    await expect(page.getByTestId('my-photos-page')).toBeVisible();
    await expect(page.getByRole('heading', { name: /my photos/i })).toBeVisible();
    await expect(page.getByText('You decide who sees what.')).toBeVisible();

    await expect(page.getByTestId('my-photos-tile-public')).toBeVisible();
    await expect(page.getByTestId('my-photos-tile-view_once')).toHaveAttribute('data-blurred', '1');
    await expect(page.getByTestId('view-once-blur')).toBeVisible();
    await expect(page.getByTestId('my-photos-private-album')).toContainText(/Private album · 1/i);
    await expect(page.getByTestId('my-photos-add')).toBeVisible();

    await expect(page.getByTestId('viewer-count')).toHaveText(/3 men can view/i);
    await expect(page.getByTestId('revoke-all-btn')).toBeEnabled();

    // Footer must not claim a wipe
    await expect(page.getByText(/Revoking removes viewers only/i)).toBeVisible();
    await expect(page.getByText(/wipes them from every device/i)).toHaveCount(0);

    fs.mkdirSync(ARTIFACTS, { recursive: true });
    const beforePath = path.join(ARTIFACTS, 'my_photos_grid_four_states.png');
    await page.screenshot({ path: beforePath, fullPage: true });

    await page.getByTestId('revoke-all-btn').click();
    await expect(page.getByTestId('access-revoked-status')).toBeVisible();
    await expect(page.getByTestId('access-revoked-status')).toHaveText(
      /Access revoked\. 3 viewers removed\./i,
    );
    await expect(page.getByTestId('revoke-all-btn')).toHaveText(/Revoked/i);
    await expect(page.getByTestId('revoke-all-btn')).toBeDisabled();

    // Photos still present after revoke
    await expect(page.getByTestId('my-photos-tile-public')).toBeVisible();
    await expect(page.getByTestId('my-photos-tile-view_once')).toBeVisible();
    await expect(page.getByTestId('my-photos-private-album')).toContainText(/Private album · 1/i);

    const afterPath = path.join(ARTIFACTS, 'my_photos_after_revoke_viewers_only.png');
    await page.screenshot({ path: afterPath, fullPage: true });

    // Open view-once — blur clears
    await page.getByTestId('my-photos-tile-view_once').click();
    await expect(page.getByTestId('my-photos-lightbox')).toBeVisible();
    await page.getByTestId('my-photos-lightbox').click();
    await expect(page.getByTestId('my-photos-tile-view_once')).toHaveAttribute('data-blurred', '0');

    await ctx.close();
  });
});
