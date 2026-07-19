import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import pool, { query } from '../db';
import { inviteCodeService } from '../services/invite-code.service';
import { isDeliverableWaitlistEmail } from '../services/drip.service';
import { sendWaitlistCampaignEmail } from '../services/mailer.service';
import {
  buildTransactionalEmail,
  transactionalParagraph,
} from '../services/transactional-email.template';

const WAVE2_TEMPLATE_KEY = 'mr-wave2-invite';
const WAVE2_NOTE = 'wave-2';

type WaitlistRow = {
  id: number;
  email: string;
  source: string | null;
  unsubscribe_token: string | null;
};

function readFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function readArg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function isExcludedWaitlistEmail(row: WaitlistRow): boolean {
  const email = row.email.trim().toLowerCase();
  const source = (row.source || '').trim().toLowerCase();

  if (!isDeliverableWaitlistEmail(email)) return true;
  if (source === 'probe' || source === 'production-smoke' || source === 'production-live-proof') {
    return true;
  }
  if (/\+waitlist/i.test(email)) return true;
  if (email.endsWith('@menrush.com')) return true;

  return false;
}

function buildInviteEmail(code: string, unsubscribeUrl: string): { subject: string; html: string; text: string } {
  const betaUrl = 'https://menrush.com/beta';
  const bodyHtml = [
    transactionalParagraph(
      'You joined the MenRush waitlist — thank you for your patience. Wave 2 of the closed beta is open, and your personal invite is below.',
    ),
    transactionalParagraph(
      `<strong style="color:#F0E0C0;">Your invite code</strong><br/><span style="font-family:ui-monospace,monospace;font-size:20px;letter-spacing:0.08em;color:#E0A14A;">${code}</span>`,
      true,
    ),
    transactionalParagraph(
      'This code is single-use. Enter it at the beta gate, then create your account with the email this message was sent to. Premium is included free during the beta.',
    ),
    transactionalParagraph(
      `Questions? Reply to this email or write to <a href="mailto:hello@menrush.com" style="color:#C4832A;">hello@menrush.com</a>.`,
    ),
  ].join('');

  const html = buildTransactionalEmail({
    title: 'Your MenRush beta invite',
    preheader: `Your invite code: ${code}`,
    eyebrow: 'Beta wave 2',
    headlineHtml: 'You&apos;re <span style="color:#C4832A;">in.</span>',
    subheadline: 'Your personal invite code is ready.',
    bodyHtml,
    ctaUrl: betaUrl,
    ctaLabel: 'Enter your invite code',
    footerNote: 'You received this because you joined the MenRush waitlist.',
  }).replace(
    '</body>',
    `<div style="max-width:640px;margin:24px auto 0;padding:16px 24px;border-top:1px solid #2e2418;color:#a89070;font:12px/1.6 system-ui,sans-serif;text-align:center">
      Not interested any more? <a href="${unsubscribeUrl}" style="color:#c8861c">Unsubscribe</a>.
    </div></body>`,
  );

  const text = [
    "You're in — MenRush beta wave 2",
    '',
    `Your invite code: ${code}`,
    '',
    'Enter it at https://menrush.com/beta, then create your account with this email address.',
    'Premium is included free during the beta.',
    '',
    `Unsubscribe: ${unsubscribeUrl}`,
  ].join('\n');

  return {
    subject: 'Your MenRush beta invite is here',
    html,
    text,
  };
}

function buildUnsubscribeUrl(token: string): string {
  const base = (process.env.PUBLIC_API_URL || process.env.FRONTEND_URL || 'https://menrush.com').replace(
    /\/$/,
    '',
  );
  return `${base}/api/waitlist/unsubscribe?token=${encodeURIComponent(token)}`;
}

async function alreadySentWave2(subscriberId: number): Promise<boolean> {
  const result = await query(
    `SELECT 1 FROM waitlist_drip_sends
      WHERE subscriber_id = $1 AND template_key = $2
      LIMIT 1`,
    [subscriberId, WAVE2_TEMPLATE_KEY],
  );
  return (result.rowCount ?? 0) > 0;
}

