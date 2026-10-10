/** Matches backend ACTIVE_CHECKIN_TTL_HOURS. */
export const EVENT_CHECKIN_TTL_HOURS = 4;

/**
 * Notice after an event check-in. A Ghost or hidden member gets
 * `{ spot: null, deferred: true }`: nothing was written, so never claim a pin.
 */
export function eventCheckInNotice(
  data: { spot?: unknown | null; deferred?: boolean } | null | undefined,
  venue: string,
): string {
  return data?.spot
    ? `Checked in at ${venue}. Pin stays on the map for ${EVENT_CHECKIN_TTL_HOURS} hours.`
    : `You're in Ghost or hidden, so you weren't checked in and no pin was added at ${venue}.`;
}
