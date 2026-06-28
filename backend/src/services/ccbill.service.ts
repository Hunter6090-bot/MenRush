import crypto from 'crypto';

export type CCBillTier = 'premium';

export type CCBillWebhookEvent = {
  eventType: string;
  userId: string | null;
  subscriptionId: string | null;
  customerId: string | null;
  periodEnd: Date | null;
  raw: Record<string, string>;
};

export class CCBillNotConfiguredError extends Error {
  constructor() {
    super('CCBill is not configured');
    this.name = 'CCBillNotConfiguredError';
  }
}

const TIER_PRICING = {
  initialPrice: process.env.CCBILL_PREMIUM_INITIAL_PRICE || '4.99',
  initialPeriod: Number(process.env.CCBILL_PREMIUM_INITIAL_PERIOD_DAYS || '30'),
  recurringPrice: process.env.CCBILL_PREMIUM_RECURRING_PRICE || '4.99',
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
        tagline: 'See who signalled you. Boost. Ghost browse. No caps.',
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

    const subscriptionId =
      firstString(body, [
        'subscriptionId',
        'subscription_id',
        'subscriptionId',
        'transactionId',
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
      userId,
      subscriptionId,
      customerId,
      periodEnd: periodEnd && !Number.isNaN(periodEnd.getTime()) ? periodEnd : null,
      raw,
    };
  },

  verifyWebhook(body: Record<string, unknown>): boolean {
    const secret = process.env.CCBILL_WEBHOOK_SECRET;
    if (!secret) return true;

    const provided =
      firstString(body, ['webhookSecret', 'X-webhookSecret', 'digest']) || '';
    return provided === secret;
  },
};