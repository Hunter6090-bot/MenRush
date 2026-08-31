import { expect, test } from '@playwright/test';
import { guardAgainstSideEffects } from './support/network-guard';

/** Routes that share the locked UK launch landing (ComingSoon). */
const LANDING_PATHS = ['/', '/coming-soon'] as const;

const FORBIDDEN_CTA_PATTERNS = [
  /^JOIN THE WAITLIST$/i,
  /^GET EARLY ACCESS$/i,
  /^Join waitlist$/i,
];

async function assertComingSoonDesignLock(page: import('@playwright/test').Page) {
  const header = page.locator('header').first();
  const headerBrandLink = header.getByRole('link', { name: /^MenRush$/i });
  await expect(headerBrandLink).toHaveCount(1);
  await expect(headerBrandLink).toHaveAttribute('href', '/');
  await expect(headerBrandLink.getByTestId('brand-mark')).toBeVisible();
  await expect(headerBrandLink.locator('img[src*="menrush-logo-192"]')).toBeVisible();

  const signInLink = page.getByRole('link', { name: /^Sign in$/i });
  await expect(signInLink).toHaveCount(1);
  await expect(signInLink).toHaveAttribute('href', '/login');
  await expect(header.getByRole('link', { name: /^Sign in$/i })).toBeVisible();

  const heroHeading = page.getByRole('heading', {
    level: 1,
    name: /Real men\.\s*Verified profiles\.\s*Total discretion\./i,
  });
  await expect(heroHeading).toBeVisible();
  await expect(heroHeading).toHaveClass(/mr-coming-soon-heading/);

  await expect(page.getByText(/LIVE NOW\. UK BETA OPEN/i)).toBeVisible();
  await expect(page.getByText(/OPENS 1 OCTOBER 2026/i)).toHaveCount(0);
  await expect(page.getByText(/leave your email/i)).toHaveCount(0);
  await expect(page.getByText(/LONDON · MANCHESTER · BIRMINGHAM · BRIGHTON/i)).toHaveCount(0);

  await expect(page.getByRole('heading', { name: /What you get/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /^Nearby$/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /^Video rooms$/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /^Rooms$/i })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: /^Matches$/i })).toBeVisible();

  // Period lock on card bodies — no em dash, en dash, or hyphen-as-aside (same as hero overline).
  await expect(
    page.getByText(
      'See who is around you right now. Live proximity, not a stack of stale profiles.',
    ),
  ).toBeVisible();
  await expect(
    page.getByText('Mutual interest opens chat. Direct when it is real. No endless maybe.'),
  ).toBeVisible();
  await expect(
    page.getByText('Group spaces for men who already know the vibe. Less noise. More signal.'),
  ).toBeVisible();

  // Product lock 31 Aug 2026: open signup waitlist gift; Pride replaces it (no stack).
  // Do not say invite-only until open — hero is Sign up free / UK BETA OPEN.
  await expect(page.getByText(/Sign up before 1 October 2026/i)).toBeVisible();
  await expect(page.getByText(/30 days of Premium/i)).toBeVisible();
  await expect(page.getByText(/Pride promo replaces that gift and does not stack/i)).toBeVisible();
  await expect(page.getByText(/invite-only until/i)).toHaveCount(0);
  await expect(page.getByText(/Invite-only until then/i)).toHaveCount(0);

  for (const pattern of FORBIDDEN_CTA_PATTERNS) {
    await expect(page.getByRole('button', { name: pattern })).toHaveCount(0);
    await expect(page.getByRole('link', { name: pattern })).toHaveCount(0);
  }

  await expect(page.locator('#waitlist')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Email for waitlist' })).toHaveCount(0);
  await expect(page.locator('#waitlist-email')).toHaveCount(0);

  const signUpLink = page.getByRole('link', { name: /^Sign up free$/i });
  await expect(signUpLink).toHaveCount(1);
  await expect(signUpLink).toHaveAttribute('href', '/register');

  const inviteLink = page.getByRole('link', { name: /Enter your code/i });
  await expect(inviteLink).toBeVisible();
  await expect(inviteLink).toHaveAttribute('href', '/beta');

  // Hero keeps the large medallion; header uses compact sm (192).
  await expect(page.getByTestId('brand-mark')).toHaveCount(2);
  await expect(page.locator('main img[src*="menrush-logo-512"]')).toBeVisible();
  await expect(page.locator('img[src*="medallion-480"]')).toHaveCount(0);
}

