/**
 * Earned referral months: where each month the member earns actually lives.
 *
 * Every earned month is one row in referral_premium_grants (one per milestone)
 * with a state that says where it is:
 *   banked  : saved, not started. Used while Premium is free for everyone
 *             (BETA_PREMIUM_FREE) and for open-ended Premium (premium_until
 *             NULL), which is never shortened. Banked months start when
 *             releaseBankedMonths() runs after free Premium ends (login hook
 *             and the manual scripts/referral-catch-up.ts --apply).
 *   stacked : riding on top of an active paid subscription. The member's
 *             premium_until is always "paid period end + stacked months",
 *             recomputed from subscriptions.current_period_end on every
 *             activation and renewal, so a renewal can never overwrite them.
 *   applied : folded into a fixed premium_until (applied_until). Free members,
 *             and stacked months once the paid subscription stops.
 *
 * Cancellation / expiry: stacked months are kept and run on from the end of
 * the paid period. Refund or chargeback: the paid period is void, so they run
 * from now. Either way the earned months are never wiped.
 *
 * All functions take the caller's client so they run inside the caller's
 * transaction. Nothing here imports premium.service (no import cycle).
 */
import type { PoolClient } from 'pg';
import pool from '../db';
import { europeLondonYmd, startOfEuropeLondonDay } from './promo.service';

type Queryable = PoolClient | typeof pool;

export type EarnedMonthState = 'banked' | 'stacked' | 'applied';

/**
 * Farming cap: at most this many earned months in any rolling 12 months.
 * Default agreed with QC (#355); product can change it here.
 */
export const REFERRAL_MAX_MONTHS_PER_12_MONTHS = 3;

/** Add calendar months to a YYYY-MM-DD (day overflow rolls forward, never short). */
function addMonthsYmd(ymd: string, months: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + months, d)).toISOString().slice(0, 10);
}

function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/**
 * New Premium end after adding N earned months, on the London day rule
 * (as #366/#374): the window runs from the start of a London day to London
 * midnight N calendar months later, minus 1 ms.
 * - Current end in the future: the months start the instant after it. If that
 *   instant is not a London midnight, they start the next London day, so the
 *   member never gets less than N full months on top.
 * - No end date, or it has passed: the months start today (London).
 */
export function referralExtendedEnd(currentUntil: Date | null, months: number, now = new Date()): Date {
  let startYmd: string;
  if (currentUntil && currentUntil.getTime() > now.getTime()) {
    const next = new Date(currentUntil.getTime() + 1);
    startYmd = europeLondonYmd(next);
    if (startOfEuropeLondonDay(startYmd).getTime() !== next.getTime()) {
      startYmd = addDaysYmd(startYmd, 1);
    }
  } else {
    startYmd = europeLondonYmd(now);
  }
  return new Date(startOfEuropeLondonDay(addMonthsYmd(startYmd, months)).getTime() - 1);
}

/** N months starting right after `base`, even if `base` is already in the past. */
export function monthsAfter(base: Date, months: number): Date {
  return referralExtendedEnd(base, months, new Date(base.getTime() - 1));
}

async function monthsInState(db: Queryable, userId: string, state: EarnedMonthState): Promise<number> {
  const r = await db.query(
    `SELECT COALESCE(SUM(months_granted), 0)::int AS n
       FROM referral_premium_grants WHERE user_id = $1 AND state = $2`,
    [userId, state],
  );
  return r.rows[0]?.n ?? 0;
}

/** Months earned in the rolling 12 months before `now` (for the cap). */
export async function monthsEarnedLast12(db: Queryable, userId: string, now = new Date()): Promise<number> {
  const r = await db.query(
    `SELECT COALESCE(SUM(months_granted), 0)::int AS n
       FROM referral_premium_grants
      WHERE user_id = $1 AND granted_at > ($2::timestamptz - INTERVAL '12 months')`,
    [userId, now],
  );
  return r.rows[0]?.n ?? 0;
}

