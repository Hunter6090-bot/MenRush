/**
 * The one Premium price list. The server sets every invoice amount and length
 * from here; the member API refuses any amount or days a client sends.
 * Ops can override per invoice (admin only, logged).
 */
export const PREMIUM_PRICE_LIST = {
  premium: { amountPence: 699, planDays: 30, currency: 'GBP' },
} as const;

export type PricedTier = keyof typeof PREMIUM_PRICE_LIST;

/** Terms 7.6A / 8.1: a Premium purchase can be cancelled within this many days of buying it. */
export const PREMIUM_CANCELLATION_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

/** End of the cancellation period for a purchase made at `boughtAt`. */
export function cancellationPeriodEnd(boughtAt: Date): Date {
  return new Date(boughtAt.getTime() + PREMIUM_CANCELLATION_DAYS * DAY_MS);
}

/**
 * When paid Premium starts (Terms 7.6A):
 *  - member asked to start as soon as payment is confirmed: when payment is confirmed;
 *  - otherwise: once the 14-day cancellation period from buying has ended
 *    (or at confirmation, if that is later).
 */
export function paidPremiumStartsAt(params: {
  boughtAt: Date;
  confirmedAt: Date;
  immediateStartConsent: boolean;
}): Date {
  if (params.immediateStartConsent) return params.confirmedAt;
  const end = cancellationPeriodEnd(params.boughtAt);
  return end.getTime() > params.confirmedAt.getTime() ? end : params.confirmedAt;
}
