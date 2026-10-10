/**
 * Referral system: signup attribution and the "invite 3 members, get 1 month
 * Premium free" unlock. A paid upgrade is still recorded on the referral row
 * (backend record only; commission is parked and never shown to members).
 *
 * Qualifying rule (one place: QUALIFIES_SQL below). A referral counts toward
 * the unlock once ALL of these hold:
 *   1. the referred member registered with the referrer's code (referrals row);
 *   2. the referred member has confirmed their email (users.email_confirmed);
 *   3. the referred member is not the referrer (self referral);
 *   4. the referred email is not the referrer's email, compared lowercased and
 *      ignoring a "+tag" in the local part (same email).
 * ID verification is optional and is NOT required. There is no device signal
 * on signup, so none is used (we do not invent one).
 *
 * Every 3 qualifying referrals grant 1 month Premium, repeating at 6, 9, ...
 * Each milestone is granted once (referral_premium_grants unique per milestone).
 *
 * Does NOT: send money, call external payment rails, invent device fingerprinting, or gate signup.
 */
import crypto from 'crypto';
import type { PoolClient } from 'pg';
import pool, { query } from '../db';
import { premiumService } from './premium.service';
import { ALWAYS_PREMIUM_NAMES, isAlwaysPremiumName } from '../lib/always-premium';

export { ALWAYS_PREMIUM_NAMES, isAlwaysPremiumName };

type Queryable = PoolClient | typeof pool;

/** @deprecated use ALWAYS_PREMIUM_NAMES from lib — re-exported for callers */
export const REFERRAL_UNLOCK_EVERY = 3;
export const REFERRAL_UNLOCK_MONTHS = 1;
export const REFERRAL_PAYOUT_RATE = 0.2;

const CODE_CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

/** Email normalised for the same email check: trimmed, lowercased, "+tag" dropped. */
const NORM_EMAIL_SQL = (col: string) =>
  `lower(regexp_replace(btrim(${col}), '\\+[^@]*@', '@'))`;

/**
 * The qualifying rule as SQL. Expects aliases: r = referrals,
 * ru = referred user, rr = referrer user.
 */
const QUALIFIES_SQL = `
  COALESCE(ru.email_confirmed, FALSE) = TRUE
  AND r.referred_user_id <> r.referrer_id
  AND ${NORM_EMAIL_SQL('ru.email')} <> ${NORM_EMAIL_SQL('rr.email')}
`;

export type ReferralStatus = 'pending' | 'verified' | 'credited';
export type PayoutStatus = 'none' | 'pending' | 'paid';

export type ReferralSummary = {
  referral_code: string;
  verified_count: number;
  pending_count: number;
  credited_count: number;
  unlock_every: number;
  progress_to_unlock: number;
  unlocks_earned: number;
  referrals: Array<{
    referred_user_id: string;
    name: string | null;
    /** true once this referral meets the qualifying rule. */
    qualified: boolean;
    status: ReferralStatus;
    created_at: string;
    verified_at: string | null;
    credited_at: string | null;
  }>;
};

function randomBody(length: number): string {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += CODE_CHARS[bytes[i]! % CODE_CHARS.length];
  }
  return out;
}

/** Stable display format: MR + 8 chars. Distinct from MENRUSH- / PRIDE*. */
export function generateReferralCode(): string {
  return `MR${randomBody(8)}`;
}

export function normalizeReferralCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

/**
 * Reject codes that belong to other systems (fail closed at referral field).
 */
export function classifyForeignCode(code: string): 'pride' | 'invite' | 'bsf26' | 'mr3free' | null {
  const c = normalizeReferralCode(code);
  if (c === 'MR3FREE') {
    return 'mr3free';
  }
  if (c === 'BSF26') {
    return 'bsf26';
  }
  if (c.startsWith('PRIDE') || c === 'PRIDE3MONTHFREE' || /^PRIDE[\s-]?3MONTH[\s-]?FREE$/i.test(code.trim())) {
    return 'pride';
  }
  if (c.startsWith('MENRUSH-') || c.startsWith('MENRUSH')) {
    return 'invite';
  }
  return null;
}

async function allocateUniqueCode(db: Queryable): Promise<string> {
  for (let attempt = 0; attempt < 12; attempt++) {
    const code = generateReferralCode();
    const clash = await db.query(`SELECT 1 FROM users WHERE referral_code = $1 LIMIT 1`, [code]);
    if (clash.rows.length === 0) return code;
  }
  throw new Error('Could not allocate a referral code. Please try again.');
}