async function main() {
  const dryRun = readFlag('dry-run');
  const outPath = readArg('out') || '/tmp/menrush-wave-2-invites.csv';

  const [waitlistRows, registeredRows] = await Promise.all([
    query(
      `SELECT id, email, source, unsubscribe_token
         FROM waitlist
        WHERE status = 'active'
        ORDER BY created_at ASC`,
    ),
    query(`SELECT LOWER(email) AS email FROM users`),
  ]);

  const registered = new Set(
    registeredRows.rows.map((row: { email: string }) => row.email),
  );

  const recipients = (waitlistRows.rows as WaitlistRow[]).filter((row) => {
    if (isExcludedWaitlistEmail(row)) return false;
    if (registered.has(row.email.trim().toLowerCase())) return false;
    return true;
  });

  const pending: WaitlistRow[] = [];
  for (const row of recipients) {
    if (await alreadySentWave2(row.id)) continue;
    pending.push(row);
  }

  console.log(
    JSON.stringify(
      {
        dry_run: dryRun,
        active_waitlist: waitlistRows.rows.length,
        eligible_recipients: recipients.length,
        pending_send: pending.length,
        out: outPath,
      },
      null,
      2,
    ),
  );

  if (pending.length === 0) {
    console.log('Nothing to send.');
    return;
  }

  const assignments: Array<{ email: string; code: string; messageId: string | null; sent: boolean }> = [];

  for (const row of pending) {
    if (dryRun) {
      assignments.push({ email: row.email, code: 'DRY-RUN', messageId: null, sent: false });
      console.log(`[dry-run] ${row.email}`);
      continue;
    }

    const [codeRow] = await inviteCodeService.generateBatch({
      count: 1,
      maxUses: 1,
      expiresInDays: 90,
      note: WAVE2_NOTE,
    });
    const code = codeRow.code;
    const unsubscribeUrl = buildUnsubscribeUrl(row.unsubscribe_token || '');

    const emailContent = buildInviteEmail(code, unsubscribeUrl);
    const claim = await query(
      `INSERT INTO waitlist_drip_sends (subscriber_id, template_key, sent_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (subscriber_id, template_key) DO NOTHING
       RETURNING id`,
      [row.id, WAVE2_TEMPLATE_KEY],
    );

    if ((claim.rowCount ?? 0) === 0) {
      console.log(`[skip] already claimed ${row.email}`);
      continue;
    }

    const claimId = claim.rows[0].id;

    try {
      const info = await sendWaitlistCampaignEmail({
        to: row.email,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
      });

      await query(`UPDATE waitlist_drip_sends SET smtp_message_id = $2 WHERE id = $1`, [
        claimId,
        info.id || null,
      ]);

      assignments.push({ email: row.email, code, messageId: info.id, sent: true });
      console.log(`[sent] ${row.email} -> ${code} (${info.provider}:${info.id})`);
    } catch (err) {
      await query(
        `DELETE FROM waitlist_drip_sends
          WHERE subscriber_id = $1 AND template_key = $2 AND smtp_message_id IS NULL`,
        [row.id, WAVE2_TEMPLATE_KEY],
      );
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[error] ${row.email}: ${message}`);
      assignments.push({ email: row.email, code, messageId: null, sent: false });
    }
  }

  const resolved = path.resolve(outPath);
  const csvLines = ['email,code,sent,message_id', ...assignments.map((row) =>
    `${row.email},${row.code},${row.sent},${row.messageId || ''}`,
  )];
  fs.writeFileSync(resolved, `${csvLines.join('\n')}\n`, 'utf8');
  console.log(`Wrote ${resolved}`);

  const sentCount = assignments.filter((row) => row.sent).length;
  const failedCount = assignments.filter((row) => !row.sent && !dryRun).length;
  console.log(
    JSON.stringify(
      {
        generated_or_previewed: assignments.length,
        sent: sentCount,
        failed: failedCount,
      },
      null,
      2,
    ),
  );

  if (failedCount > 0) {
    process.exitCode = 1;
  }
}

main()
  .then(() => pool.end())
  .catch((err) => {
    console.error(err);
    pool.end().finally(() => process.exit(1));
  });