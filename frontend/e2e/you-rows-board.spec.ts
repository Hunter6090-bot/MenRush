/**
 * You tab board parity (Claude Design "07 You / settings"): rows only, 390px and 360px,
 * light and dark, no horizontal overflow, Coming soon rows never navigate.
 * Mocked API, no writes.
 */
import { expect, test, type BrowserContext, type Page } from '@playwright/test';

const OWNER = {
  token: 'e2eyourows.e2eyourowssignature0000001',
  user: { id: '7f1c2d3e-0000-4000-8000-00000000a001', email: 'dan@test.menrush', name: 'Dan', is_premium: true },
};

async function authenticate(context: BrowserContext, theme: 'light' | 'dark') {
  await context.addInitScript(({ token, user, theme }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('menrush_install_prompt_dismissed', '1');
    localStorage.setItem('menrush_push_banner_snooze_until', String(Date.now() + 86_400_000));
    localStorage.setItem('menrush_profile_setup_skip', '1');
    localStorage.setItem('menrush_theme', theme);
  }, { ...OWNER, theme });
}

async function mockApis(page: Page, writes: string[], name = 'Dan') {
  await page.route((url) => url.pathname === '/api' || url.pathname.startsWith('/api/'), async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname;
    const json = (body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (req.method() !== 'GET') writes.push(`${req.method()} ${p}`);
    // #357: the install prompt dismissal (set in localStorage above) is already on the
    // server, so the prompt-prefs sync has nothing to push. You itself writes nothing.
    if (p.endsWith('/prompt-prefs')) return json({ never: ['install'] });
    if (p.endsWith('/users/me')) return json({ id: OWNER.user.id, name, age: 36, photo_url: '', bio: 'x', headline: 'x', looking_for: 'Chat', interests: ['Chat'] });
    if (p.endsWith('/albums/mine')) return json({ albums: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], public_photos: [], view_once_photos: [], private_photos: [], private_album: null, viewers: [], photo_total: 0, free_cap: 6 });
    if (p.endsWith('/auth/2fa/status')) return json({ enabled: true, enabledAt: null });
    if (p.endsWith('/profile-meta/map-pin-fuzz')) return json({ map_pin_fuzz_m: 320 });
    if (p.endsWith('/verify/status')) return json({ is_verified: true, status: 'approved' });
    // Edit screen data (same shapes as profile-map-photo-hosting.spec.ts).
    if (p.includes('/users/profile-views')) return json({ viewers: [], total: 0, has_more: false, hidden_count: 0 });
    if (p.includes('/users/me/referrals')) return json({ referral_code: 'DANTEST', verified_count: 0, pending_count: 0, credited_count: 0, unlock_every: 3, progress_to_unlock: 0, unlocks_earned: 0, pending_payout_total: 0, referrals: [] });
    if (p.includes('/profile-meta')) return json({ mood: null, is_ghost: false });
    return json({});
  });
}

for (const theme of ['dark', 'light'] as const) {
  for (const width of [390, 360]) {
    test(`You rows match the board at ${width}px (${theme})`, async ({ browser }, testInfo) => {
      const context = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      await authenticate(context, theme);
      const page = await context.newPage();
      const writes: string[] = [];
      await mockApis(page, writes);
      await page.goto('/profile');
      await expect(page.getByTestId('you-rows-page')).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTestId('you-row-value-albums')).toHaveText('3');
      await expect(page.getByTestId('you-row-value-two-factor')).toHaveText('On');
      await expect(page.getByTestId('you-id-verified')).toBeVisible();
      for (const id of ['quiet-hours', 'merch', 'brands']) {
        await expect(page.getByTestId(`you-row-soon-${id}`)).toHaveText('Coming soon');
      }
      await expect(page.locator('[data-testid="you-rows-page"] form, [data-testid="you-rows-page"] input')).toHaveCount(0);

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
      // Tap targets
      for (const sel of ['you-edit', 'you-sign-out', 'you-row-albums', 'you-row-merch']) {
        const box = await page.getByTestId(sel).boundingBox();
        // Round sub-pixel layout (e.g. 43.99999 at deviceScaleFactor 2).
        expect(Math.round(box!.height), sel).toBeGreaterThanOrEqual(44);
      }
      // Zoul: no location or Add a photo strip on You, so the rows sit above the fold.
      await expect(page.getByTestId('location-presence-strip')).toHaveCount(0);
      await expect(page.getByTestId('profile-depth-strip')).toHaveCount(0);
      const tabBar = await page.getByTestId('mobile-nav-profile').boundingBox();
      const brands = await page.getByTestId('you-row-brands').boundingBox();
      expect(brands!.y + brands!.height, 'Brands row above the tab bar').toBeLessThanOrEqual(tabBar!.y);
      await page.screenshot({ path: testInfo.outputPath(`you-${width}-${theme}.png`), fullPage: false });

      await page.getByTestId('you-row-merch').click();
      await expect(page.getByTestId('you-coming-soon-notice')).toHaveText('Merch is coming soon.');
      await expect(page).toHaveURL(/\/profile$/);
      expect(writes).toEqual([]);

      // The strips still show off the You rows screen (Edit screen here).
      await page.goto('/profile/edit');
      await expect(page.getByTestId('location-presence-strip')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId('profile-depth-strip')).toBeVisible();
      await context.close();
    });
  }
}

