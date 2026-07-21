import crypto from 'crypto';
import { query } from '../db';
import { sendTransactionalEmail } from './mailer.service';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const CODE_CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // no 0/O/1/I/L confusion

function randomSegment(length: number): string {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += CODE_CHARS[bytes[i]! % CODE_CHARS.length];
  }
  return out;
}

/**
 * Generate a human-readable promo code.
 * Format: PREFIX-XXXX-XXXX  (e.g. PRIDE-A3F7-B2C1)
 */
export function generatePromoCode(prefix: string): string {
  return `${prefix}-${randomSegment(4)}-${randomSegment(4)}`;
}

/**
 * Normalise and hash an email address for secure storage and comparison.
 * We store the hash for redemption checks so the lookup cannot be reversed,
 * and the plain email only for sending.
 */
export function hashEmail(email: string): string {
  return crypto
    .createHash('sha256')
    .update(email.trim().toLowerCase())
    .digest('hex');
}

// ─────────────────────────────────────────────────────────────────────────────
// Campaign configuration
// ─────────────────────────────────────────────────────────────────────────────

export interface CampaignConfig {
  id: string;           // used as promo_codes.campaign
  codePrefix: string;   // e.g. 'PRIDE'
  monthsFree: number;
  expiresAt: Date | null;
}

const CAMPAIGNS: Record<string, CampaignConfig> = {
  brightonpride26: {
    id: 'brightonpride26',
    codePrefix: 'PRIDE',
    monthsFree: 3,
    // Redeem by 31 October 2026 — one month after launch, gives people time to sign up
    expiresAt: new Date('2026-10-31T23:59:59Z'),
  },
};

