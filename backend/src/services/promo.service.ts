import crypto from 'crypto';
import type { PoolClient } from 'pg';
import pool, { query } from '../db';
import { sendTransactionalEmail } from './mailer.service';

type Queryable = PoolClient | typeof pool;

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
    // Live Brighton Pride: redeem by 31 October 2026. Premium clocks from 1 Oct 2026.
    expiresAt: new Date('2026-10-31T23:59:59Z'),
  },
};

export function getCampaign(id: string): CampaignConfig | null {
  return CAMPAIGNS[id] ?? null;
}

/** Printed public Pride QR code. Spaces ignored on match. Redeem at register by 5 Sep 2026. */
export const SHARED_PRIDE_DISPLAY_CODE = 'PRIDE 3MONTH FREE';
export const SHARED_PRIDE_NORMALIZED = 'PRIDE3MONTHFREE';
export const SHARED_PRIDE_CAMPAIGN = 'pride26_public';
/** User-facing error after the public enter-by window. */
export const SHARED_PRIDE_EXPIRED_MESSAGE =
  'This Pride promo expired on 5 September 2026.';
export const BRIGHTON_PRIDE_CAMPAIGN = 'brightonpride26';
/** Booked via Pride-flagged MENRUSH invite (21–31 Aug /pride). Not a second code family. */
export const PRIDE_INVITE_CAMPAIGN = 'pride26_invite';
/** Last moment to ENTER the public code (Finance/Legal). */
export const SHARED_PRIDE_ENTER_BY = new Date('2026-09-05T23:59:59Z');
/**
 * Pride-flagged invite issue window (UK): 21 Aug 2026 00:00 BST → end of 31 Aug 2026 BST.
 * BST = UTC+1 → opens 2026-08-20T23:00:00Z, closes 2026-08-31T22:59:59Z.
 */
export const PRIDE_INVITE_ISSUE_OPENS = new Date('2026-08-20T23:00:00Z');
export const PRIDE_INVITE_ISSUE_CLOSES = new Date('2026-08-31T22:59:59Z');
/** Scheduled UK launch — override with MENRUSH_LAUNCH_AT (ISO) if launch slips. */
export const SHARED_PRIDE_SCHEDULED_LAUNCH = new Date('2026-10-01T00:00:00Z');
export const SHARED_PRIDE_MONTHS_FREE = 3;

export function isPrideInviteIssueOpen(now = new Date()): boolean {
  const t = now.getTime();
  return t >= PRIDE_INVITE_ISSUE_OPENS.getTime() && t <= PRIDE_INVITE_ISSUE_CLOSES.getTime();
}

/**
 * Premium window for Pride grants (Legal-locked).
 * Booked before launch → starts at launch (on-time 1 Oct → 1 Jan; if launch slips, end moves).
 * First entered after open → starts at that redeem date (3 months from then).
 */
export function pridePremiumWindow(
  months = SHARED_PRIDE_MONTHS_FREE,
  now = new Date(),
): { premiumStart: Date; premiumEnd: Date } {
  const launch = getMenRushLaunchDate();
  const premiumStart = now.getTime() >= launch.getTime() ? now : launch;
  return { premiumStart, premiumEnd: premiumEndFromLaunch(premiumStart, months) };
}

export function normalizeSharedPromoCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

export function formatPromoExpiryDate(d: Date): string {
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ] as const;
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** User-facing expiry line for a personal Pride code (uses issued row date when present). */
export function personalPrideExpiredMessage(expiresAt?: Date | null): string {
  if (expiresAt && !Number.isNaN(expiresAt.getTime())) {
    return `This Pride promo code expired on ${formatPromoExpiryDate(expiresAt)}.`;
  }
  return 'This Pride promo code expired on 31 October 2026.';
}

export function isSharedPrideCode(raw: string): boolean {
  return normalizeSharedPromoCode(raw) === SHARED_PRIDE_NORMALIZED;
}

/** Actual open date: MENRUSH_LAUNCH_AT env, else 1 October 2026. */
export function getMenRushLaunchDate(): Date {
  const raw = process.env.MENRUSH_LAUNCH_AT?.trim();
  if (raw) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date(SHARED_PRIDE_SCHEDULED_LAUNCH);
}

