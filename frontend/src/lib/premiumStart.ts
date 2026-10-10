/** Same day count as the server (PREMIUM_CANCELLATION_DAYS). */
const CANCELLATION_DAYS = 14;

function londonDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/London' });
}

/** The start date the member gets, shown before the invoice is issued (Terms 7.6A). */
export function premiumStartLine(immediate: boolean, now: Date = new Date()): string {
  if (immediate) return 'Your Premium starts as soon as we confirm your payment.';
  const end = new Date(now.getTime() + CANCELLATION_DAYS * 24 * 60 * 60 * 1000);
  return `Your Premium starts on ${londonDate(end)}, after the 14 day cancellation period, or when we confirm your payment if that is later.`;
}

