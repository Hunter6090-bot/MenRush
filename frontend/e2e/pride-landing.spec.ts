import { expect, test } from '@playwright/test';
import { guardAgainstSideEffects } from './support/network-guard';

test.describe('Pride promotion landing', () => {
  test('/pride shows Legal-locked three-path offer and two claim-by clocks', async ({ page }) => {
    const network = await guardAgainstSideEffects(page);
    await page.goto('/pride');

    await expect(page).toHaveTitle(/MenRush/);
    await expect(page.getByTestId('brand-mark').first()).toBeVisible();

    await expect(page.getByRole('heading', { level: 1 })).toContainText(/3 Months Free/i);

    const headline = page.getByTestId('pride-headline-lock');
    await expect(headline).toContainText(/One Pride grant/i);
    await expect(headline).toContainText(/21–31 August 2026/i);
    await expect(headline).toContainText(/cannot use Premium before launch/i);
    await expect(headline).toContainText(/31 August is not the end of Premium/i);
    await expect(headline).not.toContainText(/this week/i);
    // Duration detail lives once in conditions — not a conflicting second rule in the hero
    await expect(headline).not.toContainText(/first redeem after open/i);

    await expect(page.getByTestId('pride-week-why')).toContainText(/21–31 August 2026/i);
    await expect(page.getByTestId('pride-week-why')).toContainText(/Southampton Pride/i);
    await expect(page.getByTestId('pride-week-why')).toContainText(/Manchester Village Pride/i);
    await expect(page.getByTestId('pride-week-why')).toContainText(/not a sponsor/i);
    await expect(page.getByTestId('pride-week-why')).not.toContainText(/unique-invite week/i);

    // Path 1 on the face (invite window open on 21 Aug 2026)
    const invitePath = page.getByTestId('pride-invite-path');
    await expect(invitePath).toContainText(/Path 1/i);
    const bargain = page.getByTestId('pride-invite-bargain');
    await expect(bargain).toContainText(/Pride-flagged beta invite/i);
    await expect(bargain).toContainText(/not the grant/i);
    await expect(bargain).toContainText(/Enter that invite at register/i);
    await expect(bargain).toContainText(/Do not also enter/i);
    await expect(bargain).toContainText('PRIDE 3MONTH FREE');
    await expect(bargain).toContainText(/Brighton personal PRIDE-XXXX-XXXX/i);
    await expect(bargain).toContainText(/One person gets one Pride grant/i);
    await expect(page.getByTestId('pride-invite-form')).toBeVisible();
    await expect(page.getByTestId('pride-invite-adult')).toBeVisible();

    // Path 2 on the face
    const codeBox = page.getByTestId('pride-promo-code');
    await expect(codeBox).toContainText(/Path 2/i);
    await expect(codeBox).toContainText('PRIDE 3MONTH FREE');
    await expect(codeBox.getByText('PRIDE3MONTHFREE')).toHaveCount(0);
    await expect(page.getByTestId('pride-public-path')).toContainText(/by 5 September 2026/i);
    await expect(page.getByTestId('pride-public-path')).toContainText(/Printed material/i);

    // Grandfather — do not promote Brighton campaign
    const grandfather = page.getByTestId('pride-grandfather');
    await expect(grandfather).toContainText(
      /Already have a personal Brighton Pride code \(PRIDE-XXXX-XXXX\) from an earlier email/i,
    );
    await expect(grandfather).toContainText(/redeem by 31\s*October\s*2026/i);
    await expect(grandfather).toContainText(/Clear any pre-filled public or new invite code/i);
    await expect(grandfather).toContainText(/One person gets one Pride grant/i);

    await expect(page.getByText(/Brighton Pride Special Offer/i)).toHaveCount(0);
    await expect(page.getByText(/brightonpride/i)).toHaveCount(0);
    await expect(page.locator('img[src*="brighton-pride-bunting"]')).toHaveCount(0);

    const conditions = page.getByTestId('pride-conditions');
    await expect(page.getByTestId('pride-clock-invite')).toContainText(/21–31 August 2026/i);
    await expect(page.getByTestId('pride-clock-invite')).toContainText(/at register/i);
    await expect(page.getByTestId('pride-clock-public')).toContainText(/5 September 2026/);
    await expect(page.getByTestId('pride-clock-public')).toContainText(/last day to/);
    await expect(conditions).toContainText(/Submitting the email form sends a Pride-flagged invite/i);
    await expect(conditions).toContainText(/grant happens when you enter/i);
    // Killed false lines
    await expect(page.getByText(/Joining the waitlist alone does not redeem/i)).toHaveCount(0);
    await expect(page.getByText(/The waitlist form does not redeem the code/i)).toHaveCount(0);
    await expect(page.getByText(/waitlist form does not redeem/i)).toHaveCount(0);

    const duration = page.getByTestId('pride-duration-rule');
    await expect(duration).toContainText(/if you book before launch, Premium starts at launch/i);
    await expect(duration).toContainText(/On-time open 1 October 2026/i);
    await expect(duration).toContainText(/ends 1 January 2027/i);
    await expect(duration).toContainText(/If launch slips, 3 months from the actual open date/i);
    await expect(duration).toContainText(/not still 1 January 2027/i);
    await expect(duration).toContainText(
      /If you first enter after MenRush is open, 3 months from that redeem date/i,
    );
    await expect(conditions).toContainText(/Terms 7\.2/i);
    await expect(conditions).toContainText(/does not add to that gift/i);
    await expect(conditions).toContainText(/18\+/);
    await expect(conditions).toContainText(/UK-first/i);
    await expect(conditions).toContainText(/Three months of Premium at no charge/i);
    await expect(conditions).toContainText(/will not be billed for this offer/i);
    await expect(page.getByText(/auto-renew/i)).toHaveCount(0);
    await expect(page.getByText(/CCBill/i)).toHaveCount(0);
    await expect(page.getByText(/90 days/i)).toHaveCount(0);
    await expect(page.getByText(/31 December 2026/i)).toHaveCount(0);
    await expect(page.getByText(/RM6 6AX/i)).toHaveCount(0);

    const promoter = page.getByTestId('pride-promoter-slot');
    await expect(promoter).toContainText(/Bronze Apps UK Limited \(trading as MenRush\)/i);
    await expect(page.getByTestId('pride-terms-link')).toHaveAttribute('href', '/terms');

    const cta = page.getByTestId('pride-cta');
    await expect(cta).toHaveAttribute('href', /\/register\?promo=/);
    await expect(cta).toContainText(/Create account/i);

    const ctaNote = page.getByTestId('pride-cta-note');
    await expect(ctaNote).toContainText(/Enter PRIDE 3MONTH FREE at register by 5 September 2026/i);
    await expect(ctaNote).not.toContainText(/alone does not redeem/i);

    await expect(page.getByRole('heading', { name: /What you get at launch/i })).toBeVisible();
    await expect(page.getByText(/See who is around you when MenRush opens/i)).toBeVisible();
    await expect(page.getByText(/right now — live proximity/i)).toHaveCount(0);

    expect(network.expectNoSideEffects()).toEqual([]);
  });
});
