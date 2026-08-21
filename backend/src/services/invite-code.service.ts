import crypto from 'crypto';
import { PoolClient } from 'pg';
import pool, { query } from '../db';
import { sendTransactionalEmail } from './mailer.service';
import {
  BRIGHTON_PRIDE_CAMPAIGN,
  getMenRushLaunchDate,
  hashEmail,
  premiumEndFromLaunch,
  PRIDE_INVITE_REDEEM_CAMPAIGN,
  PRIDE_WAITLIST_INVITE_CAMPAIGN,
  SHARED_PRIDE_CAMPAIGN,
  SHARED_PRIDE_MONTHS_FREE,
} from './promo.service';

const CODE_CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export const PRIDE_WAITLIST_ISSUE_OPENS_AT = new Date('2026-08-21T00:00:00.000Z');
export const PRIDE_WAITLIST_ISSUE_CLOSES_AT = new Date('2026-08-31T23:59:59.999Z');
export const PRIDE_WAITLIST_SOURCE = 'pride';

/** Re-export for routes/tests. */
export { PRIDE_INVITE_REDEEM_CAMPAIGN, PRIDE_WAITLIST_INVITE_CAMPAIGN };

/** Injectable clock for issuance-window tests. */
let inviteNowMs: () => number = () => Date.now();

export function setInviteClockForTests(fn: (() => number) | null): void {
  inviteNowMs = fn ?? (() => Date.now());
}

export function prideWaitlistIssuanceOpen(atMs: number = inviteNowMs()): boolean {
  return (
    atMs >= PRIDE_WAITLIST_ISSUE_OPENS_AT.getTime() &&
    atMs <= PRIDE_WAITLIST_ISSUE_CLOSES_AT.getTime()
  );
}

export function normalizeInviteCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[\s-]+/g, '');
}

export function formatInviteCode(normalized: string): string {
  const body = normalized.startsWith('MENRUSH') ? normalized.slice(7) : normalized;
  if (body.length !== 8) return normalized;
  return `MENRUSH-${body.slice(0, 4)}-${body.slice(4)}`;
}

function randomPart(length: number): string {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += CODE_CHARS[bytes[i]! % CODE_CHARS.length];
  }
  return out;
}

export function generateInviteCodeValue(): { code: string; codeNormalized: string } {
  const codeNormalized = `MENRUSH${randomPart(4)}${randomPart(4)}`;
  return {
    code: formatInviteCode(codeNormalized),
    codeNormalized,
  };
}

export function isInviteRequired(): boolean {
  return process.env.BETA_INVITE_REQUIRED === 'true';
}

type InviteRow = {
  id: string;
  code: string;
  max_uses: number;
  use_count: number;
  expires_at: Date | null;
  revoked_at: Date | null;
  premium_months_from_launch: number | null;
  issued_to_email: string | null;
  campaign: string | null;
};

function inviteUnavailableMessage(): string {
  return 'This invite code is invalid or has already been used.';
}

async function findInviteRow(
  client: PoolClient | typeof pool,
  normalized: string,
  forUpdate = false,
): Promise<InviteRow | null> {
  const lock = forUpdate ? 'FOR UPDATE' : '';
  const result = await client.query<InviteRow>(
    `SELECT id, code, max_uses, use_count, expires_at, revoked_at,
            premium_months_from_launch, issued_to_email, campaign
     FROM beta_invite_codes
     WHERE code_normalized = $1
     ${lock}`,
    [normalized],
  );
  return result.rows[0] ?? null;
}

function isInviteUsable(row: InviteRow | null): row is InviteRow {
  if (!row || row.revoked_at) return false;
  if (row.expires_at && row.expires_at.getTime() <= inviteNowMs()) return false;
  return row.use_count < row.max_uses;
}

export type PrideWaitlistSignupResult = {
  outcome: 'created' | 'existing';
  code: string;
};