export const referralService = {
  generateReferralCode,
  normalizeReferralCode,
  isAlwaysPremiumName,
  classifyForeignCode,

  async ensureReferralCode(userId: string, client?: PoolClient): Promise<string> {
    const db: Queryable = client ?? pool;
    const existing = await db.query(`SELECT referral_code FROM users WHERE id = $1`, [userId]);
    if (!existing.rows[0]) throw new Error('User not found');
    if (existing.rows[0].referral_code) return existing.rows[0].referral_code as string;

    for (let attempt = 0; attempt < 8; attempt++) {
      const code = await allocateUniqueCode(db);
      const updated = await db.query(
        `UPDATE users
            SET referral_code = $2, updated_at = NOW()
          WHERE id = $1 AND referral_code IS NULL
          RETURNING referral_code`,
        [userId, code],
      );
      if (updated.rows[0]?.referral_code) return updated.rows[0].referral_code as string;
      const again = await db.query(`SELECT referral_code FROM users WHERE id = $1`, [userId]);
      if (again.rows[0]?.referral_code) return again.rows[0].referral_code as string;
    }
    throw new Error('Could not allocate a referral code. Please try again.');
  },

  /**
   * Resolve a signup referral code. Fail closed on unknown / foreign / self.
   * Returns referrer id or throws.
   */
  async resolveReferrerForSignup(
    referralCodeRaw: string,
    opts?: { excludeUserId?: string },
  ): Promise<{ referrerId: string; code: string }> {
    const foreign = classifyForeignCode(referralCodeRaw);
    if (foreign === 'pride') {
      throw new Error('That looks like a Pride promo — use the promo field instead.');
    }
    if (foreign === 'mr3free' || foreign === 'bsf26') {
      throw new Error('That looks like a promo code — use the promo field instead.');
    }
    if (foreign === 'invite') {
      throw new Error('That looks like a waitlist invite — enter it as an invite code, not a referral.');
    }

    const code = normalizeReferralCode(referralCodeRaw);
    if (!/^MR[2-9A-HJ-NP-Z]{8}$/.test(code)) {
      throw new Error('This referral code is not valid.');
    }

    const result = await query(
      `SELECT id, referral_code FROM users WHERE referral_code = $1 LIMIT 1`,
      [code],
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error('This referral code is not valid.');
    }
    if (opts?.excludeUserId && row.id === opts.excludeUserId) {
      throw new Error('You cannot use your own referral code.');
    }
    return { referrerId: row.id as string, code: row.referral_code as string };
  },

  /**
   * Attach referral at signup (same transaction). Immutable after this.
   */
  async attachAtSignup(
    referrerId: string,
    referredUserId: string,
    client: PoolClient,
  ): Promise<void> {
    if (referrerId === referredUserId) {
      throw new Error('You cannot use your own referral code.');
    }
    await client.query(
      `INSERT INTO referrals (referrer_id, referred_user_id, status, payout_amount, payout_status)
       VALUES ($1, $2, 'pending', 0, 'none')`,
      [referrerId, referredUserId],
    );
  },

  /**
   * Re-check one referred member against the qualifying rule (call after
   * signup and after email confirmation). Marks their referral qualified
   * (status 'verified', kept for the existing CHECK constraint) and may grant
   * the referrer their month.
   */
  async onReferralMaybeQualified(referredUserId: string): Promise<{ unlocked: boolean } | null> {
    const updated = await query(
      `UPDATE referrals r
          SET status = 'verified',
              verified_at = COALESCE(r.verified_at, NOW())
         FROM users ru, users rr
        WHERE r.referred_user_id = $1
          AND r.status = 'pending'
          AND ru.id = r.referred_user_id
          AND rr.id = r.referrer_id
          AND ${QUALIFIES_SQL}
        RETURNING r.referrer_id`,
      [referredUserId],
    );
    const row = updated.rows[0];
    if (!row) return null;
    const unlocked = await this.maybeGrantUnlock(row.referrer_id as string);
    return { unlocked };
  },

  /**
   * Kept for existing callers (Veriff, admin verify). ID verification is not
   * part of the rule any more; this just re-checks the rule.
   */
  async onUserVerified(userId: string): Promise<{ unlocked: boolean } | null> {
    return this.onReferralMaybeQualified(userId);
  },

  /** Mark every pending referral of this referrer that now meets the rule. */
  async qualifyPendingForReferrer(referrerId: string): Promise<number> {
    const updated = await query(
      `UPDATE referrals r
          SET status = 'verified',
              verified_at = COALESCE(r.verified_at, NOW())
         FROM users ru, users rr
        WHERE r.referrer_id = $1
          AND r.status = 'pending'
          AND ru.id = r.referred_user_id
          AND rr.id = r.referrer_id
          AND ${QUALIFIES_SQL}
        RETURNING r.id`,
      [referrerId],
    );
    return updated.rowCount ?? 0;
  },

  /** Referrals that meet the qualifying rule right now. */
  async countQualified(referrerId: string, db: Queryable = pool): Promise<number> {
    const result = await db.query(
      `SELECT COUNT(*)::int AS count
         FROM referrals r
         JOIN users ru ON ru.id = r.referred_user_id
         JOIN users rr ON rr.id = r.referrer_id
        WHERE r.referrer_id = $1
          AND r.status IN ('verified', 'credited')
          AND ${QUALIFIES_SQL}`,
      [referrerId],
    );
    return result.rows[0]?.count ?? 0;
  },

  /** @deprecated use countQualified. */
  async countVerified(referrerId: string): Promise<number> {
    return this.countQualified(referrerId);
  },

  /**
   * Every 3 qualifying referrals grant 1 month Premium. Each milestone is
   * granted once, in one transaction with its Premium extension, and the
   * referrer row is locked so concurrent calls cannot double grant.
   */
  async maybeGrantUnlock(referrerId: string): Promise<boolean> {
    await this.qualifyPendingForReferrer(referrerId);
    const client = await pool.connect();
    let grantedAny = false;
    try {
      await client.query('BEGIN');
      await client.query(`SELECT id FROM users WHERE id = $1 FOR UPDATE`, [referrerId]);
      const qualified = await this.countQualified(referrerId, client);
      const milestone = Math.floor(qualified / REFERRAL_UNLOCK_EVERY);
      for (let m = 1; m <= milestone; m++) {
        const inserted = await client.query(
          `INSERT INTO referral_premium_grants (user_id, milestone, verified_count_at_grant, months_granted)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id, milestone) DO NOTHING
           RETURNING id`,
          [referrerId, m, qualified, REFERRAL_UNLOCK_MONTHS],
        );
        if (inserted.rows[0]) {
          await premiumService.grantReferralMonth(referrerId, REFERRAL_UNLOCK_MONTHS, new Date(), client);
          grantedAny = true;
        }
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
    return grantedAny;
  },

  /**
   * Real paid Premium upgrade (not beta gift / Pride / waitlist).
   * Records 20% as pending payout. Does not send money.
   */
  async onPaidUpgrade(
    referredUserId: string,
    paymentAmount: number,
  ): Promise<{ payout_amount: number } | null> {
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      return null;
    }
    const payout = Math.round(paymentAmount * REFERRAL_PAYOUT_RATE * 100) / 100;

    const result = await query(
      `UPDATE referrals
          SET status = 'credited',
              payout_amount = COALESCE(payout_amount, 0) + $2,
              payout_status = 'pending',
              payment_amount = COALESCE(payment_amount, 0) + $3,
              credited_at = COALESCE(credited_at, NOW()),
              verified_at = COALESCE(verified_at, NOW())
        WHERE referred_user_id = $1
          AND status IN ('pending', 'verified', 'credited')
        RETURNING id, payout_amount`,
      [referredUserId, payout, paymentAmount],
    );
    if (!result.rows[0]) return null;

    // If they paid before verifying, treat as verified for unlock counting.
    const referrer = await query(
      `SELECT referrer_id FROM referrals WHERE referred_user_id = $1`,
      [referredUserId],
    );
    if (referrer.rows[0]?.referrer_id) {
      await this.maybeGrantUnlock(referrer.rows[0].referrer_id as string);
    }

    return { payout_amount: Number(result.rows[0].payout_amount) };
  },

  async getSummary(userId: string): Promise<ReferralSummary> {
    const code = await this.ensureReferralCode(userId);

    // Self heal: grant any month already earned under the rule before reporting.
    try {
      await this.maybeGrantUnlock(userId);
    } catch (err) {
      console.error('[referral] summary unlock sync failed', err);
    }

    const qualifiedCount = await this.countQualified(userId);
    const counts = await query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE status = 'credited')::int AS credited_count
         FROM referrals
        WHERE referrer_id = $1`,
      [userId],
    );
    const c = counts.rows[0] || {};
    const unlocks = await query(
      `SELECT COUNT(*)::int AS n FROM referral_premium_grants WHERE user_id = $1`,
      [userId],
    );

    const list = await query(
      `SELECT r.referred_user_id, ru.name, r.status, r.created_at, r.verified_at, r.credited_at,
              (r.status IN ('verified', 'credited') AND ${QUALIFIES_SQL}) AS qualified
         FROM referrals r
         JOIN users ru ON ru.id = r.referred_user_id
         JOIN users rr ON rr.id = r.referrer_id
        WHERE r.referrer_id = $1
        ORDER BY r.created_at DESC
        LIMIT 100`,
      [userId],
    );

    return {
      referral_code: code,
      verified_count: qualifiedCount,
      pending_count: Math.max(0, (c.total ?? 0) - qualifiedCount),
      credited_count: c.credited_count ?? 0,
      unlock_every: REFERRAL_UNLOCK_EVERY,
      progress_to_unlock: qualifiedCount % REFERRAL_UNLOCK_EVERY,
      unlocks_earned: unlocks.rows[0]?.n ?? 0,
      referrals: list.rows.map((row) => ({
        referred_user_id: row.referred_user_id,
        name: row.name ?? null,
        qualified: Boolean(row.qualified),
        status: row.status as ReferralStatus,
        created_at: new Date(row.created_at).toISOString(),
        verified_at: row.verified_at ? new Date(row.verified_at).toISOString() : null,
        credited_at: row.credited_at ? new Date(row.credited_at).toISOString() : null,
      })),
    };
  },
};
