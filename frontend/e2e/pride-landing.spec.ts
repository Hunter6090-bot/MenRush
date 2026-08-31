import { expect, test } from '@playwright/test';
import { guardAgainstSideEffects } from './support/network-guard';

test.describe('Pride promotion landing', () => {
  test('/pride claim-only face + Terms apply (no conditions block, no Brighton)', async ({
    page,
  }) => {
    const network = await guardAgainstSideEffects(page);
    await page.goto('/pride');

    await expect(page).toHaveTitle(/MenRush/);
    await expect(page.getByTestId('brand-mark').first()).toBeVisible();

    const headline = page.getByTestId('pride-headline-lock');
    await expect(headline).toContainText(/3 months/i);
    await expect(headline).toContainText(/Premium/i);
    await expect(headline).toContainText(/from launch/i);
    await expect(headline).not.toContainText(/Claim with your email/i);
    await expect(headline).not.toContainText(/closed beta/i);
    await expect(headline).not.toContainText(/Path 1/i);
    await expect(headline).not.toContainText(/Path 2/i);
    await expect(headline).not.toContainText(/PRIDE 3MONTH FREE/i);
    await expect(headline).not.toContainText(/public code/i);
    await expect(headline).not.toContainText(/Nearby|Rooms|Matches/i);

    await expect(page.getByText(/PRIDE PROMOTION/i)).toBeVisible();

    await expect(page.getByTestId('pride-invite-form')).toHaveCount(0);
    await expect(page.getByTestId('pride-claim-cta')).toBeVisible();
    await expect(page.getByTestId('pride-claim-cta')).toHaveText(/Claim Pride code/i);

    // Grant disclaimer next to the form / CTA (must not imply submit = Premium)
    const bargain = page.getByTestId('pride-invite-bargain');
    await expect(bargain).toBeVisible();
    await expect(bargain).toContainText(/Submitting the form sends the invite/i);
    await expect(bargain).toContainText(/It is not the grant/i);
    await expect(bargain).toContainText(/Enter the code at register/i);
    await expect(bargain).toContainText(/cannot use Premium before launch/i);
    await expect(bargain).not.toContainText(/PRIDE 3MONTH FREE/i);
    await expect(bargain).not.toContainText(/Brighton/i);

    // Parade photo under night/copper wash (claim face, not brochure)
    const bg = page.getByTestId('pride-bg-photo');
    await expect(bg).toBeAttached();
    await expect(bg).toHaveCSS('background-image', /21-pride-parade-flags\.jpeg/);
    await expect(page.getByTestId('pride-bg-wash')).toBeAttached();

    // No public printed-code CTA on the face
    await expect(page.getByTestId('pride-public-redeem-note')).toHaveCount(0);
    await expect(page.getByText(/PRIDE 3MONTH FREE/i)).toHaveCount(0);
    await expect(page.getByText(/Already have the printed public code/i)).toHaveCount(0);

    await page.getByTestId('pride-claim-cta').click();
    await expect(page.getByTestId('pride-invite-form')).toBeVisible();
    await expect(page.getByTestId('pride-invite-adult')).toBeVisible();
    await expect(page.getByTestId('pride-invite-email')).toBeVisible();
    await expect(page.getByTestId('pride-invite-submit')).toContainText(/Email my Pride code/i);
    await expect(page.getByText(/I confirm I am 18 or over/i)).toBeVisible();
    await expect(page.getByTestId('pride-invite-bargain')).toBeVisible();

    // No Path 2 card / second gold CTA
    await expect(page.getByTestId('pride-promo-code')).toHaveCount(0);
    await expect(page.getByTestId('pride-cta')).toHaveCount(0);
    await expect(page.getByTestId('pride-cta-note')).toHaveCount(0);
    await expect(page.getByTestId('pride-clock-public')).toHaveCount(0);
    await expect(page.getByText(/Create account & enter public code/i)).toHaveCount(0);
    await expect(page.getByText(/Copy code/i)).toHaveCount(0);
    await expect(page.getByText(/Path 2/i)).toHaveCount(0);
    await expect(page.getByText(/not in use|this code is dead|this code is invalid/i)).toHaveCount(0);

    // No Free app product essay on this claim page
    await expect(page.getByText(/Free app/i)).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /What you get at launch/i })).toHaveCount(0);

    // No Offer conditions block / numbered grant rules on the face
    await expect(page.getByTestId('pride-conditions')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /Offer conditions/i })).toHaveCount(0);
    await expect(page.getByTestId('pride-clock-invite')).toHaveCount(0);
    await expect(page.getByTestId('pride-grandfather')).toHaveCount(0);
    await expect(page.getByTestId('pride-duration-rule')).toHaveCount(0);
    await expect(page.getByTestId('pride-week-why')).toHaveCount(0);
    await expect(page.getByTestId('pride-promoter-slot')).toHaveCount(0);

    // Quiet Terms line only
    const termsApply = page.getByTestId('pride-terms-apply');
    await expect(termsApply).toBeVisible();
    await expect(termsApply).toContainText(/Terms and conditions apply\./i);
    await expect(page.getByTestId('pride-terms-link')).toHaveAttribute('href', '/terms');
    await expect(page.getByTestId('pride-terms-link')).toHaveText(/Terms and conditions apply\./i);

    // Brighton must not appear anywhere on /pride
    await expect(page.getByText(/Brighton/i)).toHaveCount(0);
    await expect(page.getByText(/brightonpride/i)).toHaveCount(0);
    await expect(page.locator('img[src*="brighton-pride-bunting"]')).toHaveCount(0);
    await expect(page.getByText(/Brighton Pride Special Offer/i)).toHaveCount(0);

    // No city-launch ticker
    await expect(page.getByText(/London · Manchester · Birmingham/i)).toHaveCount(0);
    await expect(page.getByText(/London \/ Birmingham \/ Manchester/i)).toHaveCount(0);

    await expect(page.getByText(/auto-renew/i)).toHaveCount(0);
    await expect(page.getByText(/CCBill/i)).toHaveCount(0);
    await expect(page.getByText(/Path 1/i)).toHaveCount(0);
    await expect(page.getByText(/Path 2/i)).toHaveCount(0);

    // Only one gold primary CTA on the page (Claim / Email my Pride code)
    await expect(page.getByTestId('pride-claim-cta').or(page.getByTestId('pride-invite-submit'))).toHaveCount(1);

    expect(network.expectNoSideEffects()).toEqual([]);
  });

  test('/terms holds Pride grant rules (no Brighton, no city list)', async ({ page }) => {
    const network = await guardAgainstSideEffects(page);
    await page.goto('/terms');

    const body = page.locator('main');
    await expect(body).toContainText(/7\.7/i);
    await expect(body).toContainText(/Pride promotional offer/i);
    await expect(body).toContainText(/21 to 31 August 2026/i);
    await expect(body).toContainText('PRIDE 3MONTH FREE');
    await expect(body).toContainText(/5 September 2026/i);
    await expect(body).toContainText(/earlier email/i);
    await expect(body).toContainText(/31 October 2026/i);
    await expect(body).toContainText(/3 months of Premium from launch/i);
    await expect(body).toContainText(/One grant per person/i);
    await expect(body).toContainText(/No stacking/i);
    await expect(body).toContainText(/clause 7\.2/i);
    await expect(body).toContainText(/18\+ only/i);
    await expect(body).toContainText(/UK-first/i);
    await expect(body).toContainText(/will not be billed for this offer/i);
    await expect(body).toContainText(/Southampton Pride/i);
    await expect(body).toContainText(/Manchester Village Pride/i);
    await expect(body).toContainText(/1 October 2026/i);
    await expect(body).toContainText(/1 January 2027/i);
    await expect(body).toContainText(/If launch slips/i);
    await expect(body).not.toContainText(/Brighton/i);
    await expect(body).not.toContainText(/London · Manchester · Birmingham/i);

    expect(network.expectNoSideEffects()).toEqual([]);
  });
});
