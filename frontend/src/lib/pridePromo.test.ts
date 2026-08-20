import { describe, expect, it } from 'vitest';
import {
  isPridePromoCode,
  normalizePridePromoCode,
  PRIDE_PROMO_COMPACT,
  PRIDE_PROMO_DISPLAY,
} from '../lib/pridePromo';

describe('pridePromo', () => {
  it('normalises spaced and compact variants to the same key', () => {
    expect(normalizePridePromoCode(PRIDE_PROMO_DISPLAY)).toBe(PRIDE_PROMO_COMPACT);
    expect(normalizePridePromoCode('  pride 3month free  ')).toBe(PRIDE_PROMO_COMPACT);
    expect(normalizePridePromoCode('PRIDE3MONTHFREE')).toBe(PRIDE_PROMO_COMPACT);
  });

  it('accepts both display and compact forms', () => {
    expect(isPridePromoCode(PRIDE_PROMO_DISPLAY)).toBe(true);
    expect(isPridePromoCode(PRIDE_PROMO_COMPACT)).toBe(true);
    expect(isPridePromoCode('PRIDE-XXXX-YYYY')).toBe(false);
  });
});
