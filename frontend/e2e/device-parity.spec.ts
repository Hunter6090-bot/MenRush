import { expect, test, type Page } from '@playwright/test';

const viewports = [
  { name: 'small-phone', width: 320, height: 568 },
  { name: 'android-phone', width: 360, height: 800 },
  { name: 'phone-landscape', width: 844, height: 390 },
  { name: 'tablet-portrait', width: 768, height: 1024 },
  { name: 'tablet-landscape', width: 1024, height: 768 },
  { name: 'desktop', width: 1440, height: 900 },
];

async function assertFits(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
}

for (const viewport of viewports) for (const theme of ['light', 'dark'] as const) {
  test.describe(`${viewport.name} ${theme}`, () => {
    test.use({ viewport, colorScheme: theme, hasTouch: viewport.width < 1440 });
    test.beforeEach(async ({ context }) => {
      await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.hostname !== '127.0.0.1') return route.abort();
        if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io')) return route.fulfill({ status: 200, json: {} });
        if (url.pathname === '/app-version.json') return route.fulfill({ json: { buildId: 'fixture-old' } });
        return route.continue();
      });
    });

    test('map controls, overlays and legacy preview stay usable', async ({ page }) => {
      await page.goto(`/e2e/fixtures/device-parity.html?theme=${theme}`);
      await expect(page.getByTestId('map-expand-toggle')).toBeVisible();
      for (const id of ['layer-toggle-people', 'layer-toggle-hotspots', 'map-expand-toggle', 'map-hide']) {
        const box = await page.getByTestId(id).boundingBox();
        expect(box).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
        expect(box!.width).toBeGreaterThanOrEqual(44);
        expect(box!.height).toBeGreaterThanOrEqual(44);
      }
      await page.getByTestId('layer-toggle-hotspots').click();
      const search = await page.getByTestId('cruising-search-bar').boundingBox();
      const helper = await page.getByTestId('hotspots-map-helper').boundingBox();
      expect(helper!.y).toBeGreaterThanOrEqual(search!.y + search!.height);
      await page.getByTestId('cruising-search-bar').click();
      await expect(page.getByText('Search requested')).toBeVisible();
      if (viewport.width < 1440) await page.getByTestId('map-expand-toggle').tap();
      else await page.getByTestId('map-expand-toggle').click();
      await expect(page.getByRole('button', { name: 'Shrink map' })).toBeVisible();
      await page.getByRole('button', { name: 'Shrink map' }).focus();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('button', { name: 'Expand map' })).toBeVisible();
      await assertFits(page);
      await page.getByRole('button', { name: 'Open legacy profile' }).click();
      await expect(page.getByRole('heading', { name: /COSTAMAN1965/ })).toBeVisible();
      await expect(page.getByTestId('drawer-cover-enlarge')).toHaveCount(0);
      await expect(page.locator('[data-testid="profile-sheet-hero"] img[src*="/avatars/"]')).toHaveCount(0);
      await expect(page.getByTestId('faded-brand-face')).toHaveCount(2);
      await page.getByRole('button', { name: 'Close', exact: true }).click();
      await assertFits(page);
    });

    test('public forms support focus, scroll and retained values on resize', async ({ page }) => {
      for (const path of ['/login', '/register', '/forgot-password']) {
        await page.goto(path);
        const input = page.locator('input[type="email"]').first();
        await expect(input).toBeVisible();
        await input.fill('device-test@example.invalid');
        expect(await input.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
        await input.focus();
        await page.keyboard.press('Tab');
        await assertFits(page);
        // A shorter viewport exercises layout under reduced space. It is not an OS keyboard.
        await page.setViewportSize({ width: viewport.width, height: Math.max(320, Math.floor(viewport.height * .65)) });
        await expect(input).toHaveValue('device-test@example.invalid');
        await page.locator('button[type="submit"]').last().scrollIntoViewIfNeeded();
        await expect(page.locator('button[type="submit"]').last()).toBeInViewport();
        await assertFits(page);
        await page.setViewportSize(viewport);
      }
    });
  });
}