export const inviteCodeService = {
  async validate(
    rawCode: string,
  ): Promise<
    | { valid: true; code: string; premiumMonthsFromLaunch: number | null }
    | { valid: false }
  > {
    const normalized = normalizeInviteCode(rawCode);
    if (!normalized.startsWith('MENRUSH') || normalized.length !== 15) {
      return { valid: false };
    }

    const row = await findInviteRow(pool, normalized);
    if (!isInviteUsable(row)) {
      return { valid: false };
    }

    return {
      valid: true,
      code: row.code,
      premiumMonthsFromLaunch: row.premium_months_from_launch,
    };
  },

  async redeemForRegistration(rawCode: string, userId: string, client: PoolClient): Promise<{
    premiumMonthsFromLaunch: number | null;
    campaign: string | null;
  }> {
    const normalized = normalizeInviteCode(rawCode);
    if (!normalized.startsWith('MENRUSH') || normalized.length !== 15) {
      throw new Error(inviteUnavailableMessage());
    }

    const row = await findInviteRow(client, normalized, true);
    if (!isInviteUsable(row)) {
      throw new Error(inviteUnavailableMessage());
    }

    await client.query(
      `UPDATE beta_invite_codes
       SET use_count = use_count + 1
       WHERE id = $1`,
      [row.id],
    );

    await client.query(
      `INSERT INTO beta_invite_redemptions (invite_code_id, user_id)
       VALUES ($1, $2)`,
      [row.id, userId],
    );

    return {
      premiumMonthsFromLaunch: row.premium_months_from_launch,
      campaign: row.campaign,
    };
  },

  /**
   * Apply the Pride Premium grant carried on a beta invite (same MENRUSH code).
   * Clocks from actual launch. Records pride26_invite so public / Brighton cannot stack.
   */
  async applyPridePremiumFromInvite(
    userId: string,
    email: string,
    months: number,
    client: PoolClient,
  ): Promise<{ premiumUntil: Date }> {
    const monthsFree = months > 0 ? months : SHARED_PRIDE_MONTHS_FREE;
    const premiumEnd = premiumEndFromLaunch(getMenRushLaunchDate(), monthsFree);
    const emailHash = hashEmail(email);

    try {
      await client.query(
        `INSERT INTO shared_promo_redemptions
           (campaign, code_normalized, user_id, email_hash)
         VALUES ($1, $2, $3, $4)`,
        [PRIDE_INVITE_REDEEM_CAMPAIGN, 'MENRUSH_PRIDE_INVITE', userId, emailHash],
      );
    } catch (err: unknown) {
      const pg = err as { code?: string };
      if (pg.code === '23505') {
        throw new Error(
          'This email already has a Pride Premium grant. The invite cannot be stacked.',
        );
      }
      throw err;
    }

    await client.query(
      `UPDATE users
       SET is_premium = TRUE,
           premium_tier = 'premium',
           premium_until = $2,
           updated_at = NOW()
       WHERE id = $1`,
      [userId, premiumEnd],
    );

    return { premiumUntil: premiumEnd };
  },

  async emailHasPrideWaitlistInvite(email: string): Promise<boolean> {
    const emailHash = hashEmail(email);
    const result = await query(
      `SELECT 1 FROM beta_invite_codes
       WHERE campaign = $1 AND issued_to_email_hash = $2 AND revoked_at IS NULL
       LIMIT 1`,
      [PRIDE_WAITLIST_INVITE_CAMPAIGN, emailHash],
    );
    return result.rows.length > 0;
  },

  async emailHasPrideInviteRedeem(email: string): Promise<boolean> {
    const emailHash = hashEmail(email);
    const result = await query(
      `SELECT 1 FROM shared_promo_redemptions
       WHERE campaign = $1 AND email_hash = $2
       LIMIT 1`,
      [PRIDE_INVITE_REDEEM_CAMPAIGN, emailHash],
    );
    return result.rows.length > 0;
  },

  /**
   * /pride waitlist: mint or resend the usual MENRUSH beta invite with
   * premium_months_from_launch = 3. Window: 21–31 Aug 2026 for NEW issuances.
   * Resend of an already-issued pride invite is always allowed.
   */
  async issueOrResendPrideWaitlistInvite(emailRaw: string): Promise<PrideWaitlistSignupResult> {
    const email = emailRaw.trim().toLowerCase();
    const emailHash = hashEmail(email);

    // Existing pride invite → always resend (even after window).
    const existing = await query(
      `SELECT code FROM beta_invite_codes
       WHERE campaign = $1 AND issued_to_email_hash = $2 AND revoked_at IS NULL
       ORDER BY created_at ASC
       LIMIT 1`,
      [PRIDE_WAITLIST_INVITE_CAMPAIGN, emailHash],
    );
    if (existing.rows[0]) {
      const code = (existing.rows[0] as { code: string }).code;
      await sendPrideWaitlistInviteEmail({ to: email, code });
      return { outcome: 'existing', code };
    }

    if (!prideWaitlistIssuanceOpen()) {
      throw new Error('pride_issuance_closed');
    }

    // No stacking with Brighton personal codes or already-redeemed Pride grants.
    const brighton = await query(
      `SELECT 1 FROM promo_codes
       WHERE campaign = $1 AND email_hash = $2
       LIMIT 1`,
      [BRIGHTON_PRIDE_CAMPAIGN, emailHash],
    );
    if (brighton.rows.length > 0) {
      throw new Error('already_has_pride_grant');
    }

    const publicRedeem = await query(
      `SELECT 1 FROM shared_promo_redemptions
       WHERE campaign = ANY($1::text[]) AND email_hash = $2
       LIMIT 1`,
      [[SHARED_PRIDE_CAMPAIGN, PRIDE_INVITE_REDEEM_CAMPAIGN], emailHash],
    );
    if (publicRedeem.rows.length > 0) {
      throw new Error('already_has_pride_grant');
    }

    let code = '';
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const { code: candidate, codeNormalized } = generateInviteCodeValue();
      try {
        await query(
          `INSERT INTO beta_invite_codes
             (code, code_normalized, max_uses, expires_at, note,
              premium_months_from_launch, issued_to_email, issued_to_email_hash, campaign)
           VALUES ($1, $2, 1, NULL, $3, $4, $5, $6, $7)`,
          [
            candidate,
            codeNormalized,
            `pride-waitlist:${email}`,
            SHARED_PRIDE_MONTHS_FREE,
            email,
            emailHash,
            PRIDE_WAITLIST_INVITE_CAMPAIGN,
          ],
        );
        code = candidate;
        break;
      } catch (error: unknown) {
        const pg = error as { code?: string };
        if (pg.code !== '23505' || attempt === 4) throw error;
      }
    }
    if (!code) {
      throw new Error('Failed to generate Pride waitlist invite code');
    }

    // Inline waitlist subscribe (avoid circular import with drip.service).
    const unsubToken = crypto.randomBytes(24).toString('hex');
    const subscribed = await query(
      `INSERT INTO waitlist (email, status, source, unsubscribe_token)
       VALUES ($1, 'active', $2, $3)
       ON CONFLICT (email) DO UPDATE
         SET source = COALESCE(waitlist.source, EXCLUDED.source),
             unsubscribe_token = COALESCE(waitlist.unsubscribe_token, EXCLUDED.unsubscribe_token)
       RETURNING id`,
      [email, PRIDE_WAITLIST_SOURCE, unsubToken],
    );
    const subscriberId = (subscribed.rows[0] as { id: string } | undefined)?.id;
    if (subscriberId) {
      // Prevent the standard waitlist welcome from minting a second MENRUSH invite.
      await query(
        `INSERT INTO waitlist_drip_sends (subscriber_id, template_key, sent_at, smtp_message_id)
         VALUES ($1, 'mr-d00-welcome', NOW(), 'pride-waitlist-invite')
         ON CONFLICT (subscriber_id, template_key) DO NOTHING`,
        [subscriberId],
      );
    }
    await sendPrideWaitlistInviteEmail({ to: email, code });
    return { outcome: 'created', code };
  },

  async generateBatch(options: {
    count: number;
    maxUses?: number;
    expiresInDays?: number;
    note?: string;
    premiumMonthsFromLaunch?: number | null;
    issuedToEmail?: string | null;
    campaign?: string | null;
  }): Promise<Array<{ code: string; code_normalized: string }>> {
    const count = Math.min(Math.max(options.count, 1), 500);
    const maxUses = Math.max(options.maxUses ?? 1, 1);
    const expiresAt =
      options.expiresInDays && options.expiresInDays > 0
        ? new Date(Date.now() + options.expiresInDays * 24 * 60 * 60 * 1000)
        : null;
    const email = options.issuedToEmail?.trim().toLowerCase() || null;
    const emailHash = email ? hashEmail(email) : null;

    const created: Array<{ code: string; code_normalized: string }> = [];

    for (let i = 0; i < count; i += 1) {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const { code, codeNormalized } = generateInviteCodeValue();
        try {
          await query(
            `INSERT INTO beta_invite_codes
               (code, code_normalized, max_uses, expires_at, note,
                premium_months_from_launch, issued_to_email, issued_to_email_hash, campaign)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              code,
              codeNormalized,
              maxUses,
              expiresAt,
              options.note ?? null,
              options.premiumMonthsFromLaunch ?? null,
              email,
              emailHash,
              options.campaign ?? null,
            ],
          );
          created.push({ code, code_normalized: codeNormalized });
          break;
        } catch (error: any) {
          if (error.code !== '23505' || attempt === 4) {
            throw error;
          }
        }
      }
    }

    return created;
  },

  async listCodes(limit = 100): Promise<
    Array<{
      id: string;
      code: string;
      max_uses: number;
      use_count: number;
      expires_at: Date | null;
      note: string | null;
      created_at: Date;
      revoked_at: Date | null;
      premium_months_from_launch: number | null;
      campaign: string | null;
    }>
  > {
    const capped = Math.min(Math.max(limit, 1), 500);
    const result = await query(
      `SELECT id, code, max_uses, use_count, expires_at, note, created_at, revoked_at,
              premium_months_from_launch, campaign
       FROM beta_invite_codes
       ORDER BY created_at DESC
       LIMIT $1`,
      [capped],
    );
    return result.rows;
  },
};

async function sendPrideWaitlistInviteEmail(params: { to: string; code: string }): Promise<void> {
  const { to, code } = params;
  if (process.env.PRIDE_WAITLIST_SKIP_EMAIL === 'true') {
    console.log(`[pride-waitlist] SKIP_EMAIL to=${to} code=${code}`);
    return;
  }
  const betaUrl = `https://menrush.com/beta?invite=${encodeURIComponent(code)}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Your MenRush Pride invite</title>
</head>
<body style="margin:0;padding:0;background:#0D0A06;font-family:system-ui,-apple-system,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0D0A06;padding:40px 20px;">
  <tr>
    <td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <tr>
          <td style="background:#120E08;border:1px solid #2a2010;border-radius:4px;padding:40px 36px;">
            <p style="margin:0 0 32px;font-size:13px;letter-spacing:4px;text-transform:uppercase;color:#C4832A;font-weight:700;">MENRUSH</p>
            <h1 style="margin:0 0 12px;font-size:28px;font-weight:900;color:#F0E0C0;line-height:1.1;text-transform:uppercase;letter-spacing:-0.5px;">
              Your Pride invite<br>is here.
            </h1>
            <p style="margin:0 0 32px;font-size:15px;color:#7a6a5a;line-height:1.6;">
              One code does two jobs: join the closed beta, and unlock
              <strong style="color:#8a7a6a;">3 months of Premium from launch</strong>
              (1&nbsp;October&nbsp;2026, or the actual open date if launch slips).
              Premium is not usable before launch.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
              <tr>
                <td style="background:#C4832A;padding:20px 24px;text-align:center;">
                  <p style="margin:0 0 4px;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#0D0A06;opacity:0.6;">Your invite code</p>
                  <p style="margin:0;font-size:26px;font-weight:900;letter-spacing:3px;color:#0D0A06;font-family:monospace;">${code}</p>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 24px;font-size:14px;color:#7a6a5a;line-height:1.7;">
              This is a beta invite (<strong style="color:#8a7a6a;">MENRUSH-XXXX</strong>),
              not a Brighton Pride promo (<strong style="color:#8a7a6a;">PRIDE-XXXX-XXXX</strong>)
              and not the public code <strong style="color:#8a7a6a;">PRIDE 3MONTH FREE</strong>.
              Enter this invite at signup. One Pride grant per person.
            </p>
            <p style="margin:0 0 32px;">
              <a href="${betaUrl}" style="display:inline-block;background:#C4832A;color:#0D0A06;font-weight:800;text-decoration:none;padding:14px 22px;border-radius:999px;">
                Enter your invite
              </a>
            </p>
            <p style="margin:0;font-size:11px;color:#5a4a3a;line-height:1.6;border-top:1px solid #1a1210;padding-top:20px;">
              Replaces the 30-day waitlist Premium gift. Cannot be stacked with Brighton personal codes or PRIDE 3MONTH FREE.
              18+. UK-first. Bronze Apps UK Limited.
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  const text = `Your MenRush Pride invite

Your invite code: ${code}

This code does two jobs:
1. Join the closed beta
2. 3 months of Premium from launch (1 October 2026, or actual open if launch slips)

Premium is not usable before launch.
Enter it at ${betaUrl}

This is a MENRUSH beta invite, not a Brighton PRIDE-XXXX-XXXX code and not PRIDE 3MONTH FREE.
One Pride grant per person. Replaces the 30-day waitlist gift.
18+. Bronze Apps UK Limited.`;

  await sendTransactionalEmail({
    to,
    subject: `Your MenRush Pride invite: ${code}`,
    html,
    text,
  });
}
