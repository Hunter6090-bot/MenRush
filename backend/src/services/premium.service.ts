import type { PoolClient } from 'pg';
import pool, { query } from '../db';
import { isInviteRequired } from './invite-code.service';
import { isAlwaysPremiumName } from '../lib/always-premium';
import { registerTravelPremiumIncluded } from '../lib/travel';
import {
  endAfterPaidStops,
  isRefundLikeEvent,
  paidEndWithEarnedMonths,
  placeEarnedGrant,
  referralExtendedEnd,
} from './referral-earned-months';
import { PREMIUM_PRICE_LIST } from '../lib/premiumPriceList';

// Kept here for existing importers; the rule lives in referral-earned-months.
export { referralExtendedEnd };

type Queryable = PoolClient | typeof pool;

export type PaymentProcessor = 'verotel' | 'segpay';

export type PaymentWebhookEvent = {
  eventType: string;
  userId: string | null;
  subscriptionId: string | null;
  customerId: string | null;
  periodEnd: Date | null;
  processor?: string;
  raw: Record<string, string>;
};

export class BillingNotConfiguredError extends Error {
  constructor(message = 'Billing is not configured') {
    super(message);
    this.name = 'BillingNotConfiguredError';
  }
}

/** Fallback when webhook body omits billed amount — matches standard premium price. */
export const PREMIUM_PAID_PRICE = 6.99;

/**
 * Waitlist gift cutoff: UK launch midnight 1 Oct 2026 (BST = UTC+1).
 * Anyone who registers before this gets 30 days Premium with no code.
 * Pride / BSF26 / MR3FREE 3-month grants replace this gift (do not stack).
 */
export const WAITLIST_GIFT_CUTOFF = new Date('2026-09-30T23:00:00Z');
export const WAITLIST_GIFT_DAYS = 30;

export function isWaitlistGiftOpen(now = new Date()): boolean {
  return now.getTime() < WAITLIST_GIFT_CUTOFF.getTime();
}

export type PremiumTier = 'free' | 'premium' | 'premium_plus';
export type PremiumFeature =
  | 'who_liked_you'
  | 'profile_views'
  | 'profile_boost'
  | 'unlimited_likes'
  | 'expanded_radius'
  | 'message_without_match'
  | 'read_receipts'
  | 'voice_messages'
  | 'media_sharing'
  | 'unlimited_photos'
  | 'video_intro'
  | 'incognito'
  | 'advanced_filters'
  | 'premium_rooms'
  | 'travel';

export const FREE_LIMITS = {
  likesPerDay: 20,
  radiusKm: 5,
  photos: 6,
  profileViews: 5,
} as const;

const PREMIUM_FEATURES: PremiumFeature[] = [
  'who_liked_you',
  'profile_views',
  'profile_boost',
  'unlimited_likes',
  'expanded_radius',
  'message_without_match',
  'read_receipts',
  'voice_messages',
  'media_sharing',
  'unlimited_photos',
  'video_intro',
  'incognito',
  'advanced_filters',
  'premium_rooms',
];

export class PremiumRequiredError extends Error {
  constructor(
    public readonly code: string,
    public readonly feature: PremiumFeature,
    message: string,
  ) {
    super(message);
    this.name = 'PremiumRequiredError';
  }
}

function tierFromPassthrough(_raw: Record<string, string>): PremiumTier {
  return 'premium';
}

async function syncUserEntitlements(
  userId: string,
  tier: PremiumTier,
  active: boolean,
  until: Date | null,
): Promise<void> {
  await query(
    `UPDATE users
     SET premium_tier = $2,
         is_premium = $3,
         premium_until = $4,
         updated_at = NOW()
     WHERE id = $1`,
    [userId, tier, active, until],
  );
}