async function activePaidPeriodEnd(db: Queryable, userId: string): Promise<Date | null> {
  const r = await db.query(
    `SELECT current_period_end FROM subscriptions
      WHERE user_id = $1 AND status = 'active' AND current_period_end IS NOT NULL
      ORDER BY created_at DESC LIMIT 1`,
    [userId],
  );
  return r.rows[0]?.current_period_end ? new Date(r.rows[0].current_period_end) : null;
}

async function loadUser(db: Queryable, userId: string) {
  const r = await db.query(`SELECT is_premium, premium_until FROM users WHERE id = $1`, [userId]);
  const row = r.rows[0];
  if (!row) return null;
  const until = row.premium_until ? new Date(row.premium_until) : null;
  return { isPremium: Boolean(row.is_premium), until, openEnded: Boolean(row.is_premium) && !until };
}

async function setPremiumUntil(db: Queryable, userId: string, until: Date, now: Date) {
  await db.query(
    `UPDATE users
        SET is_premium = TRUE,
            premium_tier = 'premium',
            premium_starts_at = COALESCE(premium_starts_at, $2),
            premium_until = $3,
            updated_at = NOW()
      WHERE id = $1`,
    [userId, now, until],
  );
}

/**
 * Paid entitlement end = paid period end + every earned month riding on the
 * subscription. Call on activation and on every renewal with the processor's
 * period end. Idempotent: a repeated webhook gives the same answer.
 * Also moves months onto the subscription that are still unused:
 *   - applied months whose window has not finished (whole month, member's favour);
 *   - banked months, once Premium is no longer free for everyone.
 */
export async function paidEndWithEarnedMonths(
  db: Queryable,
  userId: string,
  periodEnd: Date,
  opts: { freeForEveryone: boolean; now?: Date },
): Promise<Date> {
  const now = opts.now ?? new Date();
  await db.query(
    `UPDATE referral_premium_grants
        SET state = 'stacked', applied_at = NULL, applied_until = NULL
      WHERE user_id = $1
        AND ((state = 'applied' AND applied_until IS NOT NULL AND applied_until > $2)
             OR (state = 'banked' AND NOT $3::boolean))`,
    [userId, now, opts.freeForEveryone],
  );
  const stacked = await monthsInState(db, userId, 'stacked');
  return stacked > 0 ? monthsAfter(periodEnd, stacked) : periodEnd;
}

/**
 * The paid subscription stopped. Returns the end of the earned months that
 * keep Premium going (or null if none are left), and marks them applied.
 *   base = paid period end on cancel / expiry, now on refund / chargeback.
 */
export async function endAfterPaidStops(
  db: Queryable,
  userId: string,
  base: Date,
  now = new Date(),
): Promise<Date | null> {
  const r = await db.query(
    `SELECT COALESCE(SUM(months_granted), 0)::int AS n
       FROM referral_premium_grants
      WHERE user_id = $1
        AND (state = 'stacked' OR (state = 'applied' AND applied_until IS NOT NULL AND applied_until > $2))`,
    [userId, now],
  );
  const months: number = r.rows[0]?.n ?? 0;
  if (months <= 0) return null;
  const until = monthsAfter(base, months);
  if (until.getTime() <= now.getTime()) return null;
  await db.query(
    `UPDATE referral_premium_grants
        SET state = 'applied', applied_at = $2, applied_until = $3
      WHERE user_id = $1
        AND (state = 'stacked' OR (state = 'applied' AND applied_until IS NOT NULL AND applied_until > $2))`,
    [userId, now, until],
  );
  return until;
}

/** Refund-like billing events void the paid period (earned months run from now). */
export function isRefundLikeEvent(eventType: string | null | undefined): boolean {
  return /refund|chargeback|credit/i.test(String(eventType || ''));
}

/**
 * Start banked months once Premium is no longer free for everyone. Never for
 * open-ended Premium (it stays open-ended; the months stay banked).
 * Returns the number of months started.
 */
