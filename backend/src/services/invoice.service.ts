import crypto from 'crypto';
import type { PoolClient } from 'pg';
import pool, { query } from '../db';
import { premiumService, PremiumTier } from './premium.service';
import { notificationService } from './notification.service';
import {
  buildTransactionalEmail,
  transactionalParagraph,
} from './transactional-email.template';
import { sendTransactionalEmail } from './mailer.service';
import { IMMEDIATE_START_CONSENT_TEXT } from '../types/validation';
import {
  PREMIUM_PRICE_LIST,
  paidPremiumStartsAt,
  cancellationPeriodEnd,
} from '../lib/premiumPriceList';
import { endAfterPaidStops } from './referral-earned-months';

export interface PremiumInvoiceRow {
  id: string;
  invoice_number: string;
  user_id: string;
  plan_tier: 'premium' | 'premium_plus';
  plan_days: number;
  amount_pence: number;
  currency: string;
  status: 'unpaid' | 'paid' | 'cancelled' | 'refunded';
  payment_method: string;
  payment_reference: string;
  notes: string | null;
  paid_at: string | null;
  confirmed_by_admin_id: string | null;
  cancelled_at: string | null;
  immediate_start_consent_at: string | null;
  /** When the member asked for the invoice. The 14 day window runs from here. */
  requested_at?: string;
  refund_amount_pence?: number | null;
  refund_days_had?: number | null;
  cancelled_by?: string | null;
  refund_paid_at?: string | null;
  refund_paid_by?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  user_name?: string | null;
  user_email?: string | null;
}

export function generateInvoiceNumber(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `MR-INV-${dateStr}-${rand}`;
}

export function generatePaymentReference(): string {
  const rand = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `MR-${rand}`;
}

export interface ManualPaymentInstructions {
  account_name: string | null;
  sort_code: string | null;
  account_number: string | null;
  bank_name: string | null;
  currency: string;
  payment_reference: string;
  instructions: string;
  bank_configured: boolean;
  /** When this invoice's Premium starts, from the member's recorded choice. */
  premium_start_line: string | null;
}

/**
 * The start line for an invoice, from the member's recorded choice (Terms 7.6A).
 * Same wording as the Premium page (frontend lib/premiumStart.ts).
 */
export function invoiceStartLine(invoice: {
  immediate_start_consent_at: string | Date | null;
  requested_at?: string | Date | null;
  created_at?: string | Date | null;
}): string {
  if (invoice.immediate_start_consent_at) return 'Your Premium starts as soon as we confirm your payment.';
  const bought = new Date((invoice.requested_at ?? invoice.created_at ?? new Date()) as string | Date);
  return `Your Premium starts on ${londonDate(cancellationPeriodEnd(bought))}, after the 14 day cancellation period, or when we confirm your payment if that is later.`;
}

function escapeEmailHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function getManualPaymentInstructions(
  reference: string,
  invoice?: Parameters<typeof invoiceStartLine>[0],
): ManualPaymentInstructions {
  const account_name = process.env.MANUAL_PAYMENT_ACCOUNT_NAME?.trim() || null;
  const sort_code = process.env.MANUAL_PAYMENT_SORT_CODE?.trim() || null;
  const account_number = process.env.MANUAL_PAYMENT_ACCOUNT_NUMBER?.trim() || null;
  const bank_name = process.env.MANUAL_PAYMENT_BANK_NAME?.trim() || null;

  const bank_configured = Boolean(sort_code && account_number);

  const instructions =
    process.env.MANUAL_PAYMENT_INSTRUCTIONS?.trim() ||
    (bank_configured
      ? 'Use your payment reference as the bank transfer reference.'
      : 'Bank details are not shown here yet. Email support@menrush.com with your payment reference and we will reply with how to pay.');

  return {
    account_name,
    sort_code,
    account_number,
    bank_name,
    currency: 'GBP',
    payment_reference: reference,
    instructions,
    bank_configured,
    premium_start_line: invoice ? invoiceStartLine(invoice) : null,
  };
}

function londonDate(d: Date): string {
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/London',
  });
}

/**
 * 14-day cancellation lines for the payment confirmation email (Terms 7.6A, 8.1).
 * Always present, and they match the member's choice. Janet's voice. No dashes.
 */
