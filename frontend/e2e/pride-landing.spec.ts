import { expect, test } from '@playwright/test';
import { guardAgainstSideEffects } from './support/network-guard';

test.describe('Pride promotion landing', () => {
  test('/pride main CTA is waitlist email for MENRUSH invite with Premium from launch', async ({
    page,
  }) => {
    const network = await guardAgainstSideEffects(page);
    await page.goto('/pride');

    await expect(page).toHaveTitle(/MenRush/);
    await expect(page.getByTestId('brand-mark').first()).toBeVisible();

    await expect(page.getByRole('heading', { level: 1 })).toContainText(/3 Months Free/i);

    const headline = page.getByTestId('pride-headline-lock');
    await expect(headline).toContainText(/Join this Pride waitlist/i);
    await expect(headline).toContainText('MENRUSH-XXXX');
    await expect(headline).toContainText(/3 months of Premium from launch/i);
    await expect(headline).toContainText(/If MenRush opens on 1 October 2026, Premium ends 1 January 2027/i);
    await expect(headline).toContainText(/If launch slips, the 3 months run from the actual open date/i);
    await expect(headline).toContainText(/cannot use Premium before launch/i);

    // Legal grandfather for already-issued personal Brighton codes
    const grandfather = page.getByTestId('pride-grandfather');
    await expect(grandfather).toContainText(
      /If you already received a personal Brighton Pride code by email, enter that code at register on the same email/i,
    );
    await expect(grandfather).toContainText(/redeem by 31\s*October\s*2026/i);
    await expect(grandfather).toContainText(/Do not also enter PRIDE 3MONTH FREE/i);
    await expect(grandfather).toContainText(/One person gets one Pride grant/i);

    await expect(page.getByText(/brightonpride/i)).toHaveCount(0);
    await expect(page.getByText(/Brighton Pride Special Offer/i)).toHaveCount(0);
    await expect(page.locator('img[src*="brighton-pride-bunting"]')).toHaveCount(0);

    // Main CTA: waitlist form (not register-with-public-code)
    const form = page.getByTestId('pride-waitlist-form');
    await expect(form).toBeVisible();
    await expect(page.getByTestId('pride-waitlist-email')).toBeVisible();
    await expect(page.getByTestId('pride-adult-confirm')).toBeVisible();
    const cta = page.getByTestId('pride-cta');
    await expect(cta).toContainText(/Get my invite/i);
    await expect(cta).not.toHaveAttribute('href', /./);

    const ctaNote = page.getByTestId('pride-cta-note');
    await expect(ctaNote).toContainText(/21 to 31 August 2026/i);
    await expect(ctaNote).toContainText(/stops issuing new invites/i);

    // Secondary public code path
    const codeBox = page.getByTestId('pride-promo-code');
    await expect(codeBox).toContainText('PRIDE 3MONTH FREE');
    await expect(codeBox).toContainText(/Secondary path/i);
    await expect(codeBox.getByText('PRIDE3MONTHFREE')).toHaveCount(0);
    await expect(page.getByTestId('pride-secondary-register')).toHaveAttribute(
      'href',
      /\/register\?promo=/,
    );

    const conditions = page.getByTestId('pride-conditions');
    await expect(conditions).toContainText(/31 August 2026/i);
    await expect(conditions).toContainText(/MENRUSH/i);
    await expect(conditions).toContainText(/Terms 7\.2/i);
    await expect(conditions).toContainText(/does not add to that gift/i);
    await expect(conditions).toContainText(/18\+/);
    await expect(conditions).toContainText(/UK-first/i);
    const duration = page.getByTestId('pride-duration-rule');
    await expect(duration).toContainText(/if MenRush opens on 1 October 2026, Premium ends 1 January 2027/i);
    await expect(duration).toContainText(/Not still 1 January 2027/i);

    await expect(page.getByText(/auto-renew/i)).toHaveCount(0);
    await expect(page.getByText(/CCBill/i)).toHaveCount(0);
    await expect(page.getByText(/90 days/i)).toHaveCount(0);
    await expect(page.getByText(/RM6 6AX/i)).toHaveCount(0);
    await expect(page.getByText(/17249857/)).toHaveCount(0);

    const promoter = page.getByTestId('pride-promoter-slot');
    await expect(promoter).toContainText(/Bronze Apps UK Limited \(trading as MenRush\)/i);
    await expect(page.getByTestId('pride-terms-link')).toHaveAttribute('href', '/terms');

    await expect(page.getByRole('heading', { name: /What you get at launch/i })).toBeVisible();
    await expect(page.getByText(/See who is around you when MenRush opens/i)).toBeVisible();
    await expect(page.getByText(/right now — live proximity/i)).toHaveCount(0);

    // No em dashes in user-facing Pride copy blocks
    const bodyText = await page.locator('main').innerText();
    expect(bodyText).not.toMatch(/\u2014/);

    expect(network.expectNoSideEffects()).toEqual([]);
  });
});