/** End of N calendar months from launch. On-time: 1 Oct → 1 Jan. Late launch: end moves with open date — never hard-code 1 January. */
export function premiumEndFromLaunch(launch: Date, months = SHARED_PRIDE_MONTHS_FREE): Date {
  const end = new Date(launch);
  end.setUTCMonth(end.getUTCMonth() + months);
  end.setUTCHours(23, 59, 59, 999);
  return end;
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
  | {
      valid: false;
      reason: 'not_found' | 'email_mismatch' | 'already_redeemed' | 'expired';
      /** Present when reason is expired — use for user-facing copy. */
      expiresAt?: Date | null;
    };

export type SharedPrideValidateResult =
  | { valid: true; monthsFree: number; campaign: string; premiumStart: Date; premiumEnd: Date }
  | {
      valid: false;
      reason: 'not_found' | 'already_redeemed' | 'expired' | 'other_pride_path';
    };

export const promoService = {
  /** True if this email was issued a legacy personal Pride code (closed claim form). */
  async emailHasBrightonPrideClaim(email: string): Promise<boolean> {
    const emailHash = hashEmail(email);
    const result = await query(
      `SELECT 1 FROM promo_codes
       WHERE campaign = $1 AND email_hash = $2
       LIMIT 1`,
      [BRIGHTON_PRIDE_CAMPAIGN, emailHash],
    );
    return result.rows.length > 0;
  },

  async emailHasPublicPrideRedeem(email: string): Promise<boolean> {
    const emailHash = hashEmail(email);
    const result = await query(
      `SELECT 1 FROM shared_promo_redemptions
       WHERE campaign = $1 AND email_hash = $2
       LIMIT 1`,
      [SHARED_PRIDE_CAMPAIGN, emailHash],
    );
    return result.rows.length > 0;
  },

  /** True if this email already booked Pride via a Pride-flagged MENRUSH invite. */
  async emailHasPrideInviteRedeem(email: string): Promise<boolean> {
    const emailHash = hashEmail(email);
    const result = await query(
      `SELECT 1 FROM shared_promo_redemptions
       WHERE campaign = $1 AND email_hash = $2
       LIMIT 1`,
      [PRIDE_INVITE_CAMPAIGN, emailHash],
    );
    return result.rows.length > 0;
  },

  /** Outstanding unused Pride-flagged invite for this email. */
  async emailHasPendingPrideInvite(email: string): Promise<boolean> {
    const normalised = email.trim().toLowerCase();
    const pendingInvite = await query(
      `SELECT 1 FROM beta_invite_codes
       WHERE LOWER(issued_email) = $1
         AND pride_months_free IS NOT NULL
         AND revoked_at IS NULL
         AND use_count < max_uses
         AND (expires_at IS NULL OR expires_at > NOW())
       LIMIT 1`,
      [normalised],
    );
    return pendingInvite.rows.length > 0;
  },

  /**
   * Any Pride path already claimed or outstanding (one grant, no stack).
   */
  async emailHasAnyPridePath(email: string): Promise<boolean> {
    if (await this.emailHasPublicPrideRedeem(email)) return true;
    if (await this.emailHasPrideInviteRedeem(email)) return true;
    if (await this.emailHasBrightonPrideClaim(email)) return true;
    if (await this.emailHasPendingPrideInvite(email)) return true;
    return false;
  },

  /**
   * Book / apply Pride Premium. Sets premium_starts_at so entitlement is not
   * usable before launch (or before first redeem after open). No second entry later.
   */
  async applyPridePremiumGrant(
    userId: string,
    monthsFree: number,
    client?: PoolClient,
  ): Promise<{ premiumStart: Date; premiumUntil: Date }> {
    const db: Queryable = client ?? pool;
    const { premiumStart, premiumEnd } = pridePremiumWindow(monthsFree);
    await db.query(
      `UPDATE users
       SET is_premium = TRUE,
           premium_tier = 'premium',
           premium_starts_at = $2,
           premium_until = $3,
           updated_at = NOW()
       WHERE id = $1`,
      [userId, premiumStart, premiumEnd],
    );
    return { premiumStart, premiumUntil: premiumEnd };
  },

  /**
   * Record Pride-flagged invite redemption + book Premium.
   */
  async bookPrideInviteGrant(
    email: string,
    userId: string,
    monthsFree: number,
    client?: PoolClient,
  ): Promise<{ monthsFree: number; premiumUntil: Date }> {
    const db: Queryable = client ?? pool;
    const emailHash = hashEmail(email);

    if (
      (await this.emailHasPublicPrideRedeem(email)) ||
      (await this.emailHasBrightonPrideClaim(email)) ||
      (await this.emailHasPrideInviteRedeem(email))
    ) {
      throw new Error(
        'This email already has a Pride Premium grant. The code cannot be stacked.',
      );
    }

    try {
      await db.query(
        `INSERT INTO shared_promo_redemptions
           (campaign, code_normalized, user_id, email_hash)
         VALUES ($1, $2, $3, $4)`,
        [PRIDE_INVITE_CAMPAIGN, 'MENRUSHPRIDEINVITE', userId, emailHash],
      );
    } catch (err: unknown) {
      const pg = err as { code?: string };
      if (pg.code === '23505') {
        throw new Error(
          'This email already has a Pride Premium grant. The code cannot be stacked.',
        );
      }
      throw err;
    }

    const { premiumUntil } = await this.applyPridePremiumGrant(userId, monthsFree, client);
    return { monthsFree, premiumUntil };
  },

  /**
   * Validate the printed public Pride QR code (PRIDE 3MONTH FREE).
   * Spaces ignored. One per email. Enter-by 5 September 2026.
   * Blocks if this email already has another Pride path (no stacking).
   */
  async validateSharedPride(
    code: string,
    email: string,
  ): Promise<SharedPrideValidateResult> {
    if (!isSharedPrideCode(code)) {
      return { valid: false, reason: 'not_found' };
    }
    if (Date.now() > SHARED_PRIDE_ENTER_BY.getTime()) {
      return { valid: false, reason: 'expired' };
    }

    if (await this.emailHasBrightonPrideClaim(email)) {
      return { valid: false, reason: 'other_pride_path' };
    }
    if (await this.emailHasPrideInviteRedeem(email)) {
      return { valid: false, reason: 'other_pride_path' };
    }
    if (await this.emailHasPendingPrideInvite(email)) {
      return { valid: false, reason: 'other_pride_path' };
    }

    const emailHash = hashEmail(email);
    const existing = await query(
      `SELECT 1 FROM shared_promo_redemptions
       WHERE campaign = $1 AND email_hash = $2
       LIMIT 1`,
      [SHARED_PRIDE_CAMPAIGN, emailHash],
    );
    if (existing.rows.length > 0) {
      return { valid: false, reason: 'already_redeemed' };
    }

    const { premiumStart, premiumEnd } = pridePremiumWindow();
    return {
      valid: true,
      monthsFree: SHARED_PRIDE_MONTHS_FREE,
      campaign: SHARED_PRIDE_CAMPAIGN,
      premiumStart,
      premiumEnd,
    };
  },

  /**
   * Redeem printed public Pride code for a new user.
   * Premium: 3 calendar months from actual launch (or first redeem after open).
   * Does not stack with Pride invite or Brighton personal code.
   */
  async redeemSharedPride(
    code: string,
    email: string,
    userId: string,
    client?: PoolClient,
  ): Promise<{ monthsFree: number; premiumUntil: Date }> {
    const db: Queryable = client ?? pool;
    const validation = await this.validateSharedPride(code, email);
    if (!validation.valid) {
      if (validation.reason === 'other_pride_path') {
        throw new Error(
          'This email already has a Pride Premium grant. The code cannot be stacked.',
        );
      }
      if (validation.reason === 'expired') {
        throw new Error(SHARED_PRIDE_EXPIRED_MESSAGE);
      }
      if (validation.reason === 'already_redeemed') {
        throw new Error('This Pride promo has already been used for this email.');
      }
      throw new Error('This promo code is not valid.');
    }

    const emailHash = hashEmail(email);
    try {
      await db.query(
        `INSERT INTO shared_promo_redemptions
           (campaign, code_normalized, user_id, email_hash)
         VALUES ($1, $2, $3, $4)`,
        [SHARED_PRIDE_CAMPAIGN, SHARED_PRIDE_NORMALIZED, userId, emailHash],
      );
    } catch (err: unknown) {
      const pg = err as { code?: string };
      if (pg.code === '23505') {
        throw new Error('This Pride promo has already been used for this email.');
      }
      throw err;
    }

    const { premiumUntil } = await this.applyPridePremiumGrant(
      userId,
      validation.monthsFree,
      client,
    );

    return {
      monthsFree: validation.monthsFree,
      premiumUntil,
    };
  },
  /**
   * Issue a promo code for the given email + campaign.
   *
   * New brightonpride26 claims are closed (public offer is /pride only).
   * Already-issued personal codes stay redeemable via validate/redeem.
   * Pride waitlist uses Pride-flagged MENRUSH invites (prideInvite.service) — not this.
   */
  async issueCode(
    email: string,
    campaignId: string,
  ): Promise<PromoSignupResult> {
    const campaign = getCampaign(campaignId);
    if (!campaign) throw new Error(`Unknown campaign: ${campaignId}`);

    if (campaignId === BRIGHTON_PRIDE_CAMPAIGN) {
      throw new Error('campaign_closed');
    }
    if (campaignId === 'pride26_waitlist') {
      // Face form posts here historically — route layer should call prideInviteService.
      throw new Error('use_pride_invite');
    }

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
    if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
      return { valid: false, reason: 'expired', expiresAt: new Date(row.expires_at) };
    }

    return {
      valid: true,
      monthsFree: row.months_free,
      campaign: row.campaign,
    };
  },

  /**
   * Redeem an already-issued personal Pride code (e.g. PRIDE-XXXX-XXXX) at register.
   * Applies Premium for months_free calendar months from actual launch.
   * Blocks stack with public PRIDE 3MONTH FREE. Redeem-by follows promo_codes.expires_at
   * (31 Oct 2026 for brightonpride26 after migration 037).
   */
  async redeemPersonalPride(
    code: string,
    email: string,
    userId: string,
    client?: PoolClient,
  ): Promise<{ monthsFree: number; premiumUntil: Date }> {
    const db: Queryable = client ?? pool;
    if (isSharedPrideCode(code)) {
      throw new Error('This promo code is not valid.');
    }

    const normalised = code.trim().toUpperCase();
    const validation = await this.validate(normalised, email);
    if (!validation.valid) {
      if (validation.reason === 'email_mismatch') {
        throw new Error('This Pride code is locked to a different email address.');
      }
      if (validation.reason === 'expired') {
        throw new Error(personalPrideExpiredMessage(validation.expiresAt));
      }
      if (validation.reason === 'already_redeemed') {
        throw new Error('This Pride promo code has already been used.');
      }
      throw new Error('This promo code is not valid.');
    }

    if (await this.emailHasPublicPrideRedeem(email)) {
      throw new Error(
        'This email already has a Pride Premium grant. The code cannot be stacked.',
      );
    }
    if (await this.emailHasPrideInviteRedeem(email)) {
      throw new Error(
        'This email already has a Pride Premium grant. The code cannot be stacked.',
      );
    }

    const updated = await db.query(
      `UPDATE promo_codes
       SET redeemed_at = NOW(), redeemed_by = $1
       WHERE code = $2 AND redeemed_at IS NULL
       RETURNING code`,
      [userId, normalised],
    );
    if (updated.rows.length === 0) {
      throw new Error('This Pride promo code has already been used.');
    }

    const { premiumUntil } = await this.applyPridePremiumGrant(
      userId,
      validation.monthsFree,
      client,
    );

    return {
      monthsFree: validation.monthsFree,
      premiumUntil,
    };
  },

  /**
   * Mark a personal promo code as redeemed and apply the Premium grant.
   * Auth register prefers redeemPersonalPride (transaction client).
   */
  async redeem(
    code: string,
    email: string,
    userId: string,
  ): Promise<{ monthsFree: number; premiumUntil: Date }> {
    return this.redeemPersonalPride(code, email, userId);
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
              You're on the list. Your personal code is below (format PRIDE-XXXX-XXXX).
              It is <strong style="color:#8a7a6a;">not</strong> a beta invite (MENRUSH-XXXX).
              Enter this code at account signup on the same email — do not enter the public
              code PRIDE&nbsp;3MONTH&nbsp;FREE. Your ${campaign.monthsFree}&nbsp;months of Premium
              start on launch (1&nbsp;October&nbsp;2026), not the day you claimed this email.
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
              <li>Keep this email — your code is locked to <strong style="color:#8a7a6a;">${to}</strong></li>
              <li>This is a Premium promo code (PRIDE-XXXX-XXXX), not a /beta MENRUSH invite</li>
              <li>Redemption is at account signup — enter this personal code (not PRIDE 3MONTH FREE)</li>
              <li>When redeemed, Premium starts on launch. If open is 1&nbsp;October&nbsp;2026, Premium ends 1&nbsp;January&nbsp;2027. If launch slips, the 3 months run from the actual open date — not still 1&nbsp;January</li>
              <li>Redeem by 31&nbsp;October&nbsp;2026. Replaces the 30-day waitlist gift. Do not stack with the public /pride code</li>
            </ol>

            <!-- Fine print -->
            <p style="margin:0 0 32px;font-size:11px;color:#2a2010;line-height:1.6;border-top:1px solid #1a1210;padding-top:20px;">
              New members only. One code per user. Redeem by 31&nbsp;October&nbsp;2026 at account
              signup. Benefit clocks from launch (not claim day) for three calendar
              months. Replaces the 30-day waitlist Premium gift. Cannot be combined
              with other offers or the public /pride code. MenRush is an 18+ platform.
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

${campaign.monthsFree} months free Premium starting 1 October 2026 (not the day you claim).

YOUR CODE: ${formattedCode}

This code is locked to ${to}. Format PRIDE-XXXX-XXXX — not a beta MENRUSH invite.

How to redeem:
1. Keep this email
2. At account signup, enter this personal code (not PRIDE 3MONTH FREE) on the same email
3. When redeemed, Premium starts on launch. If open is 1 October 2026, Premium ends 1 January 2027. If launch slips, the 3 months run from the actual open date — not still 1 January
4. Redeem by 31 October 2026

Replaces the 30-day waitlist gift. Do not stack with the public /pride code.
New members only. One code per user. 18+.
Bronze Apps UK Limited — Company No. 17249857.`;

  await sendTransactionalEmail({
    to,
    subject: `Your MenRush Pride code: ${formattedCode}`,
    html,
    text,
  });
}
