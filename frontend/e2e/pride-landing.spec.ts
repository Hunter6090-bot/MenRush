import { expect, test } from '@playwright/test';
import { guardAgainstSideEffects } from './support/network-guard';

test.describe('Pride promotion landing', () => {
  test('/pride shows MenRush-branded offer and display code', async ({ page }) => {
    const network = await guardAgainstSideEffects(page);
    await page.goto('/pride');

    await expect(page).toHaveTitle(/MenRush/);
    await expect(page.getByTestId('brand-mark').first()).toBeVisible();
    await expect(page.getByTestId('brand-mark').locator('img[src*="menrush-logo-512"]')).toBeVisible();

    await expect(page.getByText(/PRIDE PROMOTION/i)).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/3 Months Free/i);
    await expect(page.getByText(/Thanks for scanning/i)).toBeVisible();

    const codeBox = page.getByTestId('pride-promo-code');
    await expect(codeBox).toContainText('PRIDE 3MONTH FREE');
    await expect(codeBox).toContainText('PRIDE3MONTHFREE');

    await expect(page.getByText(/Valid until 5 September 2026/i)).toBeVisible();
    await expect(page.getByText(/One code per user/i)).toBeVisible();

    await expect(page.getByRole('heading', { name: /What you get/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Nearby$/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Rooms$/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Matches$/i })).toBeVisible();

    const cta = page.getByTestId('pride-cta');
    await expect(cta).toHaveAttribute('href', '/');
    await expect(cta).toContainText(/Continue to MenRush/i);

    expect(network.expectNoSideEffects()).toEqual([]);
  });
});