test('update notice never reloads a draft without confirmation', async ({ page, context }) => {
  await context.route('**/app-version.json*', route => route.fulfill({ json: { buildId: 'fixture-new' } }));
  await page.goto('/e2e/fixtures/device-parity.html');
  await page.getByRole('textbox', { name: 'Draft' }).fill('Unsaved draft');
  await expect(page.getByRole('complementary', { name: 'App update' })).toBeVisible();
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Draft' })).toHaveValue('Unsaved draft');
  await page.getByRole('button', { name: 'Later', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'App update' })).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Draft' })).toHaveValue('Unsaved draft');
});

test('actual Discover shell expands without location and supports keyboard/tap/swipe', async ({ page, context }, testInfo) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const user = { id: 'parity-user', name: 'Parity', email: 'parity@example.invalid', age: 40, photo_url: '/avatars/generic/09.svg', bio: 'A complete synthetic profile for local testing.', looking_for: 'Chat', interests: ['Bear', 'Music', 'Travel'], is_verified: true };
  await context.addInitScript(user => {
    localStorage.setItem('token', 'fixture-token.fixture-signature');
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('menrush_nearby_view', 'map');
    localStorage.setItem('menrush_nearby_map_panel', 'default');
    localStorage.setItem('menrush_install_prompt_dismissed', '1');
    localStorage.setItem('menrush_push_banner_snooze_until', String(Date.now() + 86400000));
    Object.defineProperty(navigator, 'geolocation', { value: {
      getCurrentPosition: (_success: unknown, error: (value: unknown) => void) => error({ code: 1, message: 'Permission denied' }),
      watchPosition: () => 0, clearWatch: () => {},
    } });
  }, user);
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.hostname !== '127.0.0.1') return route.abort();
    if (url.pathname === '/api/auth/adult-assurance/account') return route.fulfill({ json: { assured: true, available: true } });
    if (url.pathname === '/api/users/me') return route.fulfill({ json: user });
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io')) return route.fulfill({ json: { matches: [], users: [], messages: [], notifications: [], unread_count: 0, spots: [] } });
    return route.continue();
  });
  await page.routeWebSocket('**/socket.io/**', socket => socket.close());
  await page.goto('/discover');
  await expect(page.getByTestId('map-expand-toggle')).toBeVisible();
  await page.getByTestId('map-expand-toggle').click({ trial: true });
  await page.screenshot({ path: testInfo.outputPath('discover-location-denied.png') });
  await page.getByTestId('map-expand-toggle').click();
  await expect(page.getByTestId('discover-map-panel')).toHaveAttribute('data-map-mode', 'expanded');
  await page.getByRole('button', { name: 'Shrink map' }).click();
  const handle = page.getByTestId('map-drag-handle');
  await handle.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('discover-map-panel')).toHaveAttribute('data-map-mode', 'expanded');
  await page.getByRole('button', { name: 'Shrink map' }).click();
  await handle.click();
  await expect(page.getByTestId('discover-map-panel')).toHaveAttribute('data-map-mode', 'expanded');
  await page.getByRole('button', { name: 'Shrink map' }).click();
  const box = await handle.boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2, box!.y - 70, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByTestId('discover-map-panel')).toHaveAttribute('data-map-mode', 'hidden');
  await assertFits(page);
});

test('existing session with cached age and ID flags is gated when server has no trusted evidence', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await context.addInitScript(() => {
    localStorage.setItem('token', 'local-test.cached-token');
    localStorage.setItem('user', JSON.stringify({ id: 'fixture-user', name: 'Fixture', is_verified: true, verified_age_18_plus: true }));
  });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.hostname !== '127.0.0.1') return route.abort();
    if (url.pathname === '/api/auth/adult-assurance/account') return route.fulfill({ json: { assured: false, available: false } });
    if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 403, json: { error: 'adult_assurance_required' } });
    if (url.pathname.startsWith('/socket.io')) return route.abort();
    return route.continue();
  });
  await page.routeWebSocket('**/socket.io/**', socket => socket.close());
  await page.goto('/discover');
  await expect(page).toHaveURL(/\/age-assurance$/);
  await expect(page.getByRole('heading', { name: 'Confirm you’re 18+' })).toBeVisible();
  await expect(page.getByText('The required age check is currently unavailable. Please try again later.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
  await expect(page.getByTestId('map-expand-toggle')).toHaveCount(0);
  await assertFits(page);
});
