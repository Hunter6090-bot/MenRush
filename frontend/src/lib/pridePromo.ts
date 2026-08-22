/** Pride promo helpers. Printed public code redeemable at register by 5 Sep 2026. */

export const PRIDE_PROMO_CODE = 'PRIDE 3MONTH FREE';
/** Internal match key after stripping spaces. Do not print as a second public code. */
export const PRIDE_PROMO_NORMALIZED = 'PRIDE3MONTHFREE';
export const PRIDE_ENTER_BY = '5 September 2026';
/** User-facing error after the public enter-by window. */
export const PRIDE_PUBLIC_CODE_EXPIRED_MESSAGE =
  'This Pride promo expired on 5 September 2026.';
export const PRIDE_PREMIUM_START = '1 October 2026';
/** On-time end only (1 Oct open → 1 Jan). If launch slips, grant end moves with actual open. */
export const PRIDE_PREMIUM_END = '1 January 2027';
export const PRIDE_STORAGE_KEY = 'menrush_pride_promo';

/** Pride-flagged invite issue window (UK): 21 Aug 00:00 BST → end of 31 Aug BST. */
export const PRIDE_INVITE_ISSUE_OPENS = new Date('2026-08-20T23:00:00Z');
export const PRIDE_INVITE_ISSUE_CLOSES = new Date('2026-08-31T22:59:59Z');
export const PRIDE_INVITE_WINDOW_LABEL = '21 to 31 August 2026';
export const PRIDE_INVITE_CAMPAIGN_ID = 'pride26_waitlist';

export function isPrideInviteIssueOpen(now = new Date()): boolean {
  const t = now.getTime();
  return t >= PRIDE_INVITE_ISSUE_OPENS.getTime() && t <= PRIDE_INVITE_ISSUE_CLOSES.getTime();
}

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

export function clearStoredPridePromoCode(): void {
  try {
    localStorage.removeItem(PRIDE_STORAGE_KEY);
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

/** Personal emailed codes look like PRIDE-XXXX-XXXX (not the public spaced code). */
export function looksLikePersonalPrideCode(raw: string): boolean {
  const trimmed = raw.trim().toUpperCase();
  if (!trimmed || isPridePromoCode(trimmed)) return false;
  return /^PRIDE-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(trimmed);
}