export function premiumOnCancellationLines(params: {
  invoiceNumber: string;
  startedStraightAway: boolean;
  /** When Premium starts if they did not ask to start straight away. */
  premiumStartsAt: Date | null;
}): string[] {
  if (params.startedStraightAway) {
    return [
      `If you change your mind, you can cancel within 14 days of buying. Just email support@menrush.com with your invoice reference, ${params.invoiceNumber}, and we will refund you within 14 days of hearing from you, to the account you paid from.`,
      'As you asked for your Premium to start as soon as your payment was confirmed, your refund would be what you paid less an amount for the days of Premium you have had.',
    ];
  }
  const when = params.premiumStartsAt ? `on ${londonDate(params.premiumStartsAt)}` : 'once that period has ended';
  return [
    `As you chose not to start straight away, your Premium starts ${when}, after the 14 day cancellation period.`,
    `If you change your mind before then, just email support@menrush.com with your invoice reference, ${params.invoiceNumber}, and we will give you a full refund within 14 days of hearing from you, to the account you paid from.`,
  ];
}

/** In-app notice when a payment is confirmed. Matches the email and the member's choice. */
export function buildPremiumPaidNotification(params: {
  invoiceNumber: string;
  /** Set only when Premium starts later (no immediate start chosen). */
  premiumStartsAt: Date | null;
}): { title: string; body: string } {
  if (params.premiumStartsAt) {
    return {
      title: 'Your payment has arrived',
      body: `Thanks, your payment for invoice ${params.invoiceNumber} has arrived. Your Premium starts on ${londonDate(params.premiumStartsAt)}, after the 14 day cancellation period.`,
    };
  }
  return {
    title: 'Your Premium is on',
    body: `Thanks, your payment for invoice ${params.invoiceNumber} has arrived and your Premium is on.`,
  };
}

/**
 * Refund email, sent once when ops record the refund as paid. Janet's voice,
 * sentence case labels, no dashes, signed "All the best, MenRush".
 */
export function buildRefundPaidEmail(params: {
  name: string | null;
  refundPence: number;
  invoiceNumber: string;
  /** When the Premium bought with this invoice ended (the cancellation time). */
  premiumEndedAt: Date;
  /** False if Premium from this purchase had not started yet. */
  premiumHadStarted: boolean;
}): { subject: string; html: string; text: string } {
  const amount = `£${(params.refundPence / 100).toFixed(2)}`;
  const ended = londonDate(params.premiumEndedAt);
  const greetingName = escapeEmailHtml(params.name || 'there');
  const subject = 'Your MenRush refund is on its way';
  const sentLine = `We have sent your refund of ${amount} by bank transfer to the account you paid from.`;
  const endedLine = params.premiumHadStarted
    ? `The Premium you bought with this invoice ended on ${ended}, when you cancelled.`
    : `The Premium you bought with this invoice had not started yet, so it ended on ${ended}, when you cancelled.`;
  const timing = 'Bank transfers can take a few working days to show in your account.';
  const help = "If anything doesn't look quite right, please get in touch at support@menrush.com and we'll sort it out.";

  const html = buildTransactionalEmail({
    title: subject,
    preheader: `Your refund of ${amount} is on its way.`,
    headlineHtml: 'Your <span style="color:#C4832A;">refund</span> is on its way',
    subheadline: `We have sent you ${amount}.`,
    bodyHtml:
      transactionalParagraph(`Hello ${greetingName},`) +
      transactionalParagraph(escapeEmailHtml(sentLine)) +
      transactionalParagraph(escapeEmailHtml(endedLine)) +
      transactionalParagraph(escapeEmailHtml(timing)) +
      transactionalParagraph(help) +
      transactionalParagraph(
        `<span style="color:#A89070; font-size:14px;">Invoice number: ${escapeEmailHtml(params.invoiceNumber)}<br>Refund amount: ${escapeEmailHtml(amount)}</span>`,
      ) +
      transactionalParagraph('All the best,<br>MenRush'),
    ctaUrl: `${process.env.FRONTEND_URL || 'https://menrush.com'}/premium`,
    ctaLabel: 'Open MenRush',
  });

  const text = [
    `Hello ${params.name || 'there'},`,
    '',
    sentLine,
    '',
    endedLine,
    '',
    timing,
    '',
    help,
    '',
    `Invoice number: ${params.invoiceNumber}`,
    `Refund amount: ${amount}`,
    '',
    'All the best,',
    'MenRush',
  ].join('\n');

  return { subject, html, text };
}

