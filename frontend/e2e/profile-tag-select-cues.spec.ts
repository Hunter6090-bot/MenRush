/**
 * One-off smoke for profile tag select cues (mocked API — no backend required).
 * Run: npx playwright test e2e/profile-tag-select-cues.spec.ts
 */
import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';

/** Mirrors PROFILE_TAG_GROUPS / DISCOVERY_FILTER_CATEGORIES — do not invent new rules. */
const TAG_GROUP_CUES: Array<{ label: string; singleSelect: boolean }> = [
  { label: 'Looking for', singleSelect: true },
  { label: 'Position', singleSelect: false },
  { label: 'Tribe', singleSelect: false },
  { label: 'Body', singleSelect: false },
  { label: 'Ethnicity', singleSelect: true },
  { label: 'Vibe', singleSelect: false },
  { label: 'Scene', singleSelect: false },
  { label: 'Connection', singleSelect: false },
];

const PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

const FAKE_TOKEN = 'e2e-test-token-payload.e2e-test-token-signature';

const FAKE_USER = {
  id: 'a1000001-0001-4001-8001-000000000001',
  email: 'alice@example.com',
  name: 'Alice',
  age: 28,
  date_of_birth: '1998-01-15',
  show_age: true,
  is_verified: true,
  verification_status: 'verified',
  authenticity_status: 'verified',
  photo_url: '/uploads/profiles/alice.jpg',
  bio: 'Looking for real men nearby tonight and always.',
  headline: 'In Shoreditch',
  looking_for: 'Chat',
  interests: ['Top', 'Twink'],
  height_cm: 178,
  weight_kg: 75,
  relationship_status: 'Single',
  hosting_status: 'Hosting',
  sexual_health_status: null,
  on_prep: null,
  last_tested_at: null,
  lat: 51.5074,
  lng: -0.1278,
  online: true,
  is_visible: true,
  is_premium: false,
  mood: null,
  is_ghost: false,
};

async function stubProfileShell(page: Page) {
  let lastSaveBody: Record<string, unknown> | null = null;

  await page.addInitScript(
    ({ token, user }) => {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem(
        'menrush_last_location',
        JSON.stringify({ lat: user.lat, lng: user.lng, at: Date.now() }),
      );
    },
    { token: FAKE_TOKEN, user: FAKE_USER },
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

    const method = route.request().method();

    if (pathname === '/api/users/me' && method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(FAKE_USER),
      });
    }
    if (pathname === '/api/users/profile' && method === 'POST') {
      lastSaveBody = route.request().postDataJSON() as Record<string, unknown>;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...FAKE_USER, ...lastSaveBody }),
      });
    }
    if (pathname.startsWith('/api/auth/')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(FAKE_USER),
      });
    }
    if (pathname.startsWith('/api/profile-meta/mood')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ mood: null, mood_set_at: null }),
      });
    }
    if (pathname.startsWith('/api/users/profile-views') || pathname.includes('viewers')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ viewers: [], total: 0, has_more: false, hidden_count: 0 }),
      });
    }
    if (pathname.startsWith('/api/notifications')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    if (pathname.startsWith('/uploads/')) {
      return route.fulfill({ status: 200, contentType: 'image/png', body: PNG_BUFFER });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  return {
    getLastSave: () => lastSaveBody,
  };
}

test.describe('Profile tag select cues', () => {
  test('shows Pick one / Pick several and keeps select+save behavior', async ({ page }, testInfo) => {
    const stub = await stubProfileShell(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/profile');
    await expect(page.getByRole('button', { name: 'Save Changes' })).toBeVisible({ timeout: 15000 });

    // Dedicated Looking for field
    const lookingLabel = page.locator('label').filter({ hasText: 'Looking for' });
    await expect(lookingLabel.getByTestId('profile-tag-select-cue')).toHaveText('Pick one');

    await expect(
      page.locator('label').filter({ hasText: 'Relationship' }).getByTestId('profile-tag-select-cue'),
    ).toHaveText('Pick one');
    await expect(
      page.locator('label').filter({ hasText: 'Hosting' }).getByTestId('profile-tag-select-cue'),
    ).toHaveText('Pick one');
    await expect(
      page.locator('p').filter({ hasText: 'Sexual health' }).getByTestId('profile-tag-select-cue'),
    ).toHaveText('Pick one');

    for (const group of TAG_GROUP_CUES) {
      const cue = group.singleSelect ? 'Pick one' : 'Pick several';
      await expect(
        page.getByTestId(`profile-tag-group-${group.label}`).getByTestId('profile-tag-select-cue'),
      ).toHaveText(cue);
    }

    // Ethnicity is single-select among interests
    await page.getByRole('button', { name: 'Asian', exact: true }).click();
    await page.getByRole('button', { name: 'Black', exact: true }).click();
    // Tribe is multi
    await page.getByRole('button', { name: 'Bear', exact: true }).click();

    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect.poll(() => stub.getLastSave()).not.toBeNull();
    const saved = stub.getLastSave()!;
    const interests = saved.interests as string[];
    expect(interests).toContain('Black');
    expect(interests).not.toContain('Asian');
    expect(interests).toContain('Bear');
    expect(interests).toContain('Top');

    const desktopShot = path.join(testInfo.outputDir, 'profile-cues-desktop.png');
    await page.getByTestId('profile-tag-group-Ethnicity').scrollIntoViewIfNeeded();
    await page.screenshot({ path: desktopShot, fullPage: false });
    await testInfo.attach('desktop-cues', { path: desktopShot, contentType: 'image/png' });

    // Phone viewport
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/profile');
    await expect(page.getByRole('button', { name: 'Save Changes' })).toBeVisible({ timeout: 15000 });
    const ethnicityGroup = page.getByTestId('profile-tag-group-Ethnicity');
    await ethnicityGroup.scrollIntoViewIfNeeded();
    await expect(ethnicityGroup.getByTestId('profile-tag-select-cue')).toHaveText('Pick one');
    const tribeGroup = page.getByTestId('profile-tag-group-Tribe');
    await tribeGroup.scrollIntoViewIfNeeded();
    await expect(tribeGroup.getByTestId('profile-tag-select-cue')).toHaveText('Pick several');

    const phoneShot = path.join(testInfo.outputDir, 'profile-cues-phone.png');
    await page.screenshot({ path: phoneShot, fullPage: false });
    await testInfo.attach('phone-cues', { path: phoneShot, contentType: 'image/png' });
  });
});
