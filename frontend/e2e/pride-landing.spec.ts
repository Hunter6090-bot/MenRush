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
    await expect(headline).toContainText(/Create an account and enter code/i);
    await expect(headline).toContainText(/by 5 September 2026/i);
    await expect(headline).toContainText(/3 months of Premium from launch/i);
    await expect(headline).toContainText(/If MenRush opens on 1 October 2026, Premium ends 1 January 2027/i);
    await expect(headline).toContainText(/If launch slips, the 3 months run from the actual open date/i);
    await expect(headline).toContainText(/not still 1 January 2027/i);
    await expect(headline).toContainText(/cannot use Premium before launch/i);

    // Legal grandfather for already-issued personal Brighton codes (redirect target must carry this)
    const grandfather = page.getByTestId('pride-grandfather');
    await expect(grandfather).toContainText(
      /If you already received a personal Brighton Pride code by email, that code still works on the terms in that email/i,
    );
    await expect(grandfather).toContainText(/Do not also enter PRIDE 3MONTH FREE/i);
    await expect(grandfather).toContainText(/One person gets one Pride grant/i);

    // No dual-path marketing / claim-form CTA — grandfather line is the only Brighton mention
    await expect(page.getByText(/brightonpride/i)).toHaveCount(0);
    await expect(page.getByText(/One person cannot take both/i)).toHaveCount(0);
    await expect(page.getByText(/this is not the/i)).toHaveCount(0);
    await expect(page.getByText(/Brighton Pride Special Offer/i)).toHaveCount(0);

    // Brand hold: no Brighton street / bunting photo asset
    await expect(page.locator('img[src*="brighton-pride-bunting"]')).toHaveCount(0);
    await expect(page.locator('[style*="brighton-pride-bunting"]')).toHaveCount(0);

    const codeBox = page.getByTestId('pride-promo-code');
    await expect(codeBox).toContainText('PRIDE 3MONTH FREE');
    await expect(codeBox.getByText('PRIDE3MONTHFREE')).toHaveCount(0);

    const conditions = page.getByTestId('pride-conditions');
    await expect(conditions).toContainText(/last day to/);
    await expect(conditions).toContainText(/account register/i);
    await expect(conditions).toContainText(/waitlist form does not redeem/i);
    const duration = page.getByTestId('pride-duration-rule');
    await expect(duration).toContainText(/if MenRush opens on 1 October 2026, Premium ends 1 January 2027/i);
    await expect(duration).toContainText(/If launch slips, the 3 months run from the actual open date/i);
    await expect(duration).toContainText(/not still 1 January 2027/i);
    await expect(conditions).toContainText(/Terms 7\.2/i);
    await expect(conditions).toContainText(/does not add to that gift/i);
    await expect(conditions).toContainText(/18\+/);
    await expect(conditions).toContainText(/UK-first/i);
    await expect(conditions).toContainText(/Three months of Premium at no charge/i);
    await expect(conditions).toContainText(/will not be billed for this offer/i);
    await expect(page.getByText(/auto-renew/i)).toHaveCount(0);
    await expect(page.getByText(/CCBill/i)).toHaveCount(0);
    await expect(page.getByText(/card/i)).toHaveCount(0);
    await expect(page.getByText(/90 days/i)).toHaveCount(0);
    await expect(page.getByText(/31 December 2026/i)).toHaveCount(0);

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

    const cta = page.getByTestId('pride-cta');
    await expect(cta).toHaveAttribute('href', /\/register\?promo=/);
    await expect(cta).toContainText(/Create account/i);

    const ctaNote = page.getByTestId('pride-cta-note');
    await expect(ctaNote).toContainText(/Create an account and enter PRIDE 3MONTH FREE by 5 September 2026/i);
    await expect(ctaNote).toContainText(/waitlist/i);
    await expect(ctaNote).toContainText(/alone does not redeem this code/i);
    await expect(page.getByTestId('pride-waitlist-link')).toHaveAttribute('href', '/#waitlist');

    // App list at launch — not a live-before-1-October claim
    await expect(page.getByRole('heading', { name: /What you get at launch/i })).toBeVisible();
    await expect(page.getByText(/See who is around you when MenRush opens/i)).toBeVisible();
    await expect(page.getByText(/right now — live proximity/i)).toHaveCount(0);

    expect(network.expectNoSideEffects()).toEqual([]);
  });
});