/**
 * Mailer used for invoice emails. Tests replace `send` with a mock; the default
 * never sends in NODE_ENV=test or to test addresses.
 */
type InvoiceMail = { to: string; subject: string; html: string; text: string };
export const invoiceMailer: {
  send: (msg: InvoiceMail) => Promise<unknown>;
  /** Team alerts (no member data). */
  sendOps: (msg: InvoiceMail) => Promise<unknown>;
} = {
  async send(msg) {
    if (process.env.NODE_ENV === 'test' || msg.to.endsWith('@test.menrush.local')) return undefined;
    return sendTransactionalEmail(msg);
  },
  async sendOps(msg) {
    if (process.env.NODE_ENV === 'test') return undefined;
    return sendTransactionalEmail(msg);
  },
};

export function buildPremiumOnEmail(params: {
  name: string | null;
  amountPence: number;
  premiumUntil: Date | null;
  invoiceNumber: string;
  paymentReference: string;
  startedStraightAway: boolean;
  /** Start of paid Premium. Later than now only when the member did not ask to start straight away. */
  premiumStartsAt?: Date | null;
  now?: Date;
}): { subject: string; html: string; text: string } {
  const now = params.now ?? new Date();
  const startsLater = Boolean(
    !params.startedStraightAway && params.premiumStartsAt && params.premiumStartsAt.getTime() > now.getTime(),
  );
  const formattedAmount = (params.amountPence / 100).toFixed(2);
  const untilStr = params.premiumUntil ? londonDate(params.premiumUntil) : null;
  const greetingName = escapeEmailHtml(params.name || 'there');
  const cancellation = premiumOnCancellationLines({
    invoiceNumber: params.invoiceNumber,
    startedStraightAway: params.startedStraightAway,
    premiumStartsAt: params.premiumStartsAt ?? null,
  });

  const subject = startsLater ? 'Your MenRush payment has arrived' : 'Your MenRush Premium is now on';
  const headlineHtml = startsLater
    ? 'Your payment has <span style="color:#C4832A;">arrived</span>'
    : 'Your <span style="color:#C4832A;">Premium</span> is now on';
  const statusText = startsLater
    ? `Thank you for your bank transfer. It has arrived safely, and your Premium will run${untilStr ? ` until ${untilStr}` : ''}.`
    : `Thank you for your bank transfer. It has arrived safely, and your Premium is now switched on${untilStr ? ` until ${untilStr}` : ''}.`;
  const untilHtml = untilStr ? ` until <strong style="color:#F0E0C0;">${escapeEmailHtml(untilStr)}</strong>` : '';
  const statusHtml = startsLater
    ? `Thank you for your bank transfer. It has arrived safely, and your Premium will run${untilHtml}.`
    : `Thank you for your bank transfer. It has arrived safely, and your Premium is now switched on${untilHtml}.`;
  const help =
    "There's nothing more you need to do. If anything doesn't look quite right, please get in touch at support@menrush.com and we'll sort it out.";

  const html = buildTransactionalEmail({
    title: subject,
    preheader: "Thank you, we've received your payment.",
    headlineHtml,
    subheadline: `We've received your payment of £${formattedAmount}.`,
    bodyHtml:
      transactionalParagraph(`Hello ${greetingName},`) +
      transactionalParagraph(statusHtml) +
      transactionalParagraph(escapeEmailHtml(cancellation.join(' '))) +
      transactionalParagraph(help) +
      transactionalParagraph(
        `<span style="color:#A89070; font-size:14px;">Invoice number: ${escapeEmailHtml(params.invoiceNumber)}<br>Payment reference: ${escapeEmailHtml(params.paymentReference)}</span>`,
      ) +
      transactionalParagraph('All the best,<br>MenRush'),
    ctaUrl: `${process.env.FRONTEND_URL || 'https://menrush.com'}/premium`,
    ctaLabel: 'Open MenRush',
  });

  const text = [
    `Hello ${params.name || 'there'},`,
    '',
    statusText,
    '',
    cancellation.join(' '),
    '',
    help,
    '',
    `Invoice number: ${params.invoiceNumber}`,
    `Payment reference: ${params.paymentReference}`,
    '',
    'All the best,',
    'MenRush',
  ].join('\n');

  return { subject, html, text };
}

