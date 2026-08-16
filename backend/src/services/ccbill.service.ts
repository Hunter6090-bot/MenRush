import crypto from 'crypto';
import { extractOccurredAt, extractProviderEventId } from './ccbill-webhook.service';

export type CCBillTier = 'premium';

export type CCBillWebhookEvent = {
  eventType: string;
  eventId: string | null;
  userId: string | null;
  subscriptionId: string | null;
  customerId: string | null;
  transactionId: string | null;
  periodEnd: Date | null;
  occurredAt: Date | null;
  raw: Record<string, string>;
};

export type CCBillWebhookVerification = {
  ok: boolean;
  reason?: 'webhook_secret_not_configured' | 'signature_mismatch' | 'insecure_dev_bypass';
};

export class CCBillNotConfiguredError extends Error {
  constructor() {
    super('CCBill is not configured');
    this.name = 'CCBillNotConfiguredError';
  }
}

// Locked display/checkout price for now — do not read from env until pricing is revisited.
const PREMIUM_PRICE = '6.99';

const TIER_PRICING = {
  initialPrice: PREMIUM_PRICE,
  initialPeriod: Number(process.env.CCBILL_PREMIUM_INITIAL_PERIOD_DAYS || '30'),
  recurringPrice: PREMIUM_PRICE,
  recurringPeriod: Number(process.env.CCBILL_PREMIUM_RECURRING_PERIOD_DAYS || '30'),
};

function requireConfig() {
  const flexId = process.env.CCBILL_FLEXFORM_ID;
  const subacc = process.env.CCBILL_CLIENT_SUBACC;
  const salt = process.env.CCBILL_FORM_DIGEST_SALT;
  if (!flexId || !subacc || !salt) {
    throw new CCBillNotConfiguredError();
  }
  return { flexId, subacc, salt };
}

function formatPrice(value: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return n.toFixed(2);
}

function buildFormDigest(
  initialPrice: string,
  initialPeriod: number,
  recurringPrice: string,
  recurringPeriod: number,
  salt: string,
): string {
  const numRebills = '99';
  const currencyCode = process.env.CCBILL_CURRENCY_CODE || '826';
  const payload =
    formatPrice(initialPrice) +
    String(initialPeriod) +
    formatPrice(recurringPrice) +
    String(recurringPeriod) +
    numRebills +
    currencyCode +
    salt;
  return crypto.createHash('md5').update(payload).digest('hex');
}

function firstString(body: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = body[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Constant-time string comparison. crypto.timingSafeEqual requires
 * equal-length buffers, so unequal-length inputs are rejected up front.
 * That length check is not itself sensitive: an attacker who does not
 * know the secret gains nothing from learning its length here.
 */
function timingSafeEqualString(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export const ccbillService = {
  isConfigured(): boolean {
    return Boolean(
      process.env.CCBILL_FLEXFORM_ID &&
        process.env.CCBILL_CLIENT_SUBACC &&
        process.env.CCBILL_FORM_DIGEST_SALT,
    );
  },

  getPlans() {
    return [
      {
        id: 'premium' as const,
        name: 'MenRush Premium',
        tagline: 'See who matched you. Boost. Ghost browse. No caps.',
        price: TIER_PRICING.recurringPrice,
        period_days: TIER_PRICING.recurringPeriod,
      },
    ];
  },

  buildFlexFormUrl(userId: string, tier: CCBillTier, returnUrl?: string): string {
    const { flexId, subacc, salt } = requireConfig();
    const pricing = TIER_PRICING;
    const formDigest = buildFormDigest(
      pricing.initialPrice,
      pricing.initialPeriod,
      pricing.recurringPrice,
      pricing.recurringPeriod,
      salt,
    );

    const base =
      process.env.CCBILL_FLEXFORM_BASE_URL ||
      `https://api.ccbill.com/wap-frontflex/flexforms/${flexId}`;

    const params = new URLSearchParams({
      clientSubacc: subacc,
      initialPrice: formatPrice(pricing.initialPrice),
      initialPeriod: String(pricing.initialPeriod),
      recurringPrice: formatPrice(pricing.recurringPrice),
      recurringPeriod: String(pricing.recurringPeriod),
      numRebills: '99',
      currencyCode: process.env.CCBILL_CURRENCY_CODE || '840',
      formDigest,
      'X-userId': userId,
      'X-tier': tier,
    });

    if (returnUrl) {
      params.set('successUrl', returnUrl);
      params.set('failureUrl', returnUrl);
    }

    return `${base}?${params.toString()}`;
  },

  parseWebhook(body: Record<string, unknown>): CCBillWebhookEvent {
    const eventType =
      firstString(body, ['eventType', 'eventGroupType', 'event_type']) || 'unknown';

    const userId =
      firstString(body, ['X-userId', 'x-userId', 'userId', 'custom1', 'X-custom1']) || null;

    // Do not fall back to transactionId here — that id identifies a payment
    // event, not the long-lived subscription, and conflating them breaks
    // out-of-order checks and audit joins.
    const subscriptionId =
      firstString(body, ['subscriptionId', 'subscription_id']) || null;

    const transactionId =
      firstString(body, [
        'transactionId',
        'refundTransactionId',
        'chargebackTransactionId',
        'denialId',
      ]) || null;

    const customerId =
      firstString(body, ['clientAccnum', 'customerId', 'consumerId']) || null;

    const nextRenewal =
      firstString(body, ['nextRenewalDate', 'renewalDate', 'expirationDate']) || null;

    const periodEnd = nextRenewal ? new Date(nextRenewal) : null;

    const raw: Record<string, string> = {};
    for (const [key, value] of Object.entries(body)) {
      if (typeof value === 'string') raw[key] = value;
    }

    return {
      eventType,
      eventId: extractProviderEventId(eventType, raw),
      userId,
      subscriptionId,
      customerId,
      transactionId,
      periodEnd: periodEnd && !Number.isNaN(periodEnd.getTime()) ? periodEnd : null,
      occurredAt: extractOccurredAt(raw),
      raw,
    };
  },

  /**
   * Verifies webhook authenticity. Fails closed by default:
   *
   * - If CCBILL_WEBHOOK_SECRET is not configured, the request is REJECTED
   *   in every environment, including local and dev, unless an operator
   *   has explicitly opted into an insecure local bypass with
   *   CCBILL_ALLOW_UNVERIFIED_WEBHOOKS_DEV=true. That bypass is ignored
   *   whenever NODE_ENV is 'production', so it can never take effect in
   *   production regardless of how the flag is set.
   * - If the secret is configured, the value CCBill sends is compared to
   *   it with a constant-time comparison instead of `===`.
   *
   * ASSUMPTION / RISK (Hypothesis H1 — vendor confirmation still required):
   * MenRush currently treats authenticity as a merchant-configured shared
   * secret echoed in a postback field (`webhookSecret` / `X-webhookSecret` /
   * `digest`), not as an HMAC over the raw body. Some third-party CCBill
   * integrations document HMAC-SHA256 signatures for Webhooks 3.0. Until a
   * live merchant account confirms the exact scheme CCBill will send to
   * MenRush, this implementation hardens the shared-secret path that the
   * codebase already expected, fails closed when the secret is missing in
   * production, and documents the open confirmation item in
   * docs/ccbill-webhook-security.md. Do not invent production secrets here.
   */
  verifyWebhook(body: Record<string, unknown>): CCBillWebhookVerification {
    const secret = process.env.CCBILL_WEBHOOK_SECRET?.trim();

    if (!secret) {
      const devBypass =
        !isProduction() && process.env.CCBILL_ALLOW_UNVERIFIED_WEBHOOKS_DEV === 'true';
      if (devBypass) {
        console.warn(
          '[ccbill] CCBILL_WEBHOOK_SECRET is unset; accepting webhook unverified because ' +
            'CCBILL_ALLOW_UNVERIFIED_WEBHOOKS_DEV=true and NODE_ENV is not production. ' +
            'This must never be enabled in production.',
        );
        return { ok: true, reason: 'insecure_dev_bypass' };
      }
      return { ok: false, reason: 'webhook_secret_not_configured' };
    }

    const provided =
      firstString(body, ['webhookSecret', 'X-webhookSecret', 'digest']) || '';
    if (!provided || !timingSafeEqualString(provided, secret)) {
      return { ok: false, reason: 'signature_mismatch' };
    }
    return { ok: true };
  },
};
