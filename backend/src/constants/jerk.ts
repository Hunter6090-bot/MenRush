/**
 * Jerk: a one-tap nudge (wink-style). Stored in `jerks`, never in likes/matches.
 *
 * Brand can swap the copy here without touching the service or routes.
 * `{name}` is replaced with the sender's display name.
 */
export const JERK_MESSAGE_TEMPLATE = '{name} jerked you 😏';

/** Max new jerks one sender can send in a rolling 24 hours. */
export const JERK_DAILY_LIMIT = 20;

/** A repeat jerk to the same person inside this window is a no-op (no new row, no new alert). */
export const JERK_REPEAT_WINDOW_HOURS = 24;

/** Friendly copy for the 429 when the daily limit is hit. */
export const JERK_LIMIT_MESSAGE = 'Daily limit reached. Back tomorrow.';

export function jerkMessage(senderName: string | null | undefined): string {
  const name = (senderName ?? '').trim() || 'Someone';
  return JERK_MESSAGE_TEMPLATE.replace('{name}', name);
}