export function getCampaign(id: string): CampaignConfig | null {
  return CAMPAIGNS[id] ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Core service
// ─────────────────────────────────────────────────────────────────────────────

export interface PromoSignupResult {
  /** 'created' = new code issued and emailed; 'existing' = already had one, re-sent */
  outcome: 'created' | 'existing';
  code: string;
}

export type PromoValidateResult =
  | { valid: true; monthsFree: number; campaign: string }
  | { valid: false; reason: 'not_found' | 'email_mismatch' | 'already_redeemed' | 'expired' };

export const promoService = {
  /**
   * Issue a promo code for the given email + campaign.
   *
   * - Idempotent: if the email already has a code for this campaign, we resend
   *   the existing one rather than create a duplicate.
   * - Generates a unique code with up to 5 collision retries.
   * - Sends a branded email with the code.
   */
  async issueCode(
    email: string,
    campaignId: string,
  ): Promise<PromoSignupResult> {
    const campaign = getCampaign(campaignId);
    if (!campaign) throw new Error(`Unknown campaign: ${campaignId}`);

    const normalised = email.trim().toLowerCase();
    const emailHash = hashEmail(normalised);

    // Check for existing code for this email+campaign
    const existing = await query(
      `SELECT code FROM promo_codes
       WHERE email_hash = $1 AND campaign = $2
       LIMIT 1`,
      [emailHash, campaignId],
    );

    if (existing.rows.length > 0) {
      const code = (existing.rows[0] as { code: string }).code;
      await sendPromoEmail({ to: normalised, code, campaign });
      return { outcome: 'existing', code };
    }

    // Generate a unique code (retry on collision — astronomically rare)
    let code = '';
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = generatePromoCode(campaign.codePrefix);
      try {
        await query(
          `INSERT INTO promo_codes
             (code, email, email_hash, campaign, months_free, expires_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            candidate,
            normalised,
            emailHash,
            campaign.id,
            campaign.monthsFree,
            campaign.expiresAt,
          ],
        );
        code = candidate;
        break;
      } catch (err: any) {
        // 23505 = unique_violation (code collision)
        if (err.code !== '23505' || attempt === 4) throw err;
      }
    }

    await sendPromoEmail({ to: normalised, code, campaign });
    return { outcome: 'created', code };
  },

  /**
   * Validate a promo code at account registration time.
   *
   * Security: the code is only valid for the exact email it was issued to.
   * Someone who received code PRIDE-XXXX-YYYY cannot share it — a different
   * email will hit 'email_mismatch'.
   */
  async validate(
    code: string,
    email: string,
  ): Promise<PromoValidateResult> {
    const normalised = code.trim().toUpperCase();
    const emailHash = hashEmail(email);

    const result = await query(
      `SELECT email_hash, campaign, months_free, expires_at, redeemed_at
       FROM promo_codes
       WHERE code = $1`,
      [normalised],
    );

    if (result.rows.length === 0) return { valid: false, reason: 'not_found' };
    type PromoRow = {
      email_hash: string;
      campaign: string;
      months_free: number;
      expires_at: Date | null;
      redeemed_at: Date | null;
    };

    const row = result.rows[0] as PromoRow;

    if (row.email_hash !== emailHash) return { valid: false, reason: 'email_mismatch' };
    if (row.redeemed_at) return { valid: false, reason: 'already_redeemed' };
    if (row.expires_at && row.expires_at.getTime() < Date.now()) {
      return { valid: false, reason: 'expired' };
    }

    return {
      valid: true,
      monthsFree: row.months_free,
      campaign: row.campaign,
    };
  },

  /**
   * Mark a promo code as redeemed.
   * Call this AFTER the user account has been created and userId is known.
   * Returns the number of free months applied.
   */
  async redeem(
    code: string,
    email: string,
    userId: string,
  ): Promise<{ monthsFree: number }> {
    const validation = await this.validate(code, email);
    if (!validation.valid) {
      throw new Error(`Promo code cannot be redeemed: ${validation.reason}`);
    }

    await query(
      `UPDATE promo_codes
       SET redeemed_at = NOW(), redeemed_by = $1
       WHERE code = $2 AND redeemed_at IS NULL`,
      [userId, code.trim().toUpperCase()],
    );

    return { monthsFree: validation.monthsFree };
  },

  /**
   * Admin: count codes issued and redeemed for a campaign.
   */
  async stats(campaignId: string) {
    const result = await query(
      `SELECT
         COUNT(*) AS total,
         COUNT(redeemed_at) AS redeemed
       FROM promo_codes
       WHERE campaign = $1`,
      [campaignId],
    );
    const row = (result.rows[0] as { total: string; redeemed: string } | undefined) ?? { total: '0', redeemed: '0' };
    return {
      campaign: campaignId,
      total: parseInt(row.total, 10),
      redeemed: parseInt(row.redeemed, 10),
    };
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Email template
// ─────────────────────────────────────────────────────────────────────────────

async function sendPromoEmail(params: {
  to: string;
  code: string;
  campaign: CampaignConfig;
}): Promise<void> {
  const { to, code, campaign } = params;

  const formattedCode = code; // already formatted as PREFIX-XXXX-XXXX

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Your MenRush Pride code</title>
</head>
<body style="margin:0;padding:0;background:#0D0A06;font-family:system-ui,-apple-system,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0D0A06;padding:40px 20px;">
  <tr>
    <td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

        <!-- Rainbow stripe -->
        <tr>
          <td style="height:8px;background:linear-gradient(to right,#E40303,#FF8C00,#FFED00,#008026,#004DFF,#750787);border-radius:4px 4px 0 0;"></td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background:#120E08;border:1px solid #2a2010;border-top:none;border-radius:0 0 4px 4px;padding:40px 36px;">

            <!-- Logo / brand -->
            <p style="margin:0 0 32px;font-size:13px;letter-spacing:4px;text-transform:uppercase;color:#C4832A;font-weight:700;">MENRUSH</p>

            <!-- Headline -->
            <h1 style="margin:0 0 12px;font-size:28px;font-weight:900;color:#F0E0C0;line-height:1.1;text-transform:uppercase;letter-spacing:-0.5px;">
              Your Brighton Pride<br>offer is here.
            </h1>
            <p style="margin:0 0 32px;font-size:15px;color:#7a6a5a;line-height:1.6;">
              You're on the list. When MenRush launches on 1&nbsp;October&nbsp;2026,
              use the code below to activate ${campaign.monthsFree}&nbsp;months of Premium — on us.
            </p>

            <!-- Code box -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
              <tr>
                <td style="background:#C4832A;padding:20px 24px;text-align:center;">
                  <p style="margin:0 0 4px;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#0D0A06;opacity:0.6;">Your personal code</p>
                  <p style="margin:0;font-size:28px;font-weight:900;letter-spacing:4px;color:#0D0A06;font-family:monospace;">${formattedCode}</p>
                </td>
              </tr>
            </table>

            <!-- Lock note -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 32px;">
              <tr>
                <td style="border:1px solid #2a2010;padding:14px 18px;border-radius:4px;">
                  <p style="margin:0;font-size:13px;color:#5a4a3a;line-height:1.6;">
                    <strong style="color:#C4832A;">This code is yours alone.</strong>
                    It only works with the email address you signed up with
                    (<strong style="color:#8a7a6a;">${to}</strong>).
                    It cannot be transferred or resold.
                  </p>
                </td>
              </tr>
            </table>

            <!-- How to redeem -->
            <h2 style="margin:0 0 12px;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#C4832A;font-weight:700;">How to redeem</h2>
            <ol style="margin:0 0 32px;padding-left:20px;color:#7a6a5a;font-size:14px;line-height:1.8;">
              <li>Download MenRush on 1&nbsp;October&nbsp;2026</li>
              <li>Create your account using <strong style="color:#8a7a6a;">${to}</strong></li>
              <li>Enter your code <strong style="color:#F0E0C0;">${formattedCode}</strong> in the Premium section</li>
              <li>Enjoy ${campaign.monthsFree}&nbsp;months free — no card required until it expires</li>
            </ol>

            <!-- Fine print -->
            <p style="margin:0 0 32px;font-size:11px;color:#2a2010;line-height:1.6;border-top:1px solid #1a1210;padding-top:20px;">
              New members only. One offer per person. Must be redeemed by 31&nbsp;October&nbsp;2026.
              Cannot be combined with other offers. MenRush is an 18+ platform.
              Bronze Apps UK Limited — Company No.&nbsp;17249857.
            </p>

            <!-- CTA -->
            <p style="margin:0;font-size:13px;color:#4a3a2a;">
              Questions? Reply to this email or visit
              <a href="https://menrush.com" style="color:#C4832A;text-decoration:none;">menrush.com</a>
            </p>

          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  const text = `Your MenRush Pride code

${campaign.monthsFree} months free Premium — use it when we launch on 1 October 2026.

YOUR CODE: ${formattedCode}

This code is locked to ${to}. It only works with this email address.

How to redeem:
1. Download MenRush on 1 October 2026
2. Create your account using ${to}
3. Enter your code in the Premium section

Expires: 31 October 2026. New members only. 18+.
Bronze Apps UK Limited — Company No. 17249857.`;

  await sendTransactionalEmail({
    to,
    subject: `Your MenRush Pride code: ${formattedCode}`,
    html,
    text,
  });
}