export const premiumService = {
  async getStatus(userId: string) {
    const result = await query(
      `SELECT
         u.premium_tier,
         u.is_premium,
         u.premium_until,
         u.premium_starts_at,
         s.id AS subscription_id,
         s.status AS subscription_status,
         s.processor,
         s.processor_subscription_id,
         s.current_period_end
       FROM users u
       LEFT JOIN subscriptions s
         ON s.user_id = u.id AND s.status = 'active'
       WHERE u.id = $1`,
      [userId],
    );

    const row = result.rows[0];
    if (!row) return null;

    const until = row.premium_until ? new Date(row.premium_until) : null;
    const starts = row.premium_starts_at ? new Date(row.premium_starts_at) : null;
    const started = !starts || starts.getTime() <= Date.now();
    const active =
      Boolean(row.is_premium) &&
      started &&
      (!until || until.getTime() > Date.now());

    const betaFree = this.isBetaPremiumFree();
    return {
      tier: betaFree ? 'premium' : ((row.premium_tier || 'free') as PremiumTier),
      is_premium: betaFree || active,
      beta_premium_included: betaFree,
      premium_until: until?.toISOString() ?? null,
      premium_starts_at: starts?.toISOString() ?? null,
      subscription: row.subscription_id
        ? {
            id: row.subscription_id,
            status: row.subscription_status,
            processor: row.processor,
            processor_subscription_id: row.processor_subscription_id,
            current_period_end: row.current_period_end,
          }
        : null,
      features: betaFree || active ? PREMIUM_FEATURES : [],
      free_limits: FREE_LIMITS,
    };
  },

  isBetaPremiumFree(): boolean {
    // MenRush is currently in beta, so Premium is included unless an operator
    // explicitly ends the beta entitlement with BETA_PREMIUM_FREE=false.
    return process.env.BETA_PREMIUM_FREE !== 'false' || isInviteRequired();
  },

  /**
   * Immediate 30-day Premium for open signup before UK launch (Terms 7.2).
   * Call only when no Pride / BSF26 / MR3FREE path applied for this registration.
   */
  async grantWaitlistGift(
    userId: string,
    client?: PoolClient,
    now = new Date(),
  ): Promise<{ premiumUntil: Date } | null> {
    if (!isWaitlistGiftOpen(now)) return null;
    const db: Queryable = client ?? pool;
    const premiumUntil = new Date(now.getTime() + WAITLIST_GIFT_DAYS * 24 * 60 * 60 * 1000);
    await db.query(
      `UPDATE users
       SET is_premium = TRUE,
           premium_tier = 'premium',
           premium_starts_at = $2,
           premium_until = $3,
           updated_at = NOW()
       WHERE id = $1`,
      [userId, now, premiumUntil],
    );
    return { premiumUntil };
  },

  /**
   * Referral unlock: place one earned grant (see referral-earned-months).
   * Open-ended Premium is never shortened, for anyone: the month is banked.
   * While Premium is free for everyone the month is banked too, and starts
   * when free Premium ends. With an active paid subscription it is stacked on
   * top of the paid period. Otherwise it is added after the current end.
   * Caller holds the referrer row lock in `client`'s transaction.
   */
  async grantReferralMonth(
    userId: string,
    grantId: string,
    months = 1,
    now = new Date(),
    client?: PoolClient,
  ): Promise<{ premiumUntil: Date | null; state: 'banked' | 'stacked' | 'applied' }> {
    const db: Queryable = client ?? pool;
    return placeEarnedGrant(db, userId, grantId, months, {
      freeForEveryone: this.isBetaPremiumFree(),
      now,
    });
  },

  /**
   * Grant paid Premium from confirmed manual/bank invoice.
   * Stacking rules:
   * 1. Lifetime always-Premium owner accounts (see lib/always-premium): preserve open-ended (null until).
   * 2. Active future premium_until: extends from that date (base = currentUntil).
   * 3. Beta/promo promises (e.g. 12 months) are never shortened.
   * 4. Updates or creates an active subscription record (processor = 'manual_invoice').
   */
  async grantPaidInvoice(
    userId: string,
    planDays = 30,
    planTier: PremiumTier = 'premium',
    invoiceNumber?: string,
    amountPence?: number,
    client?: PoolClient,
    now = new Date(),
    opts: {
      /**
       * When the paid days may start (Terms 7.6A). Later than `now` when the member did
       * not ask to start straight away: then nothing paid is usable before this time.
       */
      startAt?: Date;
    } = {},
  ): Promise<{
    premiumUntil: Date | null;
    premiumStartsAt: Date | null;
    premiumActiveNow: boolean;
    skippedLifetime: boolean;
  }> {
    const db: Queryable = client ?? pool;
    const row = await db.query(
      `SELECT name, is_premium, premium_until, premium_starts_at
       FROM users WHERE id = $1`,
      [userId],
    );
    const user = row.rows[0];
    if (!user) throw new Error('User not found');

    const always = isAlwaysPremiumName(user.name);
    const currentUntil = user.premium_until ? new Date(user.premium_until) : null;

    if (always && Boolean(user.is_premium) && !currentUntil) {
      return { premiumUntil: null, premiumStartsAt: null, premiumActiveNow: true, skippedLifetime: true };
    }

    const startAt = opts.startAt && opts.startAt.getTime() > now.getTime() ? opts.startAt : now;
    const existingStarts = user.premium_starts_at ? new Date(user.premium_starts_at) : null;
    const startedAlready = !existingStarts || existingStarts.getTime() <= now.getTime();
    const runningUntilLater = Boolean(currentUntil && currentUntil.getTime() > now.getTime());
    const activeNow = Boolean(user.is_premium) && startedAlready && runningUntilLater;
    // Premium already set to begin later (a promo or another delayed invoice).
    const pendingLater = Boolean(user.is_premium) && !startedAlready && runningUntilLater;

    // Paid days start at the later of startAt and the end of any Premium already running
    // or booked. Existing Premium (12-month promo, waitlist gift) is never shortened.
    const base = runningUntilLater && currentUntil!.getTime() > startAt.getTime() ? currentUntil! : startAt;
    const candidateUntil = new Date(base.getTime() + planDays * 24 * 60 * 60 * 1000);
    const effectiveUntil =
      currentUntil && currentUntil.getTime() > candidateUntil.getTime() ? currentUntil : candidateUntil;

    // Start of the member's Premium window. Running Premium keeps its start (any gap
    // between it and a delayed paid start stays covered, in the member's favour).
    // Otherwise the window starts at startAt, so a delayed paid start is not usable early.
    let effectiveStart: Date;
    if (activeNow) {
      effectiveStart = existingStarts ?? now;
    } else if (pendingLater) {
      effectiveStart = existingStarts!.getTime() < startAt.getTime() ? existingStarts! : startAt;
    } else {
      effectiveStart = startAt;
    }

    await db.query(
      `UPDATE users
       SET is_premium = TRUE,
           premium_tier = $2,
           premium_starts_at = $3,
           premium_until = $4,
           updated_at = NOW()
       WHERE id = $1`,
      [userId, planTier, effectiveStart, effectiveUntil],
    );

    // Update subscriptions table: deactivate previous active subscription and record new active manual_invoice
    await db.query(
      `UPDATE subscriptions
       SET status = 'canceled', canceled_at = NOW(), updated_at = NOW()
       WHERE user_id = $1 AND status = 'active'`,
      [userId],
    );

    await db.query(
      `INSERT INTO subscriptions (
         user_id, tier, status, processor,
         processor_subscription_id,
         current_period_start, current_period_end, metadata
       ) VALUES ($1, $2, 'active', 'manual_invoice', $3, $4, $5, $6::jsonb)`,
      [
        userId,
        planTier,
        invoiceNumber || null,
        base,
        effectiveUntil,
        JSON.stringify({
          plan_days: planDays,
          amount_pence: amountPence,
          invoice_number: invoiceNumber,
          source: 'manual_invoice',
          paid_days_start: base.toISOString(),
        }),
      ],
    );

    if (amountPence && amountPence > 0) {
      try {
        const { referralService } = await import('./referral.service');
        await referralService.onPaidUpgrade(userId, amountPence / 100);
      } catch (err) {
        console.error('[premium] referral paid-upgrade hook failed', err);
      }
    }

    return {
      premiumUntil: effectiveUntil,
      premiumStartsAt: effectiveStart,
      premiumActiveNow: effectiveStart.getTime() <= now.getTime(),
      skippedLifetime: false,
    };
  },

  /** Parse billed amount from a webhook body; fallback to list price. */
  extractPaymentAmount(raw: Record<string, string>): number {
    const keys = [
      'billedAmount',
      'BilledAmount',
      'accountingAmount',
      'initialPrice',
      'recurringPrice',
      'amount',
    ];
    for (const key of keys) {
      const v = raw[key];
      if (v == null) continue;
      const n = Number(String(v).replace(/[^0-9.]/g, ''));
      if (Number.isFinite(n) && n > 0) return Math.round(n * 100) / 100;
    }
    return PREMIUM_PAID_PRICE;
  },

  async isPremium(userId: string): Promise<boolean> {
    if (this.isBetaPremiumFree()) return true;
    const status = await this.getStatus(userId);
    return Boolean(status?.is_premium);
  },

  async hasFeature(userId: string, _feature: PremiumFeature): Promise<boolean> {
    if (this.isBetaPremiumFree()) return true;
    const status = await this.getStatus(userId);
    return Boolean(status?.is_premium);
  },

  async requireFeature(userId: string, feature: PremiumFeature): Promise<void> {
    const allowed = await this.hasFeature(userId, feature);
    if (!allowed) {
      throw new PremiumRequiredError(
        'premium_required',
        feature,
        'Premium required',
      );
    }
  },

  async recordUsage(userId: string, feature: PremiumFeature): Promise<void> {
    await query(
      `INSERT INTO premium_features_usage (user_id, feature) VALUES ($1, $2)`,
      [userId, feature],
    );
  },

  async countDailyUsage(userId: string, feature: PremiumFeature): Promise<number> {
    const result = await query(
      `SELECT COUNT(*)::int AS count
       FROM premium_features_usage
       WHERE user_id = $1
         AND feature = $2
         AND used_at >= date_trunc('day', NOW())`,
      [userId, feature],
    );
    return result.rows[0]?.count ?? 0;
  },

  buildCheckoutUrl(_userId: string, _tier: PremiumTier, _returnUrl?: string): string {
    // Verotel is active merchant under review; live checkout wiring disabled until approved.
    throw new BillingNotConfiguredError();
  },

  getPlans() {
    return [
      {
        id: 'premium' as const,
        name: 'MenRush Premium',
        tagline: 'See who matched you. Boost. Ghost browse. No caps.',
        price: (PREMIUM_PRICE_LIST.premium.amountPence / 100).toFixed(2),
        period_days: PREMIUM_PRICE_LIST.premium.planDays,
      },
    ];
  },

  async activateFromWebhook(event: PaymentWebhookEvent) {
    if (!event.userId) {
      return { ok: false, reason: 'missing_user_id' };
    }

    const tier = tierFromPassthrough(event.raw);
    const periodEnd =
      event.periodEnd || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await query(
      `UPDATE subscriptions
       SET status = 'canceled', canceled_at = NOW(), updated_at = NOW()
       WHERE user_id = $1 AND status = 'active'`,
      [event.userId],
    );

    const processor = event.processor || 'verotel';

    await query(
      `INSERT INTO subscriptions (
         user_id, tier, status, processor,
         processor_subscription_id, processor_customer_id,
         current_period_start, current_period_end, metadata
       ) VALUES ($1, $2, 'active', $7, $3, $4, NOW(), $5, $6::jsonb)`,
      [
        event.userId,
        tier,
        event.subscriptionId,
        event.customerId,
        periodEnd,
        JSON.stringify(event.raw),
        processor,
      ],
    );

    // Earned referral months ride on top of the paid period (never overwritten).
    const until = await paidEndWithEarnedMonths(pool, event.userId, periodEnd, {
      freeForEveryone: this.isBetaPremiumFree(),
    });
    await syncUserEntitlements(event.userId, tier, true, until);

    // Referral commission — record only; never send money / call payout rails.
    try {
      const { referralService } = await import('./referral.service');
      await referralService.onPaidUpgrade(
        event.userId,
        this.extractPaymentAmount(event.raw),
      );
    } catch (err) {
      console.error('[premium] referral paid-upgrade hook failed', err);
    }

    return { ok: true, userId: event.userId, tier, periodEnd };
  },

  async renewFromWebhook(event: PaymentWebhookEvent) {
    if (!event.userId) return { ok: false, reason: 'missing_user_id' };

    const periodEnd =
      event.periodEnd || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const existing = await query(
      `SELECT tier FROM subscriptions
       WHERE user_id = $1 AND status = 'active'
       ORDER BY created_at DESC LIMIT 1`,
      [event.userId],
    );

    const tier = (existing.rows[0]?.tier || tierFromPassthrough(event.raw)) as PremiumTier;

    await query(
      `UPDATE subscriptions
       SET current_period_end = $2,
           processor_subscription_id = COALESCE($3, processor_subscription_id),
           updated_at = NOW(),
           metadata = metadata || $4::jsonb
       WHERE user_id = $1 AND status = 'active'`,
      [event.userId, periodEnd, event.subscriptionId, JSON.stringify(event.raw)],
    );

    // Earned referral months ride on top of the new paid period end, so a
    // renewal never overwrites them (QC #355).
    const until = await paidEndWithEarnedMonths(pool, event.userId, periodEnd, {
      freeForEveryone: this.isBetaPremiumFree(),
    });
    await syncUserEntitlements(event.userId, tier, true, until);

    try {
      const { referralService } = await import('./referral.service');
      await referralService.onPaidUpgrade(
        event.userId,
        this.extractPaymentAmount(event.raw),
      );
    } catch (err) {
      console.error('[premium] referral renew hook failed', err);
    }

    return { ok: true, userId: event.userId, tier, periodEnd };
  },

  async deactivateFromWebhook(event: PaymentWebhookEvent) {
    if (!event.userId) return { ok: false, reason: 'missing_user_id' };

    // Never strip always-Premium owner accounts.
    const nameRow = await query(`SELECT name FROM users WHERE id = $1`, [event.userId]);
    if (isAlwaysPremiumName(nameRow.rows[0]?.name)) {
      await query(
        `UPDATE subscriptions
         SET status = 'expired', updated_at = NOW()
         WHERE user_id = $1 AND status = 'active'`,
        [event.userId],
      );
      return { ok: true, userId: event.userId, preserved: true };
    }

    const last = await query(
      `SELECT current_period_end FROM subscriptions
       WHERE user_id = $1
       ORDER BY (status = 'active') DESC, created_at DESC LIMIT 1`,
      [event.userId],
    );

    await query(
      `UPDATE subscriptions
       SET status = 'expired', updated_at = NOW()
       WHERE user_id = $1 AND status = 'active'`,
      [event.userId],
    );

    // Earned referral months survive the paid subscription stopping: they run
    // on after the paid period end (cancel / expiry), or from now when the
    // paid period is void (refund / chargeback).
    const now = new Date();
    const periodEnd = last.rows[0]?.current_period_end ? new Date(last.rows[0].current_period_end) : null;
    const base = isRefundLikeEvent(event.eventType) || !periodEnd ? now : periodEnd;
    const keepUntil = await endAfterPaidStops(pool, event.userId, base, now);
    if (keepUntil) {
      await syncUserEntitlements(event.userId, 'premium', true, keepUntil);
      return { ok: true, userId: event.userId, earnedMonthsUntil: keepUntil };
    }

    await syncUserEntitlements(event.userId, 'free', false, null);
    // Travel: a lapsed member's trip ends now (queries already stop showing it).
    await query(
      `UPDATE travel_trips SET ended_at = NOW() WHERE user_id = $1 AND ended_at IS NULL`,
      [event.userId],
    );
    return { ok: true, userId: event.userId };
  },

  async handleWebhook(body: Record<string, unknown>) {
    const raw: Record<string, string> = {};
    for (const [key, value] of Object.entries(body)) {
      if (typeof value === 'string') raw[key] = value;
    }

    const eventType =
      (typeof body.eventType === 'string' && body.eventType) ||
      (typeof body.event_type === 'string' && body.event_type) ||
      'unknown';

    const userId =
      (typeof body['X-userId'] === 'string' && body['X-userId']) ||
      (typeof body.userId === 'string' && body.userId) ||
      (typeof body.custom1 === 'string' && body.custom1) ||
      null;

    const subscriptionId =
      (typeof body.subscriptionId === 'string' && body.subscriptionId) ||
      (typeof body.subscription_id === 'string' && body.subscription_id) ||
      null;

    const customerId =
      (typeof body.customerId === 'string' && body.customerId) ||
      (typeof body.consumerId === 'string' && body.consumerId) ||
      null;

    const event: PaymentWebhookEvent = {
      eventType,
      userId,
      subscriptionId,
      customerId,
      periodEnd: null,
      processor: 'verotel',
      raw,
    };

    const type = event.eventType.toLowerCase();

    if (type.includes('newsale') || type.includes('new_sale')) {
      return this.activateFromWebhook(event);
    }
    if (type.includes('renewal')) {
      return this.renewFromWebhook(event);
    }
    if (
      type.includes('cancel') ||
      type.includes('expir') ||
      type.includes('refund') ||
      type.includes('chargeback')
    ) {
      return this.deactivateFromWebhook(event);
    }

    return { ok: true, ignored: true, eventType: event.eventType };
  },
};

// Travel queries ask this at build time (lib/travel has no service imports).
registerTravelPremiumIncluded(() => premiumService.isBetaPremiumFree());
