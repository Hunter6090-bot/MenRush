import { query } from '../db';
import { ccbillService, CCBillTier } from './ccbill.service';

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
    const active =
      Boolean(row.is_premium) && (!until || until.getTime() > Date.now());

    return {
      tier: (row.premium_tier || 'free') as PremiumTier,
      is_premium: active,
      premium_until: until?.toISOString() ?? null,
      subscription: row.subscription_id
        ? {
            id: row.subscription_id,
            status: row.subscription_status,
            processor: row.processor,
            processor_subscription_id: row.processor_subscription_id,
            current_period_end: row.current_period_end,
          }
        : null,
      features: active ? PREMIUM_FEATURES : [],
      free_limits: FREE_LIMITS,
    };
  },

  async isPremium(userId: string): Promise<boolean> {
    const status = await this.getStatus(userId);
    return Boolean(status?.is_premium);
  },

  async hasFeature(userId: string, _feature: PremiumFeature): Promise<boolean> {
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

  buildCheckoutUrl(userId: string, tier: CCBillTier, returnUrl?: string) {
    return ccbillService.buildFlexFormUrl(userId, tier, returnUrl);
  },

  getPlans() {
    return ccbillService.getPlans();
  },

  async activateFromWebhook(event: ReturnType<typeof ccbillService.parseWebhook>) {
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

    await query(
      `INSERT INTO subscriptions (
         user_id, tier, status, processor,
         processor_subscription_id, processor_customer_id,
         current_period_start, current_period_end, metadata
       ) VALUES ($1, $2, 'active', 'ccbill', $3, $4, NOW(), $5, $6::jsonb)`,
      [
        event.userId,
        tier,
        event.subscriptionId,
        event.customerId,
        periodEnd,
        JSON.stringify(event.raw),
      ],
    );

    await syncUserEntitlements(event.userId, tier, true, periodEnd);
    return { ok: true, userId: event.userId, tier, periodEnd };
  },

  async renewFromWebhook(event: ReturnType<typeof ccbillService.parseWebhook>) {
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

    await syncUserEntitlements(event.userId, tier, true, periodEnd);
    return { ok: true, userId: event.userId, tier, periodEnd };
  },

  async deactivateFromWebhook(event: ReturnType<typeof ccbillService.parseWebhook>) {
    if (!event.userId) return { ok: false, reason: 'missing_user_id' };

    await query(
      `UPDATE subscriptions
       SET status = 'expired', updated_at = NOW()
       WHERE user_id = $1 AND status = 'active'`,
      [event.userId],
    );

    await syncUserEntitlements(event.userId, 'free', false, null);
    return { ok: true, userId: event.userId };
  },

  async handleWebhook(body: Record<string, unknown>) {
    if (!ccbillService.verifyWebhook(body)) {
      const err = new Error('Invalid webhook signature');
      (err as any).code = 'invalid_signature';
      throw err;
    }

    const event = ccbillService.parseWebhook(body);
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