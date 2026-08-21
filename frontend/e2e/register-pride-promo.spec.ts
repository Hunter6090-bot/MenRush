import { expect, test } from '@playwright/test';
import { guardAgainstSideEffects } from './support/network-guard';

test.describe('Register Pride promo field', () => {
  test('promo box accepts public code and personal codes', async ({ page }) => {
    const network = await guardAgainstSideEffects(page);
    // Invite required in Playwright webServer — pass a placeholder invite to reach the form.
    await page.goto('/register?invite=MR-BETA-TEST1&promo=PRIDE%203MONTH%20FREE');

    const promo = page.getByTestId('register-promo-input');
    await expect(promo).toBeVisible();
    await expect(promo).toHaveValue('PRIDE 3MONTH FREE');
    await expect(page.getByTestId('register-pride-note')).toContainText(/Public code/i);
    await expect(page.getByTestId('register-pride-note')).toContainText(/5 September 2026/i);
    await expect(page.getByTestId('register-pride-note')).not.toContainText(
      /not in use|this code is dead|this code is invalid/i,
    );

    await page.getByTestId('register-promo-clear').click();
    await expect(promo).toHaveValue('');

    await promo.fill('PRIDE-A3F7-B2C1');
    await expect(page.getByTestId('register-pride-note')).toContainText(/Personal emailed code/i);
    await expect(page.getByTestId('register-pride-note')).toContainText(/31 October 2026/i);
    await expect(page.getByTestId('register-pride-note')).toContainText(
      /Do not also enter PRIDE 3MONTH FREE/i,
    );

    expect(network.expectNoSideEffects()).toEqual([]);
  });
});
