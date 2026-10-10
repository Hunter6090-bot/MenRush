/** Matches backend ACTIVE_CHECKIN_TTL_HOURS. */
export const EVENT_CHECKIN_TTL_HOURS = 4;

/**
 * Notice after an event check-in. Only a visible member is told about the pin.
 * - Ghost / hidden and first at the venue: `{ spot: null, deferred: true }`. Nothing
 *   was written, so they were not checked in and no pin was added.
 * - Ghost / hidden at a venue that already has a pin: `{ spot, unseen: true }`. They
 *   are checked in on the existing pin but never add to its live count (#368), and
 *   no pin was added for them, so never the 4 hour pin line.
 */
export function eventCheckInNotice(
  data: { spot?: unknown | null; deferred?: boolean; unseen?: boolean } | null | undefined,
  venue: string,
): string {
  if (!data?.spot || data.deferred) {
    return `You're in Ghost or hidden, so you weren't checked in and no pin was added at ${venue}.`;
  }
  if (data.unseen) {
    return `You're in Ghost or hidden, so you checked in at ${venue} without adding to its live count. No pin was added for you.`;
  }
  return `Checked in at ${venue}. Pin stays on the map for ${EVENT_CHECKIN_TTL_HOURS} hours.`;
}
