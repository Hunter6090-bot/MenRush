import { expect, test } from '@playwright/test';
import { guardAgainstSideEffects } from './support/network-guard';
import { AGE_GATE_ADULT_VALUE, AGE_GATE_STORAGE_KEY, FRESH_DEVICE_STORAGE_STATE } from './support/age-gate';

/** Accessible name of ComingSoon's h1 (br-separated lines collapse to one name). */
const LANDING_H1 =
  /See who's around\.\s*On the map\./i;

test.describe('public routes', () => {
  const routes = [
    // Pre-launch: App.tsx renders <ComingSoon /> at "/" (see CLAUDE.md).
    { path: '/', heading: LANDING_H1 },
    { path: '/terms', heading: 'Terms and Conditions' },
    { path: '/privacy', heading: 'Private by design, clear by default.' },
    { path: '/cookies', heading: 'Cookies' },
    { path: '/help', heading: 'Fast answers before you dive in.' },
    { path: '/safety', heading: 'Real men. Clear boundaries.' },
    { path: '/guidelines', heading: 'Direct does not mean disrespectful.' },
  ];

  for (const route of routes) {
    test(`${route.path} renders its primary content`, async ({ page }) => {
      const network = await guardAgainstSideEffects(page);

      await page.goto(route.path);

      await expect(page).toHaveTitle(/MenRush/);
      await expect(page.getByRole('heading', { level: 1, name: route.heading })).toBeVisible();
      await expect(page.locator('#root')).not.toBeEmpty();
      expect(network.expectNoSideEffects()).toEqual([]);
    });
  }
});

test('landing hero Sign up free goes to account register', async ({ page }) => {
  const network = await guardAgainstSideEffects(page);

  await page.goto('/');
  const signUpLink = page.getByRole('link', { name: /^Sign up free$/i });
  await expect(signUpLink).toBeVisible();
  await expect(signUpLink).toHaveAttribute('href', '/register');
  await expect(page.getByRole('textbox', { name: 'Email for waitlist' })).toHaveCount(0);
  await expect(page.getByText(/OPENS 1 OCTOBER 2026/i)).toHaveCount(0);
  await expect(page.getByText(/leave your email/i)).toHaveCount(0);
  expect(network.expectNoSideEffects()).toEqual([]);
});

test('login page exposes sign-in controls without submitting credentials', async ({ page }) => {
  const network = await guardAgainstSideEffects(page);

  await page.goto('/login');

  await expect(page.getByRole('heading', { level: 1 })).toContainText(/Sign in and see who's/i);
  await expect(page.getByPlaceholder('you@example.com')).toBeVisible();
  await expect(page.getByPlaceholder('••••••••')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign In' })).toBeEnabled();
  expect(network.expectNoSideEffects()).toEqual([]);
});

test.describe('anonymous route protection', () => {
  const protectedRoutes = [
    '/verify',
    '/verify/pending',
    '/verify/rejected',
    '/discover',
    '/stream',
    '/profile',
    '/albums',
    '/matches',
    '/conversations',
    '/messages/smoke-user',
  ];

  for (const path of protectedRoutes) {
    test(`${path} redirects to login with next=`, async ({ page }) => {
      await page.goto('/');
      // Signed out, but this device already passed the 18+ gate.
      await page.evaluate(
        ([k, v]) => {
          localStorage.clear();
          localStorage.setItem(k, v);
        },
        [AGE_GATE_STORAGE_KEY, AGE_GATE_ADULT_VALUE],
      );

      await page.goto(path);

      // App.tsx appends `?next=<encoded path>` so sign-in returns the user here.
      await expect(page).toHaveURL(`/login?next=${encodeURIComponent(path)}`);
      await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
    });
  }
});

test.describe('first-launch 18+ gate (fresh device)', () => {
  test.use({ storageState: FRESH_DEVICE_STORAGE_STATE });

  test('shows on first app launch, is remembered, and keeps the deep link', async ({ page }) => {
    await page.goto('/discover?view=list');
    await expect(page.getByTestId('age-gate')).toBeVisible();
    await expect(page.getByRole('heading', { name: '18+' })).toBeVisible();
    await page.getByRole('button', { name: "I'm 18 or over" }).click();
    // The protected deep link carries on to sign in with next= intact.
    await expect(page).toHaveURL(`/login?next=${encodeURIComponent('/discover?view=list')}`);
    await expect(page.getByTestId('age-gate')).toHaveCount(0);
    expect(await page.evaluate((k) => localStorage.getItem(k), AGE_GATE_STORAGE_KEY)).toBe(AGE_GATE_ADULT_VALUE);
    await page.reload();
    await expect(page.getByTestId('age-gate')).toHaveCount(0);
  });

  test("I'm under 18 leaves the app and stores nothing", async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: "I'm under 18" }).click();
    await expect(page).toHaveURL('/under-18');
    await expect(page.getByTestId('age-gate-exit')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In' })).toHaveCount(0);
    expect(await page.evaluate((k) => localStorage.getItem(k), AGE_GATE_STORAGE_KEY)).toBeNull();
  });

  for (const path of ['/', '/pride', '/terms', '/privacy', '/help', '/register', '/invite']) {
    test(`${path} skips the gate`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('body')).not.toBeEmpty();
      await expect(page.getByTestId('age-gate')).toHaveCount(0);
    });
  }
});
