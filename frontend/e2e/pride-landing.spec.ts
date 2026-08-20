import { expect, test } from '@playwright/test';
import { guardAgainstSideEffects } from './support/network-guard';

test.describe('Pride promotion landing', () => {
  test('/pride shows Legal-locked offer and exact redeemable code', async ({ page }) => {
    const network = await guardAgainstSideEffects(page);
    await page.goto('/pride');

    await expect(page).toHaveTitle(/MenRush/);
    await expect(page.getByTestId('brand-mark').first()).toBeVisible();

    await expect(page.getByRole('heading', { level: 1 })).toContainText(/3 Months Free/i);

    const headline = page.getByTestId('pride-headline-lock');
    await expect(headline).toContainText('PRIDE 3MONTH FREE');
    await expect(headline).toContainText(/when you join the waitlist by 5 September 2026/i);
    await expect(headline).toContainText(/3 months of Premium from 1 October 2026/i);
    await expect(headline).toContainText(/when MenRush opens/i);
    await expect(headline).toContainText(/cannot use Premium before launch/i);

    const codeBox = page.getByTestId('pride-promo-code');
    await expect(codeBox).toContainText('PRIDE 3MONTH FREE');
    await expect(codeBox.getByText('PRIDE3MONTHFREE')).toHaveCount(0);

    const conditions = page.getByTestId('pride-conditions');
    await expect(conditions).toContainText(/last day to/);
    await expect(conditions).toContainText(/31 December 2026/i);
    await expect(conditions).toContainText(/If launch slips/i);
    await expect(conditions).toContainText(/Terms 7\.2/i);
    await expect(conditions).toContainText(/No stacking/i);
    await expect(conditions).toContainText(/18\+/);
    await expect(conditions).toContainText(/UK-first/i);
    await expect(conditions).toContainText(/Three months of Premium at no charge/i);
    await expect(conditions).toContainText(/will not be billed for this offer/i);
    await expect(page.getByText(/auto-renew/i)).toHaveCount(0);
    await expect(page.getByText(/CCBill/i)).toHaveCount(0);
    await expect(page.getByText(/card/i)).toHaveCount(0);

    // No invented address block; Terms link is the address path
    await expect(page.getByText(/RM6 6AX/i)).toHaveCount(0);
    await expect(page.getByText(/17249857/)).toHaveCount(0);

    const promoter = page.getByTestId('pride-promoter-slot');
    await expect(promoter).toContainText(/Bronze Apps UK Limited \(trading as MenRush\)/i);
    await expect(page.getByTestId('pride-terms-link')).toHaveAttribute('href', '/terms');
    await expect(promoter.getByRole('link', { name: /^Privacy$/i })).toHaveAttribute(
      'href',
      '/privacy',
    );

    await expect(page.getByTestId('pride-cta')).toHaveAttribute('href', '/#waitlist');

    expect(network.expectNoSideEffects()).toEqual([]);
  });
});
