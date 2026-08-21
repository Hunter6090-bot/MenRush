import { PoolClient } from 'pg';
import pool, { query } from '../db';
import {
  formatInviteCode,
  generateInviteCodeValue,
  normalizeInviteCode,
} from './invite-code.service';
import {
  isPrideInviteIssueOpen,
  promoService,
  SHARED_PRIDE_MONTHS_FREE,
} from './promo.service';
import { subscribeToWaitlist } from './drip.service';
import { sendWaitlistCampaignEmail } from './mailer.service';

/** Campaign id used by POST /api/campaigns/pride26_waitlist/signup */
export const PRIDE_WAITLIST_CAMPAIGN_ID = 'pride26_waitlist';

export type PrideInviteIssueResult = {
  outcome: 'created' | 'existing';
  code: string;
};

const PRIDE_WELCOME_TEMPLATE_KEY = 'mr-pride-invite-2026';

/**
 * Email body for Pride-flagged MENRUSH invites from /pride.
 * One code = closed beta + booked 3 months Premium from launch.
 */
export function buildPrideFlaggedInviteEmail(params: {
  to: string;
  code: string;
}): { subject: string; html: string; text: string } {
  const { to, code } = params;
  const registerUrl = `https://menrush.com/register?invite=${encodeURIComponent(code)}`;

  const subject = `Your MenRush Pride invite: ${code}`;

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
            <p style="margin:0 0 24px;font-size:15px;color:#7a6a5a;line-height:1.6;">
              You claimed this from menrush.com/pride. This one code is your
              <strong style="color:#8a7a6a;">beta invite</strong>
              and books <strong style="color:#8a7a6a;">3 months of Premium</strong>
              from launch. Enter it at register on the same email. Premium is not usable before launch.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
              <tr>
                <td style="background:#C4832A;padding:20px 24px;text-align:center;">
                  <p style="margin:0 0 4px;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#0D0A06;opacity:0.6;">Your Pride code</p>
                  <p style="margin:0;font-size:26px;font-weight:900;letter-spacing:3px;color:#0D0A06;font-family:monospace;">${code}</p>
                </td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
              <tr>
                <td style="border:1px solid #2a2010;padding:14px 18px;border-radius:4px;">
                  <p style="margin:0;font-size:13px;color:#5a4a3a;line-height:1.6;">
                    <strong style="color:#C4832A;">Create your account with this same email</strong>
                    (<strong style="color:#8a7a6a;">${to}</strong>).
                    Enter this code at
                    <a href="${registerUrl}" style="color:#C4832A;">menrush.com/register</a>
                    (link includes your invite). Entering it now books your Pride Premium grant.
                    You do <strong style="color:#8a7a6a;">not</strong> enter it again on 1&nbsp;October.
                    One person gets one Pride grant.
                  </p>
                </td>
              </tr>
            </table>
            <h2 style="margin:0 0 12px;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#C4832A;font-weight:700;">The bargain</h2>
            <ul style="margin:0 0 28px;padding-left:20px;color:#7a6a5a;font-size:14px;line-height:1.8;">
              <li>One code = beta access <strong style="color:#8a7a6a;">and</strong> 3 months Premium</li>
              <li>If you book before launch, Premium starts at launch. On-time open 1&nbsp;October&nbsp;2026 → ends 1&nbsp;January&nbsp;2027. If launch slips, 3 months from the actual open date. Nothing usable before launch.</li>
              <li>One Pride grant per person</li>
              <li>Replaces the 30-day waitlist Premium gift (Terms 7.2). It does not add to that gift</li>
            </ul>
            <p style="margin:0 0 24px;font-size:13px;color:#5a4a3a;line-height:1.6;">
              If this email is late or you do not receive a code, reply to this message or use Support on menrush.com.
              You can resend from /pride to this same email.
            </p>
            <p style="margin:0;font-size:11px;color:#3a2a1a;line-height:1.6;border-top:1px solid #1a1210;padding-top:20px;">
              New Pride codes were issued only 21–31&nbsp;August&nbsp;2026 from /pride.
              18+ only. Bronze Apps UK Limited (trading as MenRush).
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

You claimed this from menrush.com/pride.

YOUR CODE: ${code}

This one code is your beta invite AND books 3 months of Premium from launch. Enter it at register on the same email. Premium is not usable before launch.

Create your account with this same email (${to}).
Enter the code at ${registerUrl}
Entering it now BOOKS your Pride Premium grant. You do NOT enter it again on 1 October.
One person gets one Pride grant.

The bargain:
- One code = beta access and 3 months Premium
- If you book before launch, Premium starts at launch. On-time open 1 October 2026 → ends 1 January 2027. If launch slips, 3 months from the actual open date. Nothing usable before launch.
- One Pride grant per person
- Replaces the 30-day waitlist Premium gift (Terms 7.2). It does not add to that gift

If this email is late or missing, reply or use Support. You can resend from /pride to this same email.

New Pride codes issued only 21–31 August 2026 from /pride. 18+.
Bronze Apps UK Limited (trading as MenRush).`;

  return { subject, html, text };
}

async function markPrideWelcomeClaimed(subscriberId: string): Promise<void> {
  // Prevent ordinary drip welcome (invite-only) from also firing for this email.
  await query(
    `INSERT INTO waitlist_drip_sends (subscriber_id, template_key, sent_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (subscriber_id, template_key) DO NOTHING`,
    [subscriberId, PRIDE_WELCOME_TEMPLATE_KEY],
  );
  await query(
    `INSERT INTO waitlist_drip_sends (subscriber_id, template_key, sent_at)
     VALUES ($1, 'mr-d00-welcome', NOW())
     ON CONFLICT (subscriber_id, template_key) DO NOTHING`,
    [subscriberId],
  );
}

async function findUsablePrideInvite(email: string): Promise<string | null> {
  const result = await query(
    `SELECT code FROM beta_invite_codes
     WHERE LOWER(issued_email) = $1
       AND pride_months_free IS NOT NULL
       AND revoked_at IS NULL
       AND use_count < max_uses
       AND (expires_at IS NULL OR expires_at > NOW())
     ORDER BY created_at DESC
     LIMIT 1`,
    [email.trim().toLowerCase()],
  );
  return (result.rows[0] as { code: string } | undefined)?.code ?? null;
}

async function mintPrideFlaggedInvite(email: string): Promise<string> {
  const normalised = email.trim().toLowerCase();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { code, codeNormalized } = generateInviteCodeValue();
    try {
      await query(
        `INSERT INTO beta_invite_codes
           (code, code_normalized, max_uses, expires_at, note, pride_months_free, issued_email)
         VALUES ($1, $2, 1, NULL, $3, $4, $5)`,
        [
          code,
          codeNormalized,
          `pride-waitlist:${normalised}`,
          SHARED_PRIDE_MONTHS_FREE,
          normalised,
        ],
      );
      return code;
    } catch (error: unknown) {
      const pg = error as { code?: string };
      if (pg.code !== '23505' || attempt === 4) throw error;
    }
  }
  throw new Error('Could not issue Pride invite.');
}

/**
 * /pride claim (21–31 Aug UK for NEW codes): subscribe + email a Pride-flagged MENRUSH invite.
 * After the window closes, resend of an existing unused invite is still allowed.
 * Homepage /#waitlist stays ordinary invite-only.
 */
export const prideInviteService = {
  async issueFromPridePage(emailRaw: string): Promise<PrideInviteIssueResult> {
    const email = emailRaw.trim().toLowerCase();
    const windowOpen = isPrideInviteIssueOpen();

    // Already fully granted via another path. Do not mint a Pride invite on top.
    if (await promoService.emailHasPublicPrideRedeem(email)) {
      throw new Error('other_pride_path');
    }
    if (await promoService.emailHasPrideInviteRedeem(email)) {
      throw new Error('other_pride_path');
    }
    if (await promoService.emailHasBrightonPrideClaim(email)) {
      throw new Error('other_pride_path');
    }

    const existing = await findUsablePrideInvite(email);
    if (!windowOpen && !existing) {
      throw new Error('issue_window_closed');
    }

    const subscriber = await subscribeToWaitlist(email, 'pride');
    await markPrideWelcomeClaimed(subscriber.id);

    let code = existing;
    let outcome: 'created' | 'existing' = 'existing';
    if (!code) {
      code = await mintPrideFlaggedInvite(email);
      outcome = 'created';
    }

    const mail = buildPrideFlaggedInviteEmail({ to: email, code });
    try {
      await sendWaitlistCampaignEmail({
        to: email,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
      });
    } catch (err) {
      console.error('[pride-invite] email send failed:', err);
      throw new Error('email_send_failed');
    }

    return { outcome, code };
  },
};

/** Used by auth register. Load pride flag for a code inside a transaction. */
export async function loadPrideMonthsForInvite(
  rawCode: string,
  client: PoolClient | typeof pool = pool,
): Promise<number | null> {
  const normalized = normalizeInviteCode(rawCode);
  const result = await client.query<{ pride_months_free: number | null; issued_email: string | null }>(
    `SELECT pride_months_free, issued_email
     FROM beta_invite_codes
     WHERE code_normalized = $1`,
    [normalized],
  );
  const row = result.rows[0];
  if (!row?.pride_months_free) return null;
  return row.pride_months_free;
}

export async function assertPrideInviteEmailMatch(
  rawCode: string,
  email: string,
  client: PoolClient | typeof pool = pool,
): Promise<void> {
  const normalized = normalizeInviteCode(rawCode);
  const result = await client.query<{ issued_email: string | null; pride_months_free: number | null }>(
    `SELECT issued_email, pride_months_free
     FROM beta_invite_codes
     WHERE code_normalized = $1`,
    [normalized],
  );
  const row = result.rows[0];
  if (!row?.pride_months_free) return;
  const locked = row.issued_email?.trim().toLowerCase();
  if (locked && locked !== email.trim().toLowerCase()) {
    throw new Error('This Pride invite is locked to a different email address.');
  }
}

// Re-export format for callers that only need display helpers from this module.
export { formatInviteCode };
