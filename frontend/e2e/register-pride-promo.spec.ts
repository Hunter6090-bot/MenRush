import { expect, test } from '@playwright/test';
import { guardAgainstSideEffects } from './support/network-guard';

test.describe('Register promo field', () => {
  test('promo is optional after required fields; no public-code dump', async ({ page }) => {
    const network = await guardAgainstSideEffects(page);
    await page.goto('/register?promo=PRIDE%203MONTH%20FREE');

    const username = page.getByTestId('register-username-input');
    const promo = page.getByTestId('register-promo-input');
    await expect(username).toBeVisible();
    await expect(promo).toBeVisible();
    await expect(promo).toHaveValue('PRIDE 3MONTH FREE');
    await expect(promo).toHaveAttribute('placeholder', 'If you have one');
    await expect(promo).toHaveAttribute('aria-label', 'Promo code');
    await expect(page.getByText(/^Promo code \(optional\)$/)).toBeVisible();

    // Username comes before the optional promo field in DOM order.
    const usernameBox = await username.boundingBox();
    const promoBox = await promo.boundingBox();
    expect(usernameBox && promoBox).toBeTruthy();
    expect(usernameBox!.y).toBeLessThan(promoBox!.y);

    const note = page.getByTestId('register-pride-note');
    await expect(note).toHaveText(/Optional\. If you have one\.?/i);
    await expect(note).not.toContainText(/Public code|31 October|PRIDE-XXXX|MENRUSH invite|stack|BSF26|BearScots|Pride/i);
    await expect(page.getByText(/PRIDE 3MONTH FREE or PRIDE-XXXX-XXXX/i)).toHaveCount(0);
    await expect(page.getByText(/You're in/i)).toHaveCount(0);

    const gift = page.getByTestId('register-gift-note');
    await expect(gift).toContainText(/Sign up before 1 October 2026/i);
    await expect(gift).toContainText(/30 days of Premium free/i);
    await expect(gift).toContainText(/A promo replaces that gift and does not stack/i);
    await expect(gift).not.toContainText(/—|–|BSF26|BearScots|Pride/i);

    await page.getByTestId('register-promo-clear').click();
    await expect(promo).toHaveValue('');

    await promo.fill('PRIDE-A3F7-B2C1');
    await expect(promo).toHaveValue('PRIDE-A3F7-B2C1');
    // Helper stays one short optional line — no personal-code legal dump.
    await expect(note).toHaveText(/Optional\. If you have one\.?/i);
    await expect(note).not.toContainText(/Personal emailed code|31 October|Do not also enter/i);

    expect(network.expectNoSideEffects()).toEqual([]);
  });

  test('?promo=BSF26 prefills quietly without advertising the fest', async ({ page }) => {
    const network = await guardAgainstSideEffects(page);
    await page.goto('/register?promo=BSF26');

    const promo = page.getByTestId('register-promo-input');
    await expect(promo).toBeVisible();
    await expect(promo).toHaveValue('BSF26');
    await expect(page.getByText(/^Promo code \(optional\)$/)).toBeVisible();
    await expect(page.getByTestId('register-pride-note')).toHaveText(/Optional\. If you have one\.?/i);
    // Quiet face: prefill is fine; do not market the fest on Register.
    await expect(page.getByText(/BearScotsFest/i)).toHaveCount(0);
    await expect(page.getByText(/Pride promo/i)).toHaveCount(0);

    expect(network.expectNoSideEffects()).toEqual([]);
  });

  test('?promo=MR3FREE prefills quietly without advertising the launch ad', async ({ page }) => {
    const network = await guardAgainstSideEffects(page);
    await page.goto('/register?promo=MR3FREE');

    const promo = page.getByTestId('register-promo-input');
    await expect(promo).toBeVisible();
    await expect(promo).toHaveValue('MR3FREE');
    await expect(page.getByText(/^Promo code \(optional\)$/)).toBeVisible();
    await expect(page.getByTestId('register-pride-note')).toHaveText(/Optional\. If you have one\.?/i);
    // Quiet face: prefill is fine; do not market the campaign on Register.
    await expect(page.getByText(/MenRush launch/i)).toHaveCount(0);
    await expect(page.getByText(/Pride promo/i)).toHaveCount(0);

    expect(network.expectNoSideEffects()).toEqual([]);
  });
});
