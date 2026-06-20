import { expect, test } from '@playwright/test';
import { guardAgainstSideEffects } from './support/network-guard';

test.describe('public routes', () => {
  const routes = [
    { path: '/', heading: 'MenRush' },
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

test('waitlist rejects invalid input without making a request', async ({ page }) => {
  const network = await guardAgainstSideEffects(page);

  await page.goto('/');
  await page.getByLabel('Email address').fill('not-an-email');
  await page.getByRole('button', { name: 'Get early access' }).click();

  await expect(page.getByText('Please enter a valid email address.')).toBeVisible();
  await expect(page.getByLabel('Email address')).toHaveValue('not-an-email');
  expect(network.expectNoSideEffects()).toEqual([]);
});

test('login page exposes sign-in controls without submitting credentials', async ({ page }) => {
  const network = await guardAgainstSideEffects(page);

  await page.goto('/login');

  await expect(
    page.getByRole('heading', {
      level: 1,
      name: /Invite holders can sign in and step back into/,
    }),
  ).toBeVisible();
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
    test(`${path} redirects to login`, async ({ page }) => {
      await page.goto('/');
      await page.evaluate(() => localStorage.clear());

      await page.goto(path);

      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
    });
  }
});
