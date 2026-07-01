import { expect, test } from '@playwright/test';
import { guardAgainstSideEffects } from './support/network-guard';

/** Routes that share the locked public landing design (ComingSoon). */
const LANDING_PATHS = ['/', '/coming-soon'] as const;

const FORBIDDEN_CTA_PATTERNS = [
  /^JOIN THE WAITLIST$/i,
  /^GET EARLY ACCESS$/i,
];

async function assertLandingDesignLock(page: import('@playwright/test').Page) {
  const header = page.locator('header');
  const signInHeaderLinks = header.getByRole('link', {
    name: /Already have an invite\? Sign in|Sign in/i,
  });
  await expect(signInHeaderLinks).toHaveCount(1);

  const heroHeading = page.locator('h1.mr-hero-heading');
  await expect(heroHeading).toBeVisible();
  await expect(heroHeading).not.toHaveClass(/mr-brand-wordmark/);

  for (const pattern of FORBIDDEN_CTA_PATTERNS) {
    await expect(page.getByRole('button', { name: pattern })).toHaveCount(0);
    await expect(page.getByRole('link', { name: pattern })).toHaveCount(0);
  }

  await expect(page.getByText(/Beta 200:/)).toBeVisible();
  await expect(page.locator('#waitlist')).toBeVisible();
  await expect(page.locator('#waitlist-email')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Join waitlist$/i })).toHaveCount(1);
}

async function assertPublicMarketingShellGrid(page: import('@playwright/test').Page) {
  const shellGrid = page.locator('div.grid.w-full.gap-10');
  await expect(shellGrid).toBeVisible();
  await expect(shellGrid).toHaveClass(/lg:grid-cols-\[1\.1fr_0\.9fr\]/);
  await expect(page.locator('h1.mr-hero-heading')).toBeVisible();
}

async function assertWaitlistNavLink(page: import('@playwright/test').Page) {
  const waitlistLink = page.locator('header').getByRole('link', { name: /^Waitlist$/i });
  await expect(waitlistLink).toHaveCount(1);
  await expect(waitlistLink).toHaveAttribute('href', '/coming-soon#waitlist');
}

async function assertCreamInputs(page: import('@playwright/test').Page) {
  const inputs = page.locator('input:not([type="checkbox"])');
  const count = await inputs.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i += 1) {
    await expect(inputs.nth(i)).toHaveClass(/bg-\[#F7EFE0\]/);
  }
}

test.describe('public design lock — landing', () => {
  for (const path of LANDING_PATHS) {
    test(`${path} keeps minimal landing invariants`, async ({ page }) => {
      const network = await guardAgainstSideEffects(page);
      await page.goto(path);
      await assertLandingDesignLock(page);
      expect(network.expectNoSideEffects()).toEqual([]);
    });
  }
});

test.describe('public design lock — auth pages', () => {
  test('/login uses PublicMarketingShell and canonical waitlist link', async ({ page }) => {
    const network = await guardAgainstSideEffects(page);
    await page.goto('/login');
    await assertPublicMarketingShellGrid(page);
    await assertWaitlistNavLink(page);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Sign in and see who's/i);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/near you right now/i);
    expect(network.expectNoSideEffects()).toEqual([]);
  });

  test('/register uses PublicMarketingShell, cream inputs, and waitlist link', async ({ page }) => {
    const network = await guardAgainstSideEffects(page);
    await page.goto('/register');
    await assertPublicMarketingShellGrid(page);
    await assertWaitlistNavLink(page);
    await assertCreamInputs(page);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Create your account/i);
    expect(network.expectNoSideEffects()).toEqual([]);
  });
});
