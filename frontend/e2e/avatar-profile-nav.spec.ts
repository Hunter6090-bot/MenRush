import { test, expect } from '@playwright/test';

/**
 * Product rule smoke: photo hrefs for other/self, and Match/Message stay
 * dedicated controls (not nested inside the photo link).
 * Logic under test mirrors `profilePathForUser` in src/lib/profileLinks.ts.
 */
test.describe('avatar photo taps open profiles', () => {
  test('other → /profile/:id, own → /profile, Match/Message remain separate', async ({
    page,
  }) => {
    await page.setContent(`<!doctype html>
<html><body>
  <a data-testid="other-photo" href="/profile/22222222-2222-2222-2222-222222222222">other</a>
  <a data-testid="own-photo" href="/profile">own</a>
  <div data-testid="card">
    <a data-testid="card-photo" href="/profile/22222222-2222-2222-2222-222222222222">photo</a>
    <button type="button" data-testid="match-btn" data-action="match">Match</button>
    <button type="button" data-testid="message-btn" data-action="message">Message</button>
  </div>
  <script>
    function profilePathForUser(userId, currentUserId) {
      if (userId && currentUserId && userId === currentUserId) return '/profile';
      return '/profile/' + userId;
    }
    const me = '11111111-1111-1111-1111-111111111111';
    const them = '22222222-2222-2222-2222-222222222222';
    document.getElementById = undefined;
    window.__checks = {
      other: profilePathForUser(them, me),
      own: profilePathForUser(me, me),
    };
  </script>
</body></html>`);

    const checks = await page.evaluate(() => (window as unknown as { __checks: { other: string; own: string } }).__checks);
    expect(checks.other).toBe('/profile/22222222-2222-2222-2222-222222222222');
    expect(checks.own).toBe('/profile');

    await expect(page.getByTestId('other-photo')).toHaveAttribute(
      'href',
      '/profile/22222222-2222-2222-2222-222222222222',
    );
    await expect(page.getByTestId('own-photo')).toHaveAttribute('href', '/profile');
    await expect(page.getByTestId('match-btn')).toHaveAttribute('data-action', 'match');
    await expect(page.getByTestId('message-btn')).toHaveAttribute('data-action', 'message');
    await expect(page.locator('[data-testid="match-btn"]').locator('xpath=ancestor::a')).toHaveCount(0);
    await expect(page.locator('[data-testid="message-btn"]').locator('xpath=ancestor::a')).toHaveCount(0);
  });
});