async function assertAuthShell(page: import('@playwright/test').Page) {
  await expect(page.locator('h1.mr-auth-heading')).toBeVisible();
  await assertBrandMark(page);
}

async function assertBrandMark(page: import('@playwright/test').Page) {
  const mark = page.getByTestId('brand-mark').first();
  await expect(mark).toBeVisible();
  await expect(mark.locator('img[src*="menrush-logo-512"]')).toBeVisible();
  await expect(page.locator('img[src*="medallion-480"]')).toHaveCount(0);
}

async function assertCreamInputs(page: import('@playwright/test').Page) {
  const inputs = page.locator('input:not([type="checkbox"])');
  const count = await inputs.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i += 1) {
    await expect(inputs.nth(i)).toHaveClass(/bg-\[#F5EBD8\]/);
  }
}

test.describe('public design lock — landing', () => {
  for (const path of LANDING_PATHS) {
    test(`${path} keeps UK beta-open landing invariants`, async ({ page }) => {
      const network = await guardAgainstSideEffects(page);
      await page.goto(path);
      await assertComingSoonDesignLock(page);
      expect(network.expectNoSideEffects()).toEqual([]);
    });
  }
});

test.describe('public design lock — auth pages', () => {
  test('/login uses auth shell and open-signup copy', async ({ page }) => {
    const network = await guardAgainstSideEffects(page);
    await page.goto('/login');
    await assertAuthShell(page);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Sign in and see who's/i);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/near you right now/i);
    await expect(page.getByText(/For invite holders only/i)).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Create an account/i })).toHaveAttribute(
      'href',
      '/register',
    );
    expect(network.expectNoSideEffects()).toEqual([]);
  });

  test('/beta keeps optional invite UI shell', async ({ page }) => {
    const network = await guardAgainstSideEffects(page);
    await page.goto('/beta');
    await assertAuthShell(page);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Have an invite/i);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Enter your code/i);
    await expect(page.locator('#beta-invite-code')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Continue$/i })).toHaveCount(1);
    await expect(page.getByRole('link', { name: /Sign up free/i })).toHaveAttribute(
      'href',
      '/register',
    );
    expect(network.expectNoSideEffects()).toEqual([]);
  });

  test('/register stays open without invite bounce', async ({ page }) => {
    const network = await guardAgainstSideEffects(page);
    await page.goto('/register');
    await expect(page).toHaveURL(/\/register/);
    await assertAuthShell(page);
    await assertCreamInputs(page);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Create your account/i);
    await expect(page.getByText(/You're in/i)).toHaveCount(0);
    await expect(page.getByText(/^Pick a username and password\.$/)).toBeVisible();
    await expect(page.getByText(/Optional Pride promo below/i)).toHaveCount(0);
    await expect(page.getByText(/Your invite code checks out/i)).toHaveCount(0);
    await expect(page.getByText(/use the email your invite was sent to/i)).toHaveCount(0);
    await expect(page.getByTestId('register-username-input')).toBeVisible();
    await expect(page.getByTestId('register-promo-input')).toBeVisible();
    await expect(page.getByTestId('register-promo-input')).toHaveAttribute(
      'placeholder',
      'If you have one',
    );
    await expect(page.getByTestId('register-pride-note')).toHaveText(
      /Optional Pride promo if you have one\.?/i,
    );
    await expect(page.getByText(/PRIDE 3MONTH FREE or PRIDE-XXXX/i)).toHaveCount(0);
    await expect(page.getByTestId('register-gift-note')).toContainText(
      /Pride promo replaces that gift and does not stack/i,
    );
    expect(network.expectNoSideEffects()).toEqual([]);
  });
});
