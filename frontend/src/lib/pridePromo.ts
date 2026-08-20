/** Public Pride promo — printed QR lands on /pride. */

export const PRIDE_PROMO_CODE = 'PRIDE 3MONTH FREE';
/** Internal match key after stripping spaces — do not print this as a second public code. */
export const PRIDE_PROMO_NORMALIZED = 'PRIDE3MONTHFREE';
export const PRIDE_ENTER_BY = '5 September 2026';
export const PRIDE_PREMIUM_START = '1 October 2026';
export const PRIDE_PREMIUM_END = '31 December 2026';
export const PRIDE_STORAGE_KEY = 'menrush_pride_promo';

/** Normalise typed codes (spaces ignored; case-insensitive). */
export function normalizePridePromoCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

export function isPridePromoCode(raw: string): boolean {
  return normalizePridePromoCode(raw) === PRIDE_PROMO_NORMALIZED;
}

export function storePridePromoCode(code: string = PRIDE_PROMO_CODE): void {
  try {
    localStorage.setItem(PRIDE_STORAGE_KEY, code);
  } catch {
    /* ignore */
  }
}

export function readStoredPridePromoCode(): string {
  try {
    return localStorage.getItem(PRIDE_STORAGE_KEY)?.trim() || '';
  } catch {
    return '';
  }
}
