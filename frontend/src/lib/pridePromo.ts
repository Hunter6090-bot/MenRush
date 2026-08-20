/** Shared Pride campaign promo — display on /pride; redemption not wired yet. */

export const PRIDE_PROMO_DISPLAY = 'PRIDE 3MONTH FREE';
export const PRIDE_PROMO_COMPACT = 'PRIDE3MONTHFREE';
export const PRIDE_PROMO_EXPIRES = '5 September 2026';

/** Normalise typed codes so spaced and compact variants match. */
export function normalizePridePromoCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

export function isPridePromoCode(raw: string): boolean {
  return normalizePridePromoCode(raw) === PRIDE_PROMO_COMPACT;
}
