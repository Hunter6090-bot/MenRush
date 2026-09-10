/**
 * Nearby "NEW" joiners — account age only (privacy-safe).
 * Window is fixed so Grid badges / Status filter stay honest across soft-refresh.
 *
 * Brand signed face (Sep 2026):
 * - Pill/badge: `NEW`
 * - Alt/helper: `Just joined`
 * Chat inbox NEW stays parked — different feature.
 */

/** Accounts created within this many days show the Nearby NEW treatment. */
export const NEW_JOINER_WINDOW_DAYS = 7;

/** Brand-signed pill/badge face on Nearby Grid + Map. */
export const NEW_JOINER_LABEL = 'NEW';

/** Brand-signed alt/helper line (aria-label, screen reader, tooltips). */
export const NEW_JOINER_HELPER = 'Just joined';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function newJoinerWindowMs(days: number = NEW_JOINER_WINDOW_DAYS): number {
  return days * MS_PER_DAY;
}

/**
 * True when `created_at` falls within the NEW window (default 7 days).
 * Missing/invalid timestamps → not new (never invent NEW).
 */
export function isNewlyJoined(
  createdAt: string | Date | null | undefined,
  nowMs: number = Date.now(),
  windowDays: number = NEW_JOINER_WINDOW_DAYS,
): boolean {
  if (createdAt == null || createdAt === '') return false;
  const ts = createdAt instanceof Date ? createdAt.getTime() : new Date(createdAt).getTime();
  if (!Number.isFinite(ts)) return false;
  if (ts > nowMs) return false; // clock skew / future → not NEW
  return nowMs - ts <= newJoinerWindowMs(windowDays);
}

export function createdAtMs(createdAt: string | Date | null | undefined): number {
  if (createdAt == null || createdAt === '') return 0;
  const ts = createdAt instanceof Date ? createdAt.getTime() : new Date(createdAt).getTime();
  return Number.isFinite(ts) ? ts : 0;
}
