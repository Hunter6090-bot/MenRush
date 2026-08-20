import { expect, test } from '@playwright/test';
import { guardAgainstSideEffects } from './support/network-guard';

test.describe('Brighton Pride campaign page', () => {
  test('/brightonpride keeps live offer terms and honest redeem copy', async ({ page }) => {
    const network = await guardAgainstSideEffects(page);
    await page.goto('/brightonpride');

    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Who.?s near you/i);
    await expect(page.getByText(/Brighton Pride Special Offer/i)).toBeVisible();
    await expect(page.getByText(/3 Months Free Premium/i)).toBeVisible();

    // No public Pete code; personal emailed code only
    await expect(page.getByText(/PRIDE 3MONTH FREE/i)).toHaveCount(0);
    await expect(page.getByText(/PRIDE-XXXX-XXXX/i).first()).toBeVisible();
    await expect(page.getByText(/not a \/beta MENRUSH/i)).toBeVisible();

    // Redeem path not open — do not imply usable today
    await expect(page.getByText(/not yet an in-app field to redeem/i)).toBeVisible();

    // Redeem-by 31 Oct (live offer); Premium from 1 Oct
    await expect(page.getByText(/Redeem by 31\s*October\s*2026/i).first()).toBeVisible();
    await expect(
      page.getByText(/Premium starts on launch \(1\s*October\s*2026\)/i).first(),
    ).toBeVisible();

    // No "No card required now"
    await expect(page.getByText(/No card required now/i)).toHaveCount(0);
    await expect(page.getByTestId('brightonpride-no-charge')).toContainText(
      /Three months of Premium at no charge/i,
    );
    await expect(page.getByTestId('brightonpride-no-charge')).toContainText(
      /will not be billed unless you later choose to subscribe/i,
    );
    await expect(page.getByText(/CCBill/i)).toHaveCount(0);

    await expect(page.getByText(/replaces the standard 30-day waitlist Premium gift/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /^Terms$/i }).first()).toHaveAttribute('href', '/terms');
    await expect(page.getByTestId('brightonpride-adult-confirm')).toBeVisible();
    await expect(page.getByRole('button', { name: /Claim my code/i })).toBeDisabled();

    expect(network.expectNoSideEffects()).toEqual([]);
  });
});
