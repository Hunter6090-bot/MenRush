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
} from '../lib/premiumPriceList';

export interface PremiumInvoiceRow {
  id: string;
  invoice_number: string;
  user_id: string;
  plan_tier: 'premium' | 'premium_plus';
  plan_days: number;
  amount_pence: number;
  currency: string;
  status: 'unpaid' | 'paid' | 'cancelled';
  payment_method: string;
  payment_reference: string;
  notes: string | null;
  paid_at: string | null;
  confirmed_by_admin_id: string | null;
  cancelled_at: string | null;
  immediate_start_consent_at: string | null;
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
}

function escapeEmailHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function getManualPaymentInstructions(reference: string): ManualPaymentInstructions {
  const account_name = process.env.MANUAL_PAYMENT_ACCOUNT_NAME?.trim() || null;
  const sort_code = process.env.MANUAL_PAYMENT_SORT_CODE?.trim() || null;
  const account_number = process.env.MANUAL_PAYMENT_ACCOUNT_NUMBER?.trim() || null;
  const bank_name = process.env.MANUAL_PAYMENT_BANK_NAME?.trim() || null;

  const bank_configured = Boolean(sort_code && account_number);

  const instructions =
    process.env.MANUAL_PAYMENT_INSTRUCTIONS?.trim() ||
    (bank_configured
      ? 'Use your payment reference as the bank transfer reference. Premium switches on once we have confirmed your payment.'
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
    `As you chose not to start straight away, your Premium starts ${when}, after the 14-day cancellation period.`,
    `If you change your mind before then, just email support@menrush.com with your invoice reference, ${params.invoiceNumber}, and we will give you a full refund within 14 days of hearing from you, to the account you paid from.`,
  ];
}

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
         notes, metadata, immediate_start_consent_at
       ) VALUES ($1, $2, $3, $4, 'GBP', 'unpaid', 'bank_transfer', $5, $6, $7, $8::jsonb,
                 CASE WHEN $9::boolean THEN NOW() ELSE NULL END)
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
        boughtAt: new Date(invoice.created_at),
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
          title: startsLater ? 'Your payment has arrived' : 'Your Premium is on',
          body: startsLater
            ? `Thanks, your payment for invoice ${invoice.invoice_number} has arrived. Your Premium starts on ${londonDate(premiumStartsAt)}, after the 14-day cancellation period.`
            : `Thanks, your payment for invoice ${invoice.invoice_number} has arrived and your Premium is on.`,
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
