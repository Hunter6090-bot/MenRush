import { expect, test } from '@playwright/test';
import { guardAgainstSideEffects } from './support/network-guard';

test.describe('Pride promotion landing', () => {
  test('/pride short face + grant disclaimer next to form (no Path 2, no Free app)', async ({
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

    // Quiet printed-code line on the face
    const publicNote = page.getByTestId('pride-public-redeem-note');
    await expect(publicNote).toBeVisible();
    await expect(publicNote).toContainText('PRIDE 3MONTH FREE');
    await expect(publicNote).toContainText(/5 September 2026/i);
    await expect(publicNote).toContainText(/still works at register/i);
    await expect(publicNote).toContainText(/One grant/i);
    await expect(publicNote).toContainText(/Do not also claim a new Pride invite/i);

    await page.getByTestId('pride-claim-cta').click();
    await expect(page.getByTestId('pride-invite-form')).toBeVisible();
    await expect(page.getByTestId('pride-invite-adult')).toBeVisible();
    await expect(page.getByTestId('pride-invite-email')).toBeVisible();
    await expect(page.getByTestId('pride-invite-submit')).toContainText(/Email my Pride code/i);
    await expect(page.getByText(/I confirm I am 18 or over/i)).toBeVisible();
    // Disclaimer stays next to the open form
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

    const conditions = page.getByTestId('pride-conditions');
    await expect(page.getByTestId('pride-clock-invite')).toContainText(/21–31 August 2026/i);
    await expect(page.getByTestId('pride-clock-invite')).toContainText(/Resend/i);
    await expect(page.getByTestId('pride-clock-invite')).toContainText(
      /31 August ends new invites, not Premium/i,
    );
    await expect(conditions).toContainText('PRIDE 3MONTH FREE');
    await expect(conditions).toContainText(/5 September 2026/i);

    const grandfather = page.getByTestId('pride-grandfather');
    await expect(grandfather).toContainText(/personal PRIDE-XXXX-XXXX/i);
    await expect(grandfather).toContainText(/31 October 2026/i);
    await expect(grandfather).toContainText(/No new Brighton Pride codes/i);
    await expect(conditions).toContainText(/18\+ only\. UK-first\./i);
    await expect(conditions).not.toContainText(/London · Manchester · Birmingham/i);
    await expect(grandfather).toContainText(/One grant per person/i);
    await expect(page.getByText(/Brighton Pride Special Offer/i)).toHaveCount(0);
    await expect(page.getByText(/brightonpride/i)).toHaveCount(0);
    await expect(page.locator('img[src*="brighton-pride-bunting"]')).toHaveCount(0);

    const duration = page.getByTestId('pride-duration-rule');
    await expect(duration).toContainText(/book before launch/i);
    await expect(duration).toContainText(/Premium starts at launch/i);
    await expect(duration).toContainText(/1 October 2026/i);
    await expect(duration).toContainText(/Ends 1 January 2027/i);
    await expect(duration).toContainText(/If launch slips/i);
    await expect(duration).toContainText(/First enter after open/i);
    await expect(duration).not.toContainText('→');
    await expect(conditions).toContainText(/One Pride grant/i);
    await expect(conditions).toContainText(/Terms 7\.2/i);
    await expect(conditions).toContainText(/18\+/);
    await expect(conditions).toContainText(/will not be billed for this offer/i);

    await expect(page.getByTestId('pride-week-why')).toContainText(/not a sponsor/i);
    await expect(page.getByTestId('pride-week-why')).toContainText(/Southampton Pride/i);
    await expect(page.getByTestId('pride-week-why')).toContainText(/Manchester Village Pride/i);

    await expect(page.getByText(/auto-renew/i)).toHaveCount(0);
    await expect(page.getByText(/CCBill/i)).toHaveCount(0);
    await expect(page.getByText(/Path 1/i)).toHaveCount(0);
    await expect(page.getByText(/Path 2/i)).toHaveCount(0);

    // Only one gold primary CTA on the page (Claim / Email my Pride code)
    await expect(page.getByTestId('pride-claim-cta').or(page.getByTestId('pride-invite-submit'))).toHaveCount(1);

    const promoter = page.getByTestId('pride-promoter-slot');
    await expect(promoter).toContainText(/Bronze Apps UK Limited \(trading as MenRush\)/i);
    await expect(page.getByTestId('pride-terms-link')).toHaveAttribute('href', '/terms');

    expect(network.expectNoSideEffects()).toEqual([]);
  });
});