export async function releaseBankedMonths(
  db: Queryable,
  userId: string,
  opts: { freeForEveryone: boolean; now?: Date },
): Promise<number> {
  if (opts.freeForEveryone) return 0;
  const now = opts.now ?? new Date();
  const banked = await monthsInState(db, userId, 'banked');
  if (banked <= 0) return 0;
  const user = await loadUser(db, userId);
  if (!user || user.openEnded) return 0;

  const paidEnd = await activePaidPeriodEnd(db, userId);
  if (paidEnd) {
    const until = await paidEndWithEarnedMonths(db, userId, paidEnd, { freeForEveryone: false, now });
    await setPremiumUntil(db, userId, until, now);
    return banked;
  }
  const until = referralExtendedEnd(user.until, banked, now);
  await setPremiumUntil(db, userId, until, now);
  await db.query(
    `UPDATE referral_premium_grants
        SET state = 'applied', applied_at = $2, applied_until = $3
      WHERE user_id = $1 AND state = 'banked'`,
    [userId, now, until],
  );
  return banked;
}

/**
 * Place one newly earned grant (row already inserted, state default).
 * Caller holds the referrer's row lock inside its transaction.
 *   free for everyone or open-ended Premium -> banked (nothing shortened);
 *   active paid subscription                -> stacked on top of it;
 *   otherwise                               -> applied after the current end.
 */
export async function placeEarnedGrant(
  db: Queryable,
  userId: string,
  grantId: string,
  months: number,
  opts: { freeForEveryone: boolean; now?: Date },
): Promise<{ state: EarnedMonthState; premiumUntil: Date | null }> {
  const now = opts.now ?? new Date();
  const user = await loadUser(db, userId);
  if (!user) return { state: 'banked', premiumUntil: null };

  if (opts.freeForEveryone || user.openEnded) {
    await db.query(
      `UPDATE referral_premium_grants SET state = 'banked', applied_at = NULL, applied_until = NULL WHERE id = $1`,
      [grantId],
    );
    return { state: 'banked', premiumUntil: user.until };
  }

  // Free Premium has ended: start anything banked first, then this one.
  await releaseBankedMonths(db, userId, opts);

  const paidEnd = await activePaidPeriodEnd(db, userId);
  if (paidEnd) {
    await db.query(
      `UPDATE referral_premium_grants SET state = 'stacked', applied_at = NULL, applied_until = NULL WHERE id = $1`,
      [grantId],
    );
    const until = await paidEndWithEarnedMonths(db, userId, paidEnd, opts);
    await setPremiumUntil(db, userId, until, now);
    return { state: 'stacked', premiumUntil: until };
  }

  const fresh = await loadUser(db, userId);
  const until = referralExtendedEnd(fresh?.until ?? null, months, now);
  await setPremiumUntil(db, userId, until, now);
  await db.query(
    `UPDATE referral_premium_grants SET state = 'applied', applied_at = $2, applied_until = $3 WHERE id = $1`,
    [grantId, now, until],
  );
  return { state: 'applied', premiumUntil: until };
}

export type ReferralRewardMode = 'free_for_everyone' | 'open_ended' | 'paid' | 'end_date' | 'no_end_date';

/** Read-only: which end-date line is true for this member right now. */
export async function rewardModeFor(
  db: Queryable,
  userId: string,
  opts: { freeForEveryone: boolean; now?: Date },
): Promise<ReferralRewardMode> {
  if (opts.freeForEveryone) return 'free_for_everyone';
  const now = opts.now ?? new Date();
  const user = await loadUser(db, userId);
  if (user?.openEnded) return 'open_ended';
  if (await activePaidPeriodEnd(db, userId)) return 'paid';
  if (user?.until && user.until.getTime() > now.getTime()) return 'end_date';
  return 'no_end_date';
}

/** Read-only: months saved and not started yet. */
export async function bankedMonths(db: Queryable, userId: string): Promise<number> {
  return monthsInState(db, userId, 'banked');
}