export class InvoiceActionError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
    this.name = 'InvoiceActionError';
  }
}

export const invoiceService = {
  /**
   * Create a manual invoice for a user.
   * Cancels any prior unpaid invoices so the user has exactly one active payment target.
   */
  async createInvoice(params: {
    userId: string;
    planTier?: 'premium' | 'premium_plus';
    planDays?: number;
    amountPence?: number;
    notes?: string;
    /** Set only on the ops path: who in ops created it (free text, no member data). */
    createdByAdminId?: string;
    /** True only when the member said yes to starting Premium as soon as payment is confirmed. */
    immediateStartConsent?: boolean;
  }): Promise<PremiumInvoiceRow> {
    const planTier = 'premium' as const;
    const listed = PREMIUM_PRICE_LIST[planTier];
    const isOps = Boolean(params.createdByAdminId);
    // Members always get the price list. Only the ops path may override it.
    const planDays = isOps && params.planDays !== undefined ? params.planDays : listed.planDays;
    const amountPence = isOps && params.amountPence !== undefined ? params.amountPence : listed.amountPence;
    const overridden = planDays !== listed.planDays || amountPence !== listed.amountPence;
    const overriddenAt = new Date();

    // Check if user already has an active unpaid invoice
    const existing = await query(
      `SELECT * FROM premium_invoices
       WHERE user_id = $1 AND status = 'unpaid'
       ORDER BY created_at DESC LIMIT 1`,
      [params.userId],
    );

    // Cancel older unpaid invoices so only one is active at a time
    if (existing.rows.length > 0) {
      await query(
        `UPDATE premium_invoices
         SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
         WHERE user_id = $1 AND status = 'unpaid'`,
        [params.userId],
      );
    }

    const invoiceNumber = generateInvoiceNumber();
    const paymentReference = generatePaymentReference();

    const result = await query(
      `INSERT INTO premium_invoices (
         user_id, plan_tier, plan_days, amount_pence, currency,
         status, payment_method, payment_reference, invoice_number,
         notes, metadata, immediate_start_consent_at, requested_at
       ) VALUES ($1, $2, $3, $4, 'GBP', 'unpaid', 'bank_transfer', $5, $6, $7, $8::jsonb,
                 CASE WHEN $9::boolean THEN NOW() ELSE NULL END, NOW())
       RETURNING *`,
      [
        params.userId,
        planTier,
        planDays,
        amountPence,
        paymentReference,
        invoiceNumber,
        params.notes ?? null,
        JSON.stringify({
          created_by_admin: isOps,
          ...(overridden
            ? {
                price_override: {
                  by: params.createdByAdminId,
                  at: overriddenAt.toISOString(),
                  from: { amount_pence: listed.amountPence, plan_days: listed.planDays },
                  to: { amount_pence: amountPence, plan_days: planDays },
                },
              }
            : {}),
          ...(params.immediateStartConsent === true
            ? { immediate_start_consent_text: IMMEDIATE_START_CONSENT_TEXT }
            : {}),
        }),
        params.immediateStartConsent === true,
      ],
    );

    const created: PremiumInvoiceRow = result.rows[0];
    if (overridden) {
      // Invoice id and ops actor only: no member data in logs.
      console.log(
        `[invoice] price override invoice=${created.id} admin=${params.createdByAdminId} ` +
          `amount_pence ${listed.amountPence}->${amountPence} plan_days ${listed.planDays}->${planDays} ` +
          `at=${overriddenAt.toISOString()}`,
      );
    }
    return created;
  },

  async getInvoiceById(idOrNumber: string): Promise<PremiumInvoiceRow | null> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrNumber);
    const result = await query(
      `SELECT pi.*, u.name AS user_name, u.email AS user_email
       FROM premium_invoices pi
       JOIN users u ON u.id = pi.user_id
       WHERE ${isUuid ? 'pi.id = $1' : 'pi.invoice_number = $1'}`,
      [idOrNumber],
    );
    return result.rows[0] || null;
  },

  async getInvoicesForUser(userId: string): Promise<PremiumInvoiceRow[]> {
    const result = await query(
      `SELECT * FROM premium_invoices
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId],
    );
    return result.rows;
  },

  async getLatestUnpaidInvoiceForUser(userId: string): Promise<PremiumInvoiceRow | null> {
    const result = await query(
      `SELECT * FROM premium_invoices
       WHERE user_id = $1 AND status = 'unpaid'
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId],
    );
    return result.rows[0] || null;
  },

  async listAllInvoices(
    limit = 100,
    statusFilter?: string,
  ): Promise<PremiumInvoiceRow[]> {
    const filterSql = statusFilter ? 'WHERE pi.status = $2' : '';
    const params: any[] = [limit];
    if (statusFilter) params.push(statusFilter);

    const result = await query(
      `SELECT pi.*, u.name AS user_name, u.email AS user_email
       FROM premium_invoices pi
       JOIN users u ON u.id = pi.user_id
       ${filterSql}
       ORDER BY pi.created_at DESC
       LIMIT $1`,
      params,
    );
    return result.rows;
  },

  /**
   * Confirm payment of an invoice.
   * Atomically locks the invoice row, sets status = 'paid', and grants/extends Premium
   * using stacking rules (does not wipe longer entitlements or always-premium accounts).
   */
  async confirmPayment(
    invoiceIdOrNumber: string,
    adminUserId?: string,
    notes?: string,
  ): Promise<{
    invoice: PremiumInvoiceRow;
    userPremium: { premiumUntil: Date | null; premiumStartsAt?: Date | null; isPremium: boolean };
    alreadyPaid?: boolean;
  }> {
    const client: PoolClient = await pool.connect();
    try {
      await client.query('BEGIN');

      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(invoiceIdOrNumber);
      const invResult = await client.query(
        `SELECT * FROM premium_invoices
         WHERE ${isUuid ? 'id = $1' : 'invoice_number = $1'}
         FOR UPDATE`,
        [invoiceIdOrNumber],
      );

      const invoice: PremiumInvoiceRow = invResult.rows[0];
      if (!invoice) {
        throw new Error('Invoice not found');
      }

      if (invoice.status === 'paid') {
        await client.query('COMMIT');
        const userStatus = await premiumService.getStatus(invoice.user_id);
        return {
          invoice,
          userPremium: {
            premiumUntil: userStatus?.premium_until ? new Date(userStatus.premium_until) : null,
            isPremium: Boolean(userStatus?.is_premium),
          },
          alreadyPaid: true,
        };
      }

      if (invoice.status === 'cancelled') {
        throw new Error('Cannot confirm payment for cancelled invoice');
      }
      if (invoice.status === 'refunded') {
        throw new Error('Cannot confirm payment for refunded invoice');
      }

      const adminUuid =
        adminUserId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(adminUserId)
          ? adminUserId
          : null;

      const updateResult = await client.query(
        `UPDATE premium_invoices
         SET status = 'paid',
             paid_at = NOW(),
             confirmed_by_admin_id = $2,
             notes = COALESCE($3, notes),
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [invoice.id, adminUuid, notes ?? null],
      );
      const updatedInvoice: PremiumInvoiceRow = updateResult.rows[0];

      // Terms 7.6A: without the immediate start choice, paid Premium starts only once
      // the 14-day cancellation period from buying (invoice issue) has ended.
      const confirmedAt = new Date();
      const startedStraightAway = Boolean(invoice.immediate_start_consent_at);
      const premiumStartsAt = paidPremiumStartsAt({
        boughtAt: new Date(invoice.requested_at ?? invoice.created_at),
        confirmedAt,
        immediateStartConsent: startedStraightAway,
      });

      // Grant / extend Premium using stacking rules
      const grantResult = await premiumService.grantPaidInvoice(
        invoice.user_id,
        invoice.plan_days,
        invoice.plan_tier as PremiumTier,
        invoice.invoice_number,
        invoice.amount_pence,
        client,
        confirmedAt,
        { startAt: premiumStartsAt },
      );
      const startsLater = premiumStartsAt.getTime() > confirmedAt.getTime();

      await client.query('COMMIT');

      // Post-commit: Notification + Email (outside transaction)
      try {
        await notificationService.create({
          userId: invoice.user_id,
          type: 'system',
          ...buildPremiumPaidNotification({
            invoiceNumber: invoice.invoice_number,
            premiumStartsAt: startsLater ? premiumStartsAt : null,
          }),
          linkPath: '/premium',
        });
      } catch (err) {
        console.error('[invoice] notification failed:', err);
      }

      try {
        const userRow = await query(`SELECT email, name FROM users WHERE id = $1`, [invoice.user_id]);
        const user = userRow.rows[0];
        if (user?.email && process.env.NODE_ENV !== 'test' && !user.email.endsWith('@test.menrush.local')) {
          const email = buildPremiumOnEmail({
            name: user.name ?? null,
            amountPence: invoice.amount_pence,
            premiumUntil: grantResult.premiumUntil,
            invoiceNumber: invoice.invoice_number,
            paymentReference: invoice.payment_reference,
            startedStraightAway,
            premiumStartsAt,
            now: confirmedAt,
          });
          await sendTransactionalEmail({ to: user.email, ...email });
        }
      } catch (err) {
        console.error('[invoice] confirmation email failed:', err);
      }

      return {
        invoice: updatedInvoice,
        userPremium: {
          premiumUntil: grantResult.premiumUntil,
          premiumStartsAt: grantResult.premiumStartsAt,
          isPremium: !startsLater || grantResult.premiumActiveNow,
        },
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Admin only. Cancel a PAID invoice within the 14-day cancellation period (Terms 7.6A)
   * and work out the refund:
   *   Premium not started yet -> full amount;
   *   started -> amount paid less the days of Premium had, pro rata on the price
   *   for the invoice's days (699p / 30 days on the price list).
   * Puts back what the member had before (promo, gift, earned and referral months),
   * never shortening it. The refund itself is paid by hand by bank transfer; record
   * that with markRefundPaid.
   */
  async cancelPaidInvoiceWithRefund(
    invoiceIdOrNumber: string,
    adminActor: string,
    now = new Date(),
  ): Promise<{
    invoice: PremiumInvoiceRow;
    refundPence: number;
    daysHad: number;
    premiumUntil: Date | null;
  }> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const inv = await client.query(
        `SELECT * FROM premium_invoices WHERE id::text = $1 OR invoice_number = $1 FOR UPDATE`,
        [invoiceIdOrNumber],
      );
      const invoice: PremiumInvoiceRow | undefined = inv.rows[0];
      if (!invoice) throw new InvoiceActionError(404, 'invoice_not_found');
      if (invoice.status !== 'paid') throw new InvoiceActionError(409, 'invoice_not_paid');
      // The window runs from when the member asked for the invoice, not from payment.
      if (now.getTime() > cancellationPeriodEnd(new Date(invoice.requested_at ?? invoice.created_at)).getTime()) {
        throw new InvoiceActionError(409, 'cancellation_period_over');
      }

      const subRes = await client.query(
        `SELECT * FROM subscriptions
          WHERE user_id = $1 AND processor = 'manual_invoice' AND processor_subscription_id = $2
          ORDER BY created_at DESC LIMIT 1`,
        [invoice.user_id, invoice.invoice_number],
      );
      const sub = subRes.rows[0];
      if (!sub || sub.status !== 'active') {
        // Superseded by a later invoice, or a lifetime account: sort by hand.
        throw new InvoiceActionError(409, 'not_latest_paid_invoice');
      }
      const latest = await client.query(
        `SELECT id FROM subscriptions WHERE user_id = $1 AND status = 'active' ORDER BY created_at DESC LIMIT 1`,
        [invoice.user_id],
      );
      if (latest.rows[0]?.id !== sub.id) throw new InvoiceActionError(409, 'not_latest_paid_invoice');

      const DAY = 24 * 60 * 60 * 1000;
      const paidStart = new Date(sub.current_period_start);
      const started = paidStart.getTime() <= now.getTime();
      // Completed days only: a part day always goes in the member's favour.
      const daysHad = started
        ? Math.min(invoice.plan_days, Math.floor((now.getTime() - paidStart.getTime()) / DAY))
        : 0;
      // Integer pence. The deduction is floored, so the refund is never rounded against the member.
      const deductionPence = Math.floor((invoice.amount_pence * daysHad) / invoice.plan_days);
      const refundPence = Math.max(0, invoice.amount_pence - deductionPence);

      // Put back what the member had before this invoice, never shortening it.
      const meta = (sub.metadata ?? {}) as { prior_premium_until?: string | null; prior_premium_starts_at?: string | null };
      const priorUntil = meta.prior_premium_until ? new Date(meta.prior_premium_until) : null;
      const priorRunning = Boolean(priorUntil && priorUntil.getTime() > now.getTime());
      // Earned months stacked on this paid period: the period is void, so they run
      // on from the end of the earlier Premium, or from now.
      const earnedUntil = await endAfterPaidStops(client, invoice.user_id, priorRunning ? priorUntil! : now, now);
      const candidates = [earnedUntil, priorRunning ? priorUntil : null].filter(Boolean) as Date[];
      const premiumUntil = candidates.length
        ? new Date(Math.max(...candidates.map((d) => d.getTime())))
        : null;

      if (premiumUntil) {
        const priorStarts = meta.prior_premium_starts_at ? new Date(meta.prior_premium_starts_at) : null;
        await client.query(
          `UPDATE users SET is_premium = TRUE, premium_until = $2,
                  premium_starts_at = $3, updated_at = NOW()
            WHERE id = $1`,
          [invoice.user_id, premiumUntil, priorRunning && priorStarts ? priorStarts : now],
        );
      } else {
        await client.query(
          `UPDATE users SET is_premium = FALSE, premium_tier = 'free', premium_until = $2,
                  premium_starts_at = NULL, updated_at = NOW()
            WHERE id = $1`,
          [invoice.user_id, now],
        );
      }

      await client.query(
        `UPDATE subscriptions SET status = 'canceled', canceled_at = $2, updated_at = NOW(),
                metadata = metadata || $3::jsonb
          WHERE id = $1`,
        [sub.id, now, JSON.stringify({ cancelled_under: '7.6A', refund_pence: refundPence })],
      );
      const upd = await client.query(
        `UPDATE premium_invoices
            SET status = 'refunded', cancelled_at = $2, cancelled_by = $3,
                refund_amount_pence = $4, refund_days_had = $5, updated_at = NOW(),
                metadata = metadata || jsonb_build_object('premium_had_started', $6::boolean)
          WHERE id = $1
          RETURNING *`,
        [invoice.id, now, adminActor, refundPence, daysHad, started],
      );
      await client.query('COMMIT');

      // Invoice id, actor, amounts and time only: no member data.
      console.log(
        `[invoice] cancel-refund invoice=${invoice.id} admin=${adminActor} paid_pence=${invoice.amount_pence} ` +
          `refund_pence=${refundPence} days_had=${daysHad} at=${now.toISOString()}`,
      );
      return { invoice: upd.rows[0], refundPence, daysHad, premiumUntil };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  },

  /** Admin only: record that ops paid the refund by bank transfer, by hand. */
  async markRefundPaid(invoiceIdOrNumber: string, adminActor: string, now = new Date()): Promise<PremiumInvoiceRow> {
    const res = await query(
      `UPDATE premium_invoices
          SET refund_paid_at = $2, refund_paid_by = $3, updated_at = NOW(),
              metadata = metadata || '{"refund_method":"bank_transfer_by_hand"}'::jsonb
        WHERE (id::text = $1 OR invoice_number = $1) AND status = 'refunded' AND refund_paid_at IS NULL
        RETURNING *`,
      [invoiceIdOrNumber, now, adminActor],
    );
    const row: PremiumInvoiceRow | undefined = res.rows[0];
    // Already recorded (or never refunded): nothing changes and no email goes out.
    if (!row) throw new InvoiceActionError(409, 'refund_not_due');
    console.log(
      `[invoice] refund-paid invoice=${row.id} admin=${adminActor} refund_pence=${row.refund_amount_pence} at=${now.toISOString()}`,
    );

    // Sent once: only the call that set refund_paid_at reaches here.
    await this.sendRefundEmail(row.id, now);
    return (await this.getInvoiceById(row.id)) ?? row;
  },

  /**
   * Send the refund email for a refunded, refund-paid invoice, at most once.
   * Tries twice. If it still fails: sets metadata.refund_email_failed_at (shown in
   * the admin invoice list) and alerts the team, so ops can resend with
   * POST /api/admin/premium/invoices/:id/resend-refund-email.
   */
  async sendRefundEmail(invoiceId: string, now = new Date()): Promise<'sent' | 'already_sent' | 'failed' | 'not_due'> {
    const r = await query(`SELECT * FROM premium_invoices WHERE id = $1`, [invoiceId]);
    const row: PremiumInvoiceRow | undefined = r.rows[0];
    if (!row || row.status !== 'refunded' || !row.refund_paid_at) return 'not_due';
    if ((row.metadata as { refund_email_sent_at?: string })?.refund_email_sent_at) return 'already_sent';
    const u = await query(`SELECT email, name FROM users WHERE id = $1`, [row.user_id]);
    const user = u.rows[0];
    if (!user?.email) return 'not_due';
    const email = buildRefundPaidEmail({
      name: user.name ?? null,
      refundPence: row.refund_amount_pence ?? 0,
      invoiceNumber: row.invoice_number,
      premiumEndedAt: new Date(row.cancelled_at ?? now),
      premiumHadStarted: Boolean((row.metadata as { premium_had_started?: boolean })?.premium_had_started),
    });
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        await invoiceMailer.send({ to: user.email, ...email });
        await query(
          `UPDATE premium_invoices
              SET metadata = (metadata - 'refund_email_failed_at') || jsonb_build_object('refund_email_sent_at', $2::text),
                  updated_at = NOW()
            WHERE id = $1`,
          [row.id, now.toISOString()],
        );
        return 'sent';
      } catch {
        console.error(`[invoice] refund email attempt ${attempt} failed invoice=${row.id}`);
      }
    }
    await query(
      `UPDATE premium_invoices
          SET metadata = metadata || jsonb_build_object('refund_email_failed_at', $2::text), updated_at = NOW()
        WHERE id = $1`,
      [row.id, now.toISOString()],
    );
    // Ops-visible alert: invoice id and reference only, no member data.
    console.error(`[ops-alert] refund email not sent invoice=${row.id} at=${now.toISOString()}`);
    try {
      const { getTeamEmails } = await import('./team.service');
      for (const to of getTeamEmails()) {
        await invoiceMailer.sendOps({
          to,
          subject: 'MenRush ops: refund email not sent',
          text: `The refund email for invoice ${row.invoice_number} (id ${row.id}) could not be sent after 2 tries. The refund itself is recorded as paid. Resend it with POST /api/admin/premium/invoices/${row.id}/resend-refund-email.`,
          html: `<p>The refund email for invoice <strong>${escapeEmailHtml(row.invoice_number)}</strong> (id ${escapeEmailHtml(row.id)}) could not be sent after 2 tries. The refund itself is recorded as paid.</p><p>Resend it with <code>POST /api/admin/premium/invoices/${escapeEmailHtml(row.id)}/resend-refund-email</code>.</p>`,
        });
      }
    } catch {
      console.error(`[ops-alert] team alert email also failed invoice=${row.id}`);
    }
    return 'failed';
  },

  async cancelInvoice(invoiceIdOrNumber: string, reason?: string): Promise<PremiumInvoiceRow> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(invoiceIdOrNumber);
    const result = await query(
      `UPDATE premium_invoices
       SET status = 'cancelled',
           cancelled_at = NOW(),
           notes = CASE WHEN $2::text IS NOT NULL THEN COALESCE(notes, '') || ' [Cancelled: ' || $2 || ']' ELSE notes END,
           updated_at = NOW()
       WHERE (${isUuid ? 'id = $1' : 'invoice_number = $1'})
         AND status = 'unpaid'
       RETURNING *`,
      [invoiceIdOrNumber, reason ?? null],
    );
    if (result.rows.length === 0) {
      throw new Error('Invoice not found or already processed');
    }
    return result.rows[0];
  },

  async cancelUserInvoice(userId: string, invoiceIdOrNumber: string): Promise<PremiumInvoiceRow> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(invoiceIdOrNumber);
    const result = await query(
      `UPDATE premium_invoices
       SET status = 'cancelled',
           cancelled_at = NOW(),
           updated_at = NOW()
       WHERE (${isUuid ? 'id = $2' : 'invoice_number = $2'})
         AND user_id = $1
         AND status = 'unpaid'
       RETURNING *`,
      [userId, invoiceIdOrNumber],
    );
    if (result.rows.length === 0) {
      throw new Error('Invoice not found or cannot be cancelled');
    }
    return result.rows[0];
  },
};
