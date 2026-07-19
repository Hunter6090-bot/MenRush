/**
 * Broadcast: ID verification paused for beta.
 *
 * Default is dry-run. Does NOT send unless you pass --send.
 *
 * Usage (from backend/):
 *   npx ts-node src/scripts/send-id-verification-paused.ts --dry-run
 *   npx ts-node src/scripts/send-id-verification-paused.ts --dry-run --out /tmp/paused-preview.json
 *   npx ts-node src/scripts/send-id-verification-paused.ts --send
 *   npx ts-node src/scripts/send-id-verification-paused.ts --send --limit 5
 *
 * Recipients: all registered users (users.email), plus active waitlist emails
 * that are not already registered (so invitees who haven't signed up yet hear
 * the same message).
 */
import 'dotenv/config';
import fs from 'fs';
import { query } from '../db';
import { sendWaitlistCampaignEmail } from '../services/mailer.service';
import {
  buildTransactionalEmail,
  transactionalParagraph,
} from '../services/transactional-email.template';

const TEMPLATE_KEY = 'mr-id-verification-paused-beta';

type Recipient = {
  email: string;
  source: 'users' | 'waitlist';
  name?: string | null;
  waitlistId?: number;
};

function readFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function readArg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

export function buildIdVerificationPausedEmail(displayName?: string | null): {
  subject: string;
  html: string;
  text: string;
} {
  const greeting = displayName?.trim()
    ? `Hi ${escapePlain(displayName.trim())},`
    : 'Hi,';

  const bodyHtml = [
    transactionalParagraph(greeting),
    transactionalParagraph(
      'We owe you a clear update — and an apology.',
    ),
    transactionalParagraph(
      'There is a problem with our ID verification system. Some of you got stuck on the scanner, saw confusing “accepted” messages, or couldn’t get past the confirm step. That is on us, and we are sorry for the friction.',
    ),
    transactionalParagraph(
      'While we fix it, <strong style="color:#F0E0C0;">you can register and use the MenRush beta without ID verification</strong>. No copper checkmark required to get in and explore.',
    ),
    transactionalParagraph(
      'Once the scanner is repaired — and at grand opening — we will ask you to resubmit your ID when we request it. Verification stays part of how we keep MenRush real; we are only pausing the hard gate for this beta window.',
    ),
    transactionalParagraph(
      'We hope you enjoy the app. If anything feels broken, confusing, or off, reply to this email or write to <a href="mailto:hello@menrush.com" style="color:#C4832A;">hello@menrush.com</a> — your reports help us ship a better product.',
    ),
    transactionalParagraph('Thank you for being early with us.'),
    transactionalParagraph('— The MenRush team'),
  ].join('');

  const html = buildTransactionalEmail({
    title: 'ID verification paused for beta',
    preheader: 'Sorry for the hassle — you can use the beta without verifying for now.',
    eyebrow: 'Beta update',
    headlineHtml: 'ID check paused. <span style="color:#C4832A;">You&apos;re still in.</span>',
    subheadline: 'We are fixing verification. Meanwhile, the beta is open without it.',
    bodyHtml,
    ctaUrl: 'https://menrush.com/beta',
    ctaLabel: 'Open MenRush beta',
    footerNote: 'You received this because you are on the MenRush beta or waitlist.',
  });

  const text = [
    greeting,
    '',
    'We owe you a clear update — and an apology.',
    '',
    'There is a problem with our ID verification system. Some of you got stuck on the scanner, saw confusing “accepted” messages, or couldn’t get past the confirm step. That is on us, and we are sorry for the friction.',
    '',
    'While we fix it, you can register and use the MenRush beta without ID verification. No copper checkmark required to get in and explore.',
    '',
    'Once the scanner is repaired — and at grand opening — we will ask you to resubmit your ID when we request it. Verification stays part of how we keep MenRush real; we are only pausing the hard gate for this beta window.',
    '',
    'We hope you enjoy the app. If anything feels broken, confusing, or off, reply to this email or write to hello@menrush.com — your reports help us ship a better product.',
    '',
    'Thank you for being early with us.',
    '',
    '— The MenRush team',
    '',
    'Open beta: https://menrush.com/beta',
  ].join('\n');

  return {
    subject: 'MenRush beta: ID verification paused (you can still get in)',
    html,
    text,
  };
}

function escapePlain(value: string): string {
  return value.replace(/[<>&]/g, '');
}

async function alreadySentWaitlist(subscriberId: number): Promise<boolean> {
  const result = await query(
    `SELECT 1 FROM waitlist_drip_sends
      WHERE subscriber_id = $1 AND template_key = $2
      LIMIT 1`,
    [subscriberId, TEMPLATE_KEY],
  );
  return (result.rowCount ?? 0) > 0;
}

