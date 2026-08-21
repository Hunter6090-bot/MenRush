import { describe, expect, it } from 'vitest';
import {
  isPrideInviteIssueOpen,
  isPridePromoCode,
  looksLikePersonalPrideCode,
  normalizePridePromoCode,
  PRIDE_INVITE_ISSUE_CLOSES,
  PRIDE_INVITE_ISSUE_OPENS,
  PRIDE_PROMO_CODE,
  PRIDE_PROMO_NORMALIZED,
  PRIDE_PUBLIC_CODE_RETIRED_MESSAGE,
} from '../lib/pridePromo';

describe('pridePromo', () => {
  it('normalises spaced display code to the backend key', () => {
    expect(normalizePridePromoCode(PRIDE_PROMO_CODE)).toBe(PRIDE_PROMO_NORMALIZED);
    expect(normalizePridePromoCode('  pride 3month free  ')).toBe(PRIDE_PROMO_NORMALIZED);
    expect(normalizePridePromoCode('PRIDE3MONTHFREE')).toBe(PRIDE_PROMO_NORMALIZED);
  });

  it('detects the retired public code string for reject UX', () => {
    expect(isPridePromoCode(PRIDE_PROMO_CODE)).toBe(true);
    expect(isPridePromoCode('PRIDE3MONTHFREE')).toBe(true);
    expect(isPridePromoCode('PRIDE-XXXX-YYYY')).toBe(false);
    expect(PRIDE_PUBLIC_CODE_RETIRED_MESSAGE).toMatch(/not in use/i);
    expect(PRIDE_PUBLIC_CODE_RETIRED_MESSAGE).toMatch(/\/pride/i);
  });

  it('detects personal emailed codes without treating the public code as personal', () => {
    expect(looksLikePersonalPrideCode('PRIDE-A3F7-B2C1')).toBe(true);
    expect(looksLikePersonalPrideCode('pride-a3f7-b2c1')).toBe(true);
    expect(looksLikePersonalPrideCode(PRIDE_PROMO_CODE)).toBe(false);
    expect(looksLikePersonalPrideCode('MENRUSH-A3F7-B2C1')).toBe(false);
  });

  it('opens Pride-flagged invite issue only 21–31 Aug 2026 UK', () => {
    expect(isPrideInviteIssueOpen(new Date('2026-08-20T22:59:59Z'))).toBe(false);
    expect(isPrideInviteIssueOpen(PRIDE_INVITE_ISSUE_OPENS)).toBe(true);
    expect(isPrideInviteIssueOpen(new Date('2026-08-25T12:00:00Z'))).toBe(true);
    expect(isPrideInviteIssueOpen(PRIDE_INVITE_ISSUE_CLOSES)).toBe(true);
    expect(isPrideInviteIssueOpen(new Date('2026-08-31T23:00:00Z'))).toBe(false);
    expect(isPrideInviteIssueOpen(new Date('2026-09-01T00:00:00Z'))).toBe(false);
  });
});
