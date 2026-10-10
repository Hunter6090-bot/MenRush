import { expect, test } from '@playwright/test';
import { guardAgainstSideEffects } from './support/network-guard';

test.describe('Pride promotion landing', () => {
  test('/pride says the offer closed, no claim form, code holders sent to register', async ({
    page,
  }) => {
    const network = await guardAgainstSideEffects(page);
    await page.goto('/pride');

    await expect(page).toHaveTitle(/MenRush/);
    await expect(page.getByTestId('brand-mark').first()).toBeVisible();

    const headline = page.getByTestId('pride-headline-lock');
    await expect(headline).toHaveText(/Our Pride offer\s+closed\s+on 31 August/i);
    await expect(headline).not.toContainText(/3 months/i);
    await expect(headline).not.toContainText(/Premium/i);
    await expect(headline).not.toContainText(/from the day you join/i);
    await expect(headline).not.toContainText(/launch/i);
    await expect(page.getByText(/from the day you join/i)).toHaveCount(0);

    await expect(page.getByText(/PRIDE PROMOTION/i)).toBeVisible();

    // No claim form or claim CTA for new visitors
    await expect(page.getByTestId('pride-invite-form')).toHaveCount(0);
    await expect(page.getByTestId('pride-claim-cta')).toHaveCount(0);
    await expect(page.getByTestId('pride-invite-email')).toHaveCount(0);
    await expect(page.getByText(/Email my Pride code|Claim Pride code|Resend my Pride code/i)).toHaveCount(0);

    await expect(page.getByTestId('pride-closed-note')).toHaveText('New Pride codes are no longer available.');
    const redeem = page.getByTestId('pride-redeem-note');
    await expect(redeem).toHaveText(
      'Already have a Pride code from your email? Enter it at register with that same email by 31 October.',
    );
    await expect(redeem).toHaveCSS('font-size', '15px');
    const cta = page.getByTestId('pride-register-cta');
    await expect(cta).toHaveAttribute('href', '/register');
    const box = await cta.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);

    // Parade photo under night/copper wash (claim face, not brochure)
    const bg = page.getByTestId('pride-bg-photo');
    await expect(bg).toBeAttached();
    await expect(bg).toHaveCSS('background-image', /21-pride-parade-flags\.jpeg/);
    await expect(page.getByTestId('pride-bg-wash')).toBeAttached();

    // No public printed-code CTA on the face
    await expect(page.getByTestId('pride-public-redeem-note')).toHaveCount(0);
    await expect(page.getByText(/PRIDE 3MONTH FREE/i)).toHaveCount(0);
    await expect(page.getByText(/Already have the printed public code/i)).toHaveCount(0);

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
    await expect(page.getByText(/Path 1/i)).toHaveCount(0);
    await expect(page.getByText(/Path 2/i)).toHaveCount(0);

    // Only one gold primary CTA on the page (Create your account)
    await expect(page.getByTestId('pride-register-cta')).toHaveCount(1);

    expect(network.expectNoSideEffects()).toEqual([]);
  });

  test('/terms holds Pride grant rules (Brighton only as the code name, no city list)', async ({ page }) => {
    const network = await guardAgainstSideEffects(page);
    await page.goto('/terms');

    const body = page.locator('main');
    await expect(body).toContainText(/7\.7/i);
    await expect(body).toContainText(/Pride promotional offer/i);
    await expect(body).toContainText(/21 to 31 August 2026/i);
    await expect(body).toContainText('PRIDE 3MONTH FREE');
    await expect(body).toContainText(/5 September 2026/i);
    await expect(body).toContainText(
      'Brighton Pride personal promo codes sent by email, and MenRush Pride invites (MENRUSH codes)',
    );
    await expect(body).toContainText('The claim form closes at the same time.');
    await expect(body).toContainText(/refused from 1 November 2026/i);
    await expect(body).toContainText(/31 October 2026/i);
    await expect(body).toContainText('Redeeming a valid Pride code grants 3 months of Premium.');
    await expect(body).not.toContainText(/Premium from launch/i);
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
    await expect(body).toContainText(
      'For a code redeemed on or after 1 October 2026, Premium runs for 3 months from the day you register.',
    );
    await expect(body).toContainText('So if you have an unused Pride code, register by 31 October 2026.');
    await expect(body).not.toContainText(/If launch slips|booked before launch/i);
    await expect(body).toContainText(/7\.8/i);
    await expect(body).toContainText('BSF26');
    await expect(body).toContainText(/BearScotsFest 2026/i);
    await expect(body).toContainText(/not a general-purpose promo/i);
    await expect(body).toContainText(/Claim through end of 5 October 2026 Europe\/London inclusive/i);
    await expect(body).toContainText(/if redeemed before 1 October 2026/i);
    await expect(body).toContainText(/If redeemed on 1 October, Premium starts 1 October/i);
    await expect(body).toContainText(/2, 3, 4 or 5 October Europe\/London/i);
    await expect(body).toContainText(/One grant per person/i);
    await expect(body).toContainText(/No stacking/i);
    await expect(body).toContainText(/clause 7\.2/i);
    await expect(body).toContainText(/18\+ only/i);
    await expect(body).toContainText(/Bronze Apps UK Limited/i);
    await expect(body).toContainText(/7\.9/i);
    await expect(body).toContainText('MR3FREE');
    await expect(body).toContainText(/MenRush launch campaign/i);
    await expect(body).toContainText(/unlocked from day one/i);
    // Brand polish: public Terms must not name Al / pending lock / owner.
    await expect(body).not.toContainText(/pending Al/i);
    await expect(body).not.toContainText(/Al lock/i);
    await expect(body).not.toContainText(/\bAl\b/);
    // 7.7 names the Brighton Pride promo codes; nothing else may mention Brighton.
    expect((await body.innerText()).replace(/Brighton Pride personal promo codes/g, '')).not.toMatch(/Brighton/i);
    await expect(body).not.toContainText(/London · Manchester · Birmingham/i);

    expect(network.expectNoSideEffects()).toEqual([]);
  });
});
