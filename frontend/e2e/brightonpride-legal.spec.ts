import { expect, test } from '@playwright/test';
import { guardAgainstSideEffects } from './support/network-guard';

test.describe('Closed Brighton Pride URLs', () => {
  test('/brightonpride redirects to sole /pride offer', async ({ page }) => {
    const network = await guardAgainstSideEffects(page);
    await page.goto('/brightonpride');
    await expect(page).toHaveURL(/\/pride\/?$/);
    await expect(page.getByTestId('pride-headline-lock')).toBeVisible();
    await expect(page.getByTestId('pride-invite-path')).toBeVisible();
    await expect(page.getByTestId('pride-claim-cta')).toBeVisible();
    await expect(page.getByTestId('pride-terms-apply')).toContainText(/Terms and conditions apply\./i);
    await expect(page.getByTestId('pride-conditions')).toHaveCount(0);
    await expect(page.getByText(/Brighton/i)).toHaveCount(0);
    await expect(page.getByText(/Brighton Pride Special Offer/i)).toHaveCount(0);
    await expect(page.getByTestId('brightonpride-adult-confirm')).toHaveCount(0);
    expect(network.expectNoSideEffects()).toEqual([]);
  });

  test('/brightonpride26 redirects to /pride', async ({ page }) => {
    const network = await guardAgainstSideEffects(page);
    await page.goto('/brightonpride26');
    await expect(page).toHaveURL(/\/pride\/?$/);
    await expect(page.getByTestId('pride-headline-lock')).toBeVisible();
    await expect(page.getByTestId('pride-invite-path')).toBeVisible();
    await expect(page.getByTestId('pride-public-redeem-note')).toContainText('PRIDE 3MONTH FREE');
    await expect(page.getByTestId('pride-promo-code')).toHaveCount(0);
    await expect(page.getByText(/Brighton/i)).toHaveCount(0);
    expect(network.expectNoSideEffects()).toEqual([]);
  });
});
