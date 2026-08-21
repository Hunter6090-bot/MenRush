import { expect, test } from '@playwright/test';
import { guardAgainstSideEffects } from './support/network-guard';

test.describe('Register Pride promo field', () => {
  test('retired public code is not prefilled; personal codes still work', async ({ page }) => {
    const network = await guardAgainstSideEffects(page);
    // Invite required in Playwright webServer — pass a placeholder invite to reach the form.
    await page.goto('/register?invite=MR-BETA-TEST1&promo=PRIDE%203MONTH%20FREE');

    const promo = page.getByTestId('register-promo-input');
    await expect(promo).toBeVisible();
    // Public code retired: do not seed the box from ?promo=
    await expect(promo).toHaveValue('');
    await expect(page.getByTestId('register-pride-note')).toContainText(/Personal emailed PRIDE-XXXX-XXXX/i);
    await expect(page.getByTestId('register-pride-note')).not.toContainText(/Public code/i);
    await expect(page.getByTestId('register-pride-note')).not.toContainText(/PRIDE 3MONTH FREE/i);

    await promo.fill('PRIDE 3MONTH FREE');
    await expect(page.getByTestId('register-pride-note')).toContainText(
      /This code is not in use\. Claim from \/pride with your email/i,
    );

    await page.getByTestId('register-promo-clear').click();
    await expect(promo).toHaveValue('');

    await promo.fill('PRIDE-A3F7-B2C1');
    await expect(page.getByTestId('register-pride-note')).toContainText(/Personal emailed code/i);
    await expect(page.getByTestId('register-pride-note')).toContainText(/31 October 2026/i);
    await expect(page.getByTestId('register-pride-note')).not.toContainText(/PRIDE 3MONTH FREE/i);

    expect(network.expectNoSideEffects()).toEqual([]);
  });
});
