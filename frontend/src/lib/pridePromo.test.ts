import { describe, expect, it } from 'vitest';
import {
  isPridePromoCode,
  looksLikePersonalPrideCode,
  normalizePridePromoCode,
  PRIDE_PROMO_CODE,
  PRIDE_PROMO_NORMALIZED,
} from '../lib/pridePromo';

describe('pridePromo', () => {
  it('normalises spaced display code to the backend key', () => {
    expect(normalizePridePromoCode(PRIDE_PROMO_CODE)).toBe(PRIDE_PROMO_NORMALIZED);
    expect(normalizePridePromoCode('  pride 3month free  ')).toBe(PRIDE_PROMO_NORMALIZED);
    expect(normalizePridePromoCode('PRIDE3MONTHFREE')).toBe(PRIDE_PROMO_NORMALIZED);
  });

  it('accepts the printed display string and compact typed form', () => {
    expect(isPridePromoCode(PRIDE_PROMO_CODE)).toBe(true);
    expect(isPridePromoCode('PRIDE3MONTHFREE')).toBe(true);
    expect(isPridePromoCode('PRIDE-XXXX-YYYY')).toBe(false);
  });

  it('detects personal emailed codes without treating the public code as personal', () => {
    expect(looksLikePersonalPrideCode('PRIDE-A3F7-B2C1')).toBe(true);
    expect(looksLikePersonalPrideCode('pride-a3f7-b2c1')).toBe(true);
    expect(looksLikePersonalPrideCode(PRIDE_PROMO_CODE)).toBe(false);
    expect(looksLikePersonalPrideCode('MENRUSH-A3F7-B2C1')).toBe(false);
  });
});
