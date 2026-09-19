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

export function getManualPaymentInstructions(reference: string): ManualPaymentInstructions {
  const account_name = process.env.MANUAL_PAYMENT_ACCOUNT_NAME?.trim() || null;
  const sort_code = process.env.MANUAL_PAYMENT_SORT_CODE?.trim() || null;
  const account_number = process.env.MANUAL_PAYMENT_ACCOUNT_NUMBER?.trim() || null;
  const bank_name = process.env.MANUAL_PAYMENT_BANK_NAME?.trim() || null;

  const bank_configured = Boolean(sort_code && account_number);

  const instructions =
    process.env.MANUAL_PAYMENT_INSTRUCTIONS?.trim() ||
    (bank_configured
      ? 'Use your payment reference as the bank transfer reference. Premium will be activated upon ops confirmation.'
      : 'Bank transfer details are being provisioned by ops. Use your payment reference when contacting ops.');

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
    createdByAdminId?: string;
  }): Promise<PremiumInvoiceRow> {
    const planTier = params.planTier || 'premium';
    const planDays = params.planDays || 30;
    const amountPence = params.amountPence ?? 699;

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
         notes, metadata
       ) VALUES ($1, $2, $3, $4, 'GBP', 'unpaid', 'bank_transfer', $5, $6, $7, $8::jsonb)
       RETURNING *`,
      [
        params.userId,
        planTier,
        planDays,
        amountPence,
        paymentReference,
        invoiceNumber,
        params.notes ?? null,
        JSON.stringify({ created_by_admin: Boolean(params.createdByAdminId) }),
      ],
    );

    return result.rows[0];
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
    userPremium: { premiumUntil: Date | null; isPremium: boolean };
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

      // Grant / extend Premium using stacking rules
      const grantResult = await premiumService.grantPaidInvoice(
        invoice.user_id,
        invoice.plan_days,
        invoice.plan_tier as PremiumTier,
        invoice.invoice_number,
        invoice.amount_pence,
        client,
      );

      await client.query('COMMIT');

      // Post-commit: Notification + Email (outside transaction)
      try {
        await notificationService.create({
          userId: invoice.user_id,
          type: 'system',
          title: 'Premium Activated',
          body: `Payment for invoice ${invoice.invoice_number} received. MenRush Premium is active.`,
          linkPath: '/premium',
        });
      } catch (err) {
        console.error('[invoice] notification failed:', err);
      }

      try {
        const userRow = await query(`SELECT email, name FROM users WHERE id = $1`, [invoice.user_id]);
        const user = userRow.rows[0];
        if (user?.email && process.env.NODE_ENV !== 'test' && !user.email.endsWith('@test.menrush.local')) {
          const formattedAmount = (invoice.amount_pence / 100).toFixed(2);
          const untilStr = grantResult.premiumUntil
            ? grantResult.premiumUntil.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
            : 'Active';

          const html = buildTransactionalEmail({
            title: 'MenRush Premium Activated',
            preheader: `Payment confirmed for ${invoice.invoice_number}.`,
            headlineHtml: 'MenRush <span style="color:#C4832A;">Premium</span> Active',
            subheadline: `Payment of £${formattedAmount} confirmed.`,
            bodyHtml:
              transactionalParagraph(`Hi ${user.name || 'there'} — your manual payment has been confirmed.`) +
              transactionalParagraph(
                `Your Premium perks are active${grantResult.premiumUntil ? ` until <strong style="color:#F0E0C0;">${untilStr}</strong>` : ''}.`,
              ) +
              transactionalParagraph(
                `<span style="color:#A89070; font-size:13px;">Invoice: ${invoice.invoice_number} &bull; Reference: ${invoice.payment_reference}</span>`,
              ),
            ctaUrl: `${process.env.FRONTEND_URL || 'https://menrush.com'}/premium`,
            ctaLabel: 'View Premium status',
          });

          await sendTransactionalEmail({
            to: user.email,
            subject: 'MenRush Premium Activated — Payment Confirmed',
            html,
            text: `Hi ${user.name || 'there'} — your payment of £${formattedAmount} for invoice ${invoice.invoice_number} is confirmed. Premium is active until ${untilStr}.`,
          });
        }
      } catch (err) {
        console.error('[invoice] confirmation email failed:', err);
      }

      return {
        invoice: updatedInvoice,
        userPremium: {
          premiumUntil: grantResult.premiumUntil,
          isPremium: true,
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
