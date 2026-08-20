import { expect, test } from '@playwright/test';
import { guardAgainstSideEffects } from './support/network-guard';

test.describe('Pride promotion landing', () => {
  test('/pride shows Legal-locked offer and exact redeemable code', async ({ page }) => {
    const network = await guardAgainstSideEffects(page);
    await page.goto('/pride');

    await expect(page).toHaveTitle(/MenRush/);
    await expect(page.getByTestId('brand-mark').first()).toBeVisible();
    await expect(page.getByTestId('brand-mark').locator('img[src*="menrush-logo-512"]')).toBeVisible();

    await expect(page.getByText(/PRIDE PROMOTION/i)).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/3 Months Free/i);

    const headline = page.getByTestId('pride-headline-lock');
    await expect(headline).toContainText(/Enter the code by 5 September 2026/i);
    await expect(headline).toContainText(/Premium runs from launch on 1 October 2026/i);
    await expect(headline).toContainText(/cannot use MenRush before launch/i);

    const codeBox = page.getByTestId('pride-promo-code');
    await expect(codeBox).toContainText('PRIDE 3MONTH FREE');
    // Only the working display string — no alternate compact shown as a second code
    await expect(codeBox.getByText('PRIDE3MONTHFREE')).toHaveCount(0);

    const conditions = page.getByTestId('pride-conditions');
    await expect(conditions).toContainText(/last day to/);
    await expect(conditions).toContainText(/enter/i);
    await expect(conditions).toContainText(/31 December 2026/i);
    await expect(conditions).toContainText(/not from the day you scan/i);
    await expect(conditions).toContainText(/Nothing is usable before launch/i);
    await expect(conditions).toContainText(/If launch slips/i);
    await expect(conditions).toContainText(/one MenRush account \/ email/i);
    await expect(conditions).toContainText(/Terms 7\.2/i);
    await expect(conditions).toContainText(/No stacking/i);
    await expect(conditions).toContainText(/90 days/i);
    await expect(conditions).toContainText(/18\+/);
    await expect(conditions).toContainText(/UK-first/i);
    await expect(conditions).toContainText(/Three months at no charge/i);
    await expect(conditions).toContainText(/Bronze Apps UK Limited/i);
    await expect(conditions).toContainText(/17249857/);

    await expect(page.getByRole('link', { name: /^Terms$/i }).first()).toHaveAttribute('href', '/terms');
    await expect(page.getByRole('link', { name: /^Privacy$/i }).first()).toHaveAttribute(
      'href',
      '/privacy',
    );

    // No Premium price / CCBill / card push
    await expect(page.getByText(/£/)).toHaveCount(0);
    await expect(page.getByText(/CCBill/i)).toHaveCount(0);

    const cta = page.getByTestId('pride-cta');
    await expect(cta).toHaveAttribute('href', '/#waitlist');

    expect(network.expectNoSideEffects()).toEqual([]);
  });
});