async function claimWaitlistSend(subscriberId: number): Promise<string | null> {
  const claim = await query(
    `INSERT INTO waitlist_drip_sends (subscriber_id, template_key, sent_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (subscriber_id, template_key) DO NOTHING
     RETURNING id`,
    [subscriberId, TEMPLATE_KEY],
  );
  if ((claim.rowCount ?? 0) === 0) return null;
  return claim.rows[0].id as string;
}

async function markWaitlistSend(claimId: string, messageId: string | null): Promise<void> {
  await query(`UPDATE waitlist_drip_sends SET smtp_message_id = $2 WHERE id = $1`, [
    claimId,
    messageId,
  ]);
}

async function releaseWaitlistClaim(subscriberId: number): Promise<void> {
  await query(
    `DELETE FROM waitlist_drip_sends
      WHERE subscriber_id = $1 AND template_key = $2 AND smtp_message_id IS NULL`,
    [subscriberId, TEMPLATE_KEY],
  );
}

async function loadRecipients(): Promise<Recipient[]> {
  const [users, waitlist] = await Promise.all([
    query(`SELECT email, name FROM users WHERE email IS NOT NULL ORDER BY created_at ASC`),
    query(
      `SELECT id, email FROM waitlist WHERE status = 'active' AND email IS NOT NULL ORDER BY created_at ASC`,
    ),
  ]);

  const byEmail = new Map<string, Recipient>();

  for (const row of users.rows as Array<{ email: string; name: string | null }>) {
    const email = row.email.trim().toLowerCase();
    if (!email.includes('@')) continue;
    byEmail.set(email, { email, source: 'users', name: row.name });
  }

  for (const row of waitlist.rows as Array<{ id: number; email: string }>) {
    const email = row.email.trim().toLowerCase();
    if (!email.includes('@')) continue;
    const existing = byEmail.get(email);
    if (existing) {
      existing.waitlistId = row.id;
      continue;
    }
    byEmail.set(email, { email, source: 'waitlist', waitlistId: row.id });
  }

  return [...byEmail.values()];
}

async function main() {
  const dryRun = !readFlag('send');
  const limitRaw = readArg('limit');
  const limit = limitRaw ? Math.max(1, Number(limitRaw)) : undefined;
  const outPath = readArg('out') || '/tmp/menrush-id-verification-paused.json';

  if (readFlag('send') && readFlag('dry-run')) {
    console.error('Pass either --send or --dry-run (default), not both.');
    process.exit(1);
  }

  const all = await loadRecipients();
  const pending: Recipient[] = [];
  for (const row of all) {
    if (row.waitlistId && (await alreadySentWaitlist(row.waitlistId))) continue;
    pending.push(row);
  }

  const batch = limit ? pending.slice(0, limit) : pending;
  const preview = buildIdVerificationPausedEmail(batch[0]?.name);

  const summary = {
    mode: dryRun ? 'dry-run' : 'send',
    template_key: TEMPLATE_KEY,
    total_unique_recipients: all.length,
    already_sent_skipped: all.length - pending.length,
    pending: pending.length,
    batch_size: batch.length,
    subject: preview.subject,
    out: outPath,
  };
  console.log(JSON.stringify(summary, null, 2));

  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        ...summary,
        sample_email: {
          to: batch[0]?.email ?? null,
          subject: preview.subject,
          text: preview.text,
        },
        recipients: batch.map((r) => ({
          email: r.email,
          source: r.source,
          name: r.name ?? null,
          waitlist_id: r.waitlistId ?? null,
        })),
      },
      null,
      2,
    ),
  );
  console.log(`Wrote preview/recipient list to ${outPath}`);

  if (dryRun) {
    console.log('\n--- SAMPLE PLAIN TEXT ---\n');
    console.log(preview.text);
    console.log('\nDry-run only. Re-run with --send to deliver (optionally --limit N).');
    return;
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  for (const row of batch) {
    const email = buildIdVerificationPausedEmail(row.name);
    let claimId: string | null = null;
    try {
      if (row.waitlistId) {
        claimId = await claimWaitlistSend(row.waitlistId);
        if (!claimId) {
          skipped += 1;
          console.log(`[skip] already claimed ${row.email}`);
          continue;
        }
      }

      const result = await sendWaitlistCampaignEmail({
        to: row.email,
        subject: email.subject,
        html: email.html,
        text: email.text,
      });

      if (claimId) await markWaitlistSend(claimId, result.id);
      sent += 1;
      console.log(`[sent] ${row.email} ${result.id} (${result.provider})`);
    } catch (err) {
      if (row.waitlistId) await releaseWaitlistClaim(row.waitlistId);
      failed += 1;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[failed] ${row.email}: ${msg}`);
    }
  }

  console.log(JSON.stringify({ sent, failed, skipped, batch_size: batch.length }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
