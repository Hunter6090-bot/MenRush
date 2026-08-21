import { expect, test } from '@playwright/test';
import { guardAgainstSideEffects } from './support/network-guard';

test.describe('Pride promotion landing', () => {
  test('/pride shows one claim path: email → unique code', async ({ page }) => {
    const network = await guardAgainstSideEffects(page);
    await page.goto('/pride');

    await expect(page).toHaveTitle(/MenRush/);
    await expect(page.getByTestId('brand-mark').first()).toBeVisible();

    await expect(page.getByRole('heading', { level: 1 })).toContainText(/3 Months Free/i);

    const headline = page.getByTestId('pride-headline-lock');
    await expect(headline).toContainText(/Claim with your email/i);
    await expect(headline).toContainText(/one unique code/i);
    await expect(headline).toContainText(/closed beta/i);
    await expect(headline).toContainText(/3 months of Premium from launch/i);
    await expect(headline).toContainText(/cannot use Premium before launch/i);
    await expect(headline).not.toContainText(/Path 1/i);
    await expect(headline).not.toContainText(/Path 2/i);
    await expect(headline).not.toContainText(/PRIDE 3MONTH FREE/i);
    await expect(headline).not.toContainText(/public code/i);

    await expect(page.getByTestId('pride-week-why')).toContainText(/21–31 August 2026/i);
    await expect(page.getByTestId('pride-week-why')).toContainText(/Southampton Pride/i);
    await expect(page.getByTestId('pride-week-why')).toContainText(/Manchester Village Pride/i);
    await expect(page.getByTestId('pride-week-why')).toContainText(/not a sponsor/i);
    await expect(page.getByTestId('pride-week-why')).toContainText(/resend/i);

    const invitePath = page.getByTestId('pride-invite-path');
    await expect(invitePath).toContainText(/Claim Pride code/i);
    await expect(invitePath).not.toContainText(/Path 1/i);
    await expect(invitePath).not.toContainText(/Path 2/i);
    const bargain = page.getByTestId('pride-invite-bargain');
    await expect(bargain).toContainText(/MENRUSH-XXXX-XXXX/i);
    await expect(bargain).toContainText(/One grant per email/i);
    await expect(bargain).not.toContainText(/PRIDE 3MONTH FREE/i);
    await expect(bargain).not.toContainText(/Brighton/i);

    await expect(page.getByTestId('pride-invite-form')).toHaveCount(0);
    await expect(page.getByTestId('pride-claim-cta')).toBeVisible();
    await expect(page.getByTestId('pride-claim-cta')).toHaveText(/Claim Pride code/i);
    await page.getByTestId('pride-claim-cta').click();
    await expect(page.getByTestId('pride-invite-form')).toBeVisible();
    await expect(page.getByTestId('pride-invite-adult')).toBeVisible();
    await expect(page.getByTestId('pride-invite-email')).toBeVisible();
    await expect(page.getByTestId('pride-invite-submit')).toContainText(/Email my Pride code/i);

    // Path 2 / public code must be gone from the face
    await expect(page.getByTestId('pride-promo-code')).toHaveCount(0);
    await expect(page.getByTestId('pride-cta')).toHaveCount(0);
    await expect(page.getByTestId('pride-cta-note')).toHaveCount(0);
    await expect(page.getByTestId('pride-clock-public')).toHaveCount(0);
    await expect(page.getByText('PRIDE 3MONTH FREE')).toHaveCount(0);
    await expect(page.getByText(/Create account & enter public code/i)).toHaveCount(0);
    await expect(page.getByText(/Copy code/i)).toHaveCount(0);

    // Grandfather: personal codes still redeem; do not promote Brighton campaign
    const grandfather = page.getByTestId('pride-grandfather');
    await expect(grandfather).toContainText(/personal PRIDE-XXXX-XXXX/i);
    await expect(grandfather).toContainText(/One grant per person/i);
    await expect(grandfather).not.toContainText(/Brighton/i);
    await expect(page.getByText(/Brighton Pride Special Offer/i)).toHaveCount(0);
    await expect(page.getByText(/brightonpride/i)).toHaveCount(0);
    await expect(page.locator('img[src*="brighton-pride-bunting"]')).toHaveCount(0);

    const conditions = page.getByTestId('pride-conditions');
    await expect(page.getByTestId('pride-clock-invite')).toContainText(/21–31 August 2026/i);
    await expect(page.getByTestId('pride-clock-invite')).toContainText(/Resend/i);
    await expect(conditions).not.toContainText(/PRIDE 3MONTH FREE/i);
    await expect(conditions).not.toContainText(/public code/i);

    const duration = page.getByTestId('pride-duration-rule');
    await expect(duration).toContainText(/Premium starts at launch/i);
    await expect(duration).toContainText(/1 October 2026/i);
    await expect(duration).toContainText(/Ends 1 January 2027/i);
    await expect(duration).toContainText(/If launch slips/i);
    await expect(duration).not.toContainText('→');
    await expect(conditions).toContainText(/Terms 7\.2/i);
    await expect(conditions).toContainText(/18\+/);
    await expect(conditions).toContainText(/will not be billed for this offer/i);
    await expect(page.getByText(/auto-renew/i)).toHaveCount(0);
    await expect(page.getByText(/CCBill/i)).toHaveCount(0);
    await expect(page.getByText(/Path 1/i)).toHaveCount(0);
    await expect(page.getByText(/Path 2/i)).toHaveCount(0);

    const promoter = page.getByTestId('pride-promoter-slot');
    await expect(promoter).toContainText(/Bronze Apps UK Limited \(trading as MenRush\)/i);
    await expect(page.getByTestId('pride-terms-link')).toHaveAttribute('href', '/terms');

    await expect(page.getByRole('heading', { name: /What you get at launch/i })).toBeVisible();
    await expect(page.getByText(/See who is around you when MenRush opens/i)).toBeVisible();

    expect(network.expectNoSideEffects()).toEqual([]);
  });
});
