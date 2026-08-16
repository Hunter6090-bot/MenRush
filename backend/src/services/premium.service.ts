import { query } from '../db';
import { ccbillService, CCBillTier } from './ccbill.service';
import {
  buildSafeWebhookMetadata,
  classifyEventCategory,
  webhookEventStore,
} from './ccbill-webhook.service';

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

export class WebhookVerificationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'WebhookVerificationError';
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

    const betaFree = this.isBetaPremiumFree();
    return {
      tier: betaFree ? 'premium' : ((row.premium_tier || 'free') as PremiumTier),
      is_premium: betaFree || active,
      beta_premium_included: betaFree,
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
      features: betaFree || active ? PREMIUM_FEATURES : [],
      free_limits: FREE_LIMITS,
    };
  },

  isBetaPremiumFree(): boolean {
    return process.env.BETA_PREMIUM_FREE === 'true';
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
    const safeMeta = buildSafeWebhookMetadata({
      eventId: event.eventId,
      eventType: event.eventType,
      subscriptionId: event.subscriptionId,
    });

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
        JSON.stringify(safeMeta),
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
    const safeMeta = buildSafeWebhookMetadata({
      eventId: event.eventId,
      eventType: event.eventType,
      subscriptionId: event.subscriptionId,
    });

    await query(
      `UPDATE subscriptions
       SET current_period_end = $2,
           processor_subscription_id = COALESCE($3, processor_subscription_id),
           updated_at = NOW(),
           metadata = metadata || $4::jsonb
       WHERE user_id = $1 AND status = 'active'`,
      [event.userId, periodEnd, event.subscriptionId, JSON.stringify(safeMeta)],
    );

    await syncUserEntitlements(event.userId, tier, true, periodEnd);
    return { ok: true, userId: event.userId, tier, periodEnd };
  },

  async deactivateFromWebhook(
    event: ReturnType<typeof ccbillService.parseWebhook>,
    category?: ReturnType<typeof classifyEventCategory>,
  ) {
    if (!event.userId) return { ok: false, reason: 'missing_user_id' };

    const resolvedCategory = category || classifyEventCategory(event.eventType);
    const safeMeta = buildSafeWebhookMetadata({
      eventId: event.eventId,
      eventType: event.eventType,
      subscriptionId: event.subscriptionId,
    });

    await query(
      `UPDATE subscriptions
       SET status = 'expired',
           updated_at = NOW(),
           metadata = metadata || $2::jsonb
       WHERE user_id = $1 AND status = 'active'`,
      [event.userId, JSON.stringify({ ...safeMeta, deactivation_category: resolvedCategory })],
    );

    await syncUserEntitlements(event.userId, 'free', false, null);
    return { ok: true, userId: event.userId, category: resolvedCategory };
  },

  /**
   * Entry point for CCBill webhook delivery.
   *
   * Required order of operations:
   *  1. Verify authenticity. Fails closed if CCBILL_WEBHOOK_SECRET is not
   *     configured (see ccbillService.verifyWebhook).
   *  2. Parse and classify the event: activation, renewal, cancellation,
   *     expiry, refund, or chargeback. Refund and chargeback are kept as
   *     distinct categories even though both currently deactivate Premium,
   *     so future reward-reversal logic (issues #39, #40) can tell them
   *     apart without another migration.
   *  3. Require a stable provider event id. Without one, idempotency
   *     cannot be guaranteed, so the event is rejected rather than risking
   *     a silent duplicate.
   *  4. Record the attempt under a database unique constraint. A duplicate
   *     or replayed delivery for the same event id is a no-op.
   *  5. Guard against out-of-order delivery for the same subscription.
   *  6. Only then apply the entitlement change, and mark the event
   *     processed or failed for audit.
   */
  async handleWebhook(body: Record<string, unknown>) {
    const verification = ccbillService.verifyWebhook(body);
    if (!verification.ok) {
      throw new WebhookVerificationError(
        verification.reason || 'invalid_signature',
        `CCBill webhook rejected: ${verification.reason || 'invalid_signature'}`,
      );
    }

    const event = ccbillService.parseWebhook(body);
    const category = classifyEventCategory(event.eventType);

    if (!event.eventId) {
      throw new WebhookVerificationError(
        'missing_event_id',
        'CCBill webhook rejected: no stable provider event identifier could be derived',
      );
    }

    const attempt = await webhookEventStore.recordAttempt({
      eventId: event.eventId,
      eventType: event.eventType,
      category,
      userId: event.userId,
      subscriptionId: event.subscriptionId,
      occurredAt: event.occurredAt,
    });

    if (attempt.status === 'duplicate') {
      return { ok: true, duplicate: true, eventId: event.eventId, category };
    }

    if (event.subscriptionId && event.occurredAt) {
      const outOfOrder = await webhookEventStore.isOutOfOrder(
        event.subscriptionId,
        event.occurredAt,
      );
      if (outOfOrder) {
        await webhookEventStore.markIgnoredOutOfOrder(attempt.id);
        return {
          ok: true,
          ignored: true,
          reason: 'out_of_order',
          eventId: event.eventId,
          category,
        };
      }
    }

    try {
      let result: Record<string, unknown>;
      switch (category) {
        case 'activation':
          result = await this.activateFromWebhook(event);
          break;
        case 'renewal':
          result = await this.renewFromWebhook(event);
          break;
        case 'cancellation':
        case 'expiry':
        case 'refund':
        case 'chargeback':
          result = await this.deactivateFromWebhook(event, category);
          break;
        default:
          result = { ok: true, ignored: true, eventType: event.eventType };
      }
      await webhookEventStore.markProcessed(attempt.id);
      return { ...result, eventId: event.eventId, category };
    } catch (err) {
      await webhookEventStore.markFailed(attempt.id).catch(() => {});
      throw err;
    }
  },
};
