/**
 * Nearby fresh-face treatment — newly joined accounts AND visitor boost.
 *
 * Brand lock (confirmed): visitors share the same face as joiners.
 * - Pill/badge: `NEW`
 * - Alt/helper: `Just joined`
 * Do not invent a separate visitor pill/label.
 *
 * Account-age NEW: created within NEW_JOINER_WINDOW_DAYS (7).
 * Visitor NEW: backend visitor_expires_at still in the future (VISITOR_TTL_HOURS=48
 * documented on backend; client trusts the flag/expiry only).
 *
 * Chat inbox NEW stays parked — different feature.
 */

/** Accounts created within this many days show the Nearby NEW treatment. */
export const NEW_JOINER_WINDOW_DAYS = 7;

/** Brand-signed pill/badge face on Nearby Grid + Map. */
export const NEW_JOINER_LABEL = 'NEW';

/** Brand-signed alt/helper line (aria-label, screen reader, tooltips). */
export const NEW_JOINER_HELPER = 'Just joined';

/** Mirrors backend VISITOR_TTL_HOURS — documentation only; UI uses expiry/flag. */
export const VISITOR_TTL_HOURS = 48;

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

/** Active visitor fresh-face boost from nearby payload. */
export function isVisitorFresh(
  user: {
    is_visitor?: boolean | null;
    visitor_expires_at?: string | Date | null;
  },
  nowMs: number = Date.now(),
): boolean {
  if (user.is_visitor === true) {
    if (user.visitor_expires_at == null || user.visitor_expires_at === '') return true;
  }
  if (user.visitor_expires_at == null || user.visitor_expires_at === '') return false;
  const ts =
    user.visitor_expires_at instanceof Date
      ? user.visitor_expires_at.getTime()
      : new Date(user.visitor_expires_at).getTime();
  if (!Number.isFinite(ts)) return false;
  return ts > nowMs;
}

/**
 * Nearby NEW treatment — newly joined OR visitor boost.
 * Same Brand pill for both (Brand confirmed).
 */
export function isFreshFaceNearby(
  user: {
    created_at?: string | Date | null;
    is_visitor?: boolean | null;
    visitor_expires_at?: string | Date | null;
  },
  nowMs: number = Date.now(),
): boolean {
  return isNewlyJoined(user.created_at, nowMs) || isVisitorFresh(user, nowMs);
}
