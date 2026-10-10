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


/** Start line for an invoice already issued, from the member's recorded choice. */
export function invoiceStartLine(invoice: {
  immediate_start_consent_at?: string | null;
  requested_at?: string;
  created_at: string;
}): string {
  return premiumStartLine(Boolean(invoice.immediate_start_consent_at), new Date(invoice.requested_at ?? invoice.created_at));
}

/** Shown on /premium once a delayed-start invoice is paid. */
export function pendingStartLine(startsAt: string | Date): string {
  return `Your payment has arrived. Your Premium starts on ${londonDate(new Date(startsAt))}, after the 14 day cancellation period.`;
}
