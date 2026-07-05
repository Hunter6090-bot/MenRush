import { expect, test } from '@playwright/test';
import { guardAgainstSideEffects } from './support/network-guard';

/** Routes that share the locked public landing design (ComingSoon). */
const LANDING_PATHS = ['/', '/coming-soon'] as const;

const FORBIDDEN_CTA_PATTERNS = [
  /^JOIN THE WAITLIST$/i,
  /^GET EARLY ACCESS$/i,
];

async function assertComingSoonDesignLock(page: import('@playwright/test').Page) {
  const signInLink = page.getByRole('link', { name: /Already have an invite\? Sign in/i });
  await expect(signInLink).toHaveCount(1);
  await expect(signInLink).toHaveAttribute('href', '/login');

  const heroHeading = page.locator('h1.mr-coming-soon-heading');
  await expect(heroHeading).toBeVisible();
  await expect(heroHeading).toContainText(/Real men/i);
  await expect(heroHeading).toContainText(/Verified bodies/i);

  for (const pattern of FORBIDDEN_CTA_PATTERNS) {
    await expect(page.getByRole('button', { name: pattern })).toHaveCount(0);
    await expect(page.getByRole('link', { name: pattern })).toHaveCount(0);
  }

  await expect(page.locator('#waitlist')).toBeVisible();
  await expect(page.locator('#waitlist-email')).toBeVisible();
  await expect(page.getByRole('button', { name: /Join the verified waitlist/i })).toHaveCount(1);
  await assertBrandMark(page);
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
    test(`${path} keeps minimal landing invariants`, async ({ page }) => {
      const network = await guardAgainstSideEffects(page);
      await page.goto(path);
      await assertComingSoonDesignLock(page);
      expect(network.expectNoSideEffects()).toEqual([]);
    });
  }
});

test.describe('public design lock — auth pages', () => {
  test('/login uses auth shell and invite-holder copy', async ({ page }) => {
    const network = await guardAgainstSideEffects(page);
    await page.goto('/login');
    await assertAuthShell(page);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Sign in and see who's/i);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/near you right now/i);
    await expect(page.getByText(/For invite holders only/i)).toBeVisible();
    expect(network.expectNoSideEffects()).toEqual([]);
  });

  test('/beta validates invite UI shell', async ({ page }) => {
    const network = await guardAgainstSideEffects(page);
    await page.goto('/beta');
    await assertAuthShell(page);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Beta access is/i);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/invite-only/i);
    await expect(page.locator('#beta-invite-code')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Continue$/i })).toHaveCount(1);
    expect(network.expectNoSideEffects()).toEqual([]);
  });

  test('/register uses auth shell, cream inputs, and beta copy', async ({ page }) => {
    const network = await guardAgainstSideEffects(page);
    await page.goto('/register?invite=MR-BETA-TEST1');
    await assertAuthShell(page);
    await assertCreamInputs(page);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/You're in/i);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Set up your account/i);
    expect(network.expectNoSideEffects()).toEqual([]);
  });
});
