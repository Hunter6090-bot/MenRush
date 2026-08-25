import { expect, test, type Page } from '@playwright/test';

const PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

const FAKE_TOKEN = 'e2e-test-token-payload.e2e-test-token-signature';

const FAKE_USER = {
  id: 'a1000001-0001-4001-8001-000000000001',
  email: 'alice@example.com',
  name: 'Alice',
  is_verified: true,
  verification_status: 'verified',
  photo_url: '/uploads/profiles/alice.jpg',
  bio: 'Looking for real men nearby tonight and always.',
  looking_for: 'Right now',
  interests: ['Gym', 'Bars', 'Chat'],
  lat: 51.5074,
  lng: -0.1278,
};

type EventFixture = Record<string, unknown>;

async function stubAuthedShell(
  page: Page,
  opts?: { events?: EventFixture[]; onMediaPost?: () => void },
) {
  const eventsRef = {
    current: opts?.events ?? [
      {
        id: 'ev-no-ticket',
        name: 'No Ticket Night',
        description: 'Local night',
        avatar_url: null,
        created_by: FAKE_USER.id,
        starts_at: new Date().toISOString(),
        ends_at: null,
        venue_name: 'Test Bar',
        lat: 51.5,
        lng: -0.12,
        member_count: 3,
        distance_m: 400,
        is_live: true,
      },
    ],
  };

  await page.addInitScript(
    ({ token, user, lat, lng }) => {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem(
        'menrush_last_location',
        JSON.stringify({ lat, lng, at: Date.now() }),
      );
    },
    { token: FAKE_TOKEN, user: FAKE_USER, lat: 51.5074, lng: -0.1278 },
  );

  await page.route('**/*', async (route) => {
    let pathname = '';
    try {
      pathname = new URL(route.request().url()).pathname;
    } catch {
      return route.continue();
    }
    if (!pathname.startsWith('/api/')) {
      return route.continue();
    }

    const url = route.request().url();
    const method = route.request().method();

    if (pathname === '/api/users/me' || pathname.startsWith('/api/auth/')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(FAKE_USER),
      });
    }
    if (pathname.startsWith('/api/notifications')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    if (pathname.startsWith('/api/users/nearby') || pathname.startsWith('/api/users/search')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    if (pathname.startsWith('/api/likes')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    if (
      pathname.startsWith('/api/messages/conversations') ||
      pathname.startsWith('/api/users/matches')
    ) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    if (pathname.startsWith('/api/events/nearby')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(eventsRef.current),
      });
    }
    if (pathname.includes('/messages/media') && method === 'POST') {
      opts?.onMediaPost?.();
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'msg-media-1',
          room_id: 'room-1',
          sender_id: FAKE_USER.id,
          sender_name: FAKE_USER.name,
          message: '[[mr-img:/uploads/rooms/room-test.png]]',
          created_at: new Date().toISOString(),
        }),
      });
    }
    if (pathname.match(/^\/api\/rooms\/[^/]+\/messages$/) && method === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    if (pathname.match(/^\/api\/rooms\/[^/]+\/members$/)) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: FAKE_USER.id, name: FAKE_USER.name, role: 'owner' }]),
      });
    }
    if (pathname.match(/^\/api\/rooms\/[^/]+$/) && method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'room-1',
          name: 'Test Room',
          description: 'Fixture room',
          member_count: 1,
          user_role: 'owner',
          is_location_based: true,
        }),
      });
    }
    if (pathname === '/api/rooms' && method === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }

    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  return eventsRef;
}

test.describe('dead pressables', () => {
  test("Events Tickets is absent without a URL and Who's going is the CTA", async ({ page }) => {
    await stubAuthedShell(page);
    await page.goto('/events');
    await expect(page.getByText('No Ticket Night')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('event-tickets')).toHaveCount(0);
    await expect(page.getByTestId('event-whos-going')).toBeVisible();
  });

  test('Events Tickets opens external URL when ticket_url is present', async ({ page }) => {
    await stubAuthedShell(page, {
      events: [
        {
          id: 'ev-ticket',
          name: 'Ticketed Night',
          description: 'Has tickets',
          avatar_url: null,
          created_by: FAKE_USER.id,
          starts_at: new Date().toISOString(),
          ends_at: null,
          venue_name: 'Club',
          lat: 51.5,
          lng: -0.12,
          member_count: 8,
          distance_m: 200,
          is_live: true,
          ticket_url: 'https://example.com/tickets/123',
        },
      ],
    });

    await page.goto('/events');
    await expect(page.getByText('Ticketed Night')).toBeVisible({ timeout: 15_000 });
    const tickets = page.getByTestId('event-tickets');
    await expect(tickets).toBeVisible();
    await expect(tickets).toHaveAttribute('href', 'https://example.com/tickets/123');
    await expect(tickets).toHaveAttribute('target', '_blank');
  });

  test('desktop search label says Search profiles', async ({ page }) => {
    await stubAuthedShell(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/events');
    await expect(page.getByRole('button', { name: /Search profiles/i }).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText('Search events')).toHaveCount(0);
    await expect(page.getByText('Search matches')).toHaveCount(0);
  });

  test('RoomChat attach sends media; emoji inserts into composer', async ({ page }) => {
    let mediaPosted = false;
    await stubAuthedShell(page, { onMediaPost: () => { mediaPosted = true; } });

    // Force mobile layout so RoomsRoute mounts RoomChat directly (not MessagingHub).
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/rooms/room-1');
    await expect(page.getByText('Test Room')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: /Show chat|Hide chat/i }).click();
    await expect(page.getByPlaceholder('Message the room…')).toBeVisible();

    const fileInput = page.locator('input[type="file"][aria-label="Choose from gallery"]');
    await expect(fileInput).toHaveCount(1);

    await page.getByRole('button', { name: 'Attach file' }).click();
    await fileInput.setInputFiles({
      name: 'photo.png',
      mimeType: 'image/png',
      buffer: PNG_BUFFER,
    });

    await expect.poll(() => mediaPosted).toBeTruthy();
    await expect(page.getByTestId('room-image-message')).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Emoji' }).click();
    await expect(page.getByTestId('room-emoji-picker')).toBeVisible();
    await page.getByRole('option', { name: 'Insert 🔥' }).click();
    await expect(page.getByPlaceholder('Message the room…')).toHaveValue('🔥');
  });

  test('calendar monday-first padding matches Date#getDay()', async () => {
    const mondayFirstLeadingBlanks = (sundayIndexedWeekday: number) =>
      ((((sundayIndexedWeekday % 7) + 7) % 7) + 6) % 7;

    expect(mondayFirstLeadingBlanks(0)).toBe(6);
    expect(mondayFirstLeadingBlanks(1)).toBe(0);
    expect(mondayFirstLeadingBlanks(2)).toBe(1);
    expect(mondayFirstLeadingBlanks(6)).toBe(5);
  });
});
