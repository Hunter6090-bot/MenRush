import { expect, test } from '@playwright/test';
import { guardAgainstSideEffects } from './support/network-guard';

test.describe('Brighton Pride campaign page', () => {
  test('/brightonpride keeps live offer terms and legal links', async ({ page }) => {
    const network = await guardAgainstSideEffects(page);
    await page.goto('/brightonpride');

    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Who.?s near you/i);
    await expect(page.getByText(/Brighton Pride Special Offer/i)).toBeVisible();
    await expect(page.getByText(/3 Months Free Premium/i)).toBeVisible();

    // No public shared code on this campaign
    await expect(page.getByText(/PRIDE 3MONTH FREE/i)).toHaveCount(0);
    await expect(page.getByText(/personal code locked to your email/i)).toBeVisible();

    // Redeem-by / enter-by (Finance lock)
    await expect(page.getByText(/Enter your personal code by\s*5\s*September\s*2026/i)).toBeVisible();

    // Premium window — clocks from launch, not scan/claim
    await expect(page.getByText(/Premium starts on launch\s*\(1\s*October\s*2026\)/i)).toBeVisible();
    await expect(page.getByText(/through\s*1\s*January\s*2027/i)).toBeVisible();
    await expect(page.getByText(/not from the day you scan, claim, or redeem/i)).toBeVisible();

    // Finance lock vs 30-day waitlist gift — no stacking to 120 days
    await expect(page.getByText(/replaces the standard 30-day waitlist Premium gift/i)).toBeVisible();
    await expect(page.getByText(/maximum of 90 days/i)).toBeVisible();
    await expect(page.getByText(/not stacked with the waitlist gift to 120 days/i)).toBeVisible();

    // No Premium price published
    await expect(page.getByText(/£/)).toHaveCount(0);
    await expect(page.getByText(/\$\d/)).toHaveCount(0);

    // Legal links + company
    await expect(page.getByRole('link', { name: /^Terms$/i }).first()).toHaveAttribute('href', '/terms');
    await expect(page.getByRole('link', { name: /^Privacy$/i }).first()).toHaveAttribute(
      'href',
      '/privacy',
    );
    await expect(page.getByText(/Bronze\s*Apps\s*UK\s*Limited/i)).toBeVisible();
    await expect(page.getByText(/17249857/)).toBeVisible();
    await expect(page.getByText(/RM6 6AX/i)).toBeVisible();
    await expect(page.getByText(/18\+/)).toBeVisible();

    // 18+ confirm gates submit
    const adult = page.getByTestId('brightonpride-adult-confirm');
    await expect(adult).toBeVisible();
    await expect(page.getByRole('button', { name: /Claim my code/i })).toBeDisabled();

    expect(network.expectNoSideEffects()).toEqual([]);
  });
});
