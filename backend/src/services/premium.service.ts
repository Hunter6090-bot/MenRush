import type { PoolClient } from 'pg';
import pool, { query } from '../db';
import { isInviteRequired } from './invite-code.service';
import { isAlwaysPremiumName } from '../lib/always-premium';

type Queryable = PoolClient | typeof pool;

export type PaymentProcessor = 'verotel' | 'segpay';

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
  | 'premium_rooms';

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
   * Entitlement grant from 3 verified referrals → 1 month Premium.
   * Never strips always-Premium accounts (BOA90, Bigbear25, HantsBear).
   * Extends finite windows; leaves open-ended (null until) alone.
   */
  async grantReferralMonth(
    userId: string,
    months = 1,
    now = new Date(),
  ): Promise<{ premiumUntil: Date | null; skippedLifetime: boolean }> {
    const row = await query(
      `SELECT name, is_premium, premium_until, premium_starts_at
         FROM users WHERE id = $1`,
      [userId],
    );
    const user = row.rows[0];
    if (!user) return { premiumUntil: null, skippedLifetime: false };

    const always = isAlwaysPremiumName(user.name);
    const currentUntil = user.premium_until ? new Date(user.premium_until) : null;

    // Open-ended Premium (typical for always-Premium owners): keep forever.
    if (always && Boolean(user.is_premium) && !currentUntil) {
      return { premiumUntil: null, skippedLifetime: true };
    }

    const base =
      currentUntil && currentUntil.getTime() > now.getTime() ? currentUntil : now;
    const premiumUntil = new Date(base.getTime() + months * 30 * 24 * 60 * 60 * 1000);

    await query(
      `UPDATE users
       SET is_premium = TRUE,
           premium_tier = 'premium',
           premium_starts_at = COALESCE(premium_starts_at, $2),
           premium_until = $3,
           updated_at = NOW()
       WHERE id = $1`,
      [userId, now, premiumUntil],
    );
    return { premiumUntil, skippedLifetime: false };
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
        'Premium subscription required',
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
        price: '6.99',
        period_days: 30,
      },
    ];
  },

};