// QC #385 P0: the header name is never cut off. Board: ~84px photo, name wraps to
// two lines, steps down (never below 15px) if two lines are not enough.
const LONG_NAMES = ['Torbay Bear', 'Christopher Montgomery', 'Maximilian Featherstonehaugh', 'Bartholomew Wolverhampton-Smythe'];
for (const theme of ['dark', 'light'] as const) {
  for (const width of [390, 360]) {
    test(`You header name is never truncated at ${width}px (${theme})`, async ({ browser }, testInfo) => {
      const context = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      await authenticate(context, theme);
      const rows: string[] = [];
      for (const name of LONG_NAMES) {
        const page = await context.newPage();
        await mockApis(page, [], name);
        await page.goto('/profile');
        const el = page.getByTestId('you-name');
        await expect(el).toHaveText(name, { timeout: 20_000 });
        await expect(page.getByTestId('you-row-value-albums')).toHaveText('3');
        const m = await el.evaluate((h) => {
          const cs = getComputedStyle(h);
          const fontPx = parseFloat(cs.fontSize);
          const linePx = parseFloat(cs.lineHeight);
          const r = h.getBoundingClientRect();
          const edit = document.querySelector('[data-testid="you-edit"]')!.getBoundingClientRect();
          const ring = document.querySelector('[data-testid="you-avatar-ring"]')!.getBoundingClientRect();
          const photo = (document.querySelector('[data-testid="you-avatar"]') ?? document.querySelector('[data-testid="you-avatar-brand-face"]'))!.getBoundingClientRect();
          return {
            fontPx,
            lines: Math.round(r.height / linePx),
            width: Math.round(r.width),
            overflowX: h.scrollWidth - h.clientWidth,
            ellipsis: cs.textOverflow,
            whiteSpace: cs.whiteSpace,
            gapToEdit: Math.round(edit.left - r.right),
            photo: Math.round(photo.width),
            ring: Math.round(ring.width),
            editH: Math.round(edit.height),
          };
        });
        rows.push(`${width}px ${theme} "${name}": ${m.fontPx}px, ${m.lines} line(s), box ${m.width}px, photo ${m.photo}px (ring ${m.ring}px), Edit ${m.editH}px tall, gap to Edit ${m.gapToEdit}px`);
        expect(m.overflowX, name).toBeLessThanOrEqual(0);
        expect(m.ellipsis, name).not.toBe('ellipsis');
        expect(m.whiteSpace, name).not.toBe('nowrap');
        expect(m.fontPx, name).toBeGreaterThanOrEqual(15);
        expect(m.fontPx, name).toBeLessThanOrEqual(24);
        expect(m.photo, 'board ~84px photo').toBe(84);
        expect(m.gapToEdit, name).toBeGreaterThanOrEqual(0);
        expect(m.editH).toBeGreaterThanOrEqual(44);
        // Two lines is the target; only a name that cannot fit at 15px may wrap further.
        if (m.lines > 2) expect(m.fontPx, name).toBe(15);
        if (name === 'Torbay Bear') expect(m.lines).toBeLessThanOrEqual(2);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow).toBeLessThanOrEqual(0);
        await page.getByTestId('you-header').screenshot({ path: testInfo.outputPath(`you-name-${width}-${theme}-${name.replace(/\W+/g, '-')}.png`) });
        await page.close();
      }
      console.log(rows.join('\n'));
      await context.close();
    });
  }
}
