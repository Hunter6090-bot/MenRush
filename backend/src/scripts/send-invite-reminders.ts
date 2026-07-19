/**
 * Reminder emails for waitlist members who received wave-2 invite but never registered.
 *
 *   cd backend && railway run --service backend npx ts-node --transpile-only src/scripts/send-invite-reminders.ts
 *   Add --dry-run to preview without sending.
 */
import 'dotenv/config';
import pool, { query } from '../db';
import { inviteCodeService } from '../services/invite-code.service';
import { sendWaitlistCampaignEmail } from '../services/mailer.service';
import {
  buildTransactionalEmail,
  transactionalParagraph,
} from '../services/transactional-email.template';

const REMINDER_KEY = 'mr-wave2-invite-reminder';
const WAVE2_KEY = 'mr-wave2-invite';

/** Original wave-2 assignment map (email → code). */
const ORIGINAL: Record<string, string> = {
  'jamesplym69@hotmail.com': 'MENRUSH-6RS5-A55K',
  'mattpoole06@outlook.com': 'MENRUSH-AMZ6-2YCA',
  'maghiel.oden@icloud.com': 'MENRUSH-BUNF-CWUY',
  'zain.3la2@gmail.com': 'MENRUSH-SN5N-2YVS',
  'petegreen690@gmail.com': 'MENRUSH-9HGU-ZY77',
  'alangemini90@gmail.com': 'MENRUSH-AU7H-72JV',
  'l.mireya.lopez.c@gmail.com': 'MENRUSH-VBBG-YKB9',
  'dillzyy27@gmail.com': 'MENRUSH-HFF5-86FA',
  'njltrhrawk@gmail.com': 'MENRUSH-7JZU-WBC3',
  'alangemini@duck.com': 'MENRUSH-H8B3-EHRE',
  'marknotts@outlook.com': 'MENRUSH-KZRW-VJ6B',
  'josh89josh@icloud.com': 'MENRUSH-6C92-HYKW',
  'rjsawyer@hotmail.co.uk': 'MENRUSH-CDDR-KRE8',
  'ajmcd8@gmail.com': 'MENRUSH-EMZU-KVK2',
  'kurandostrife@gmail.com': 'MENRUSH-QSDR-XENP',
  'zain.3la2@hotmail.com': 'MENRUSH-BPCF-XBKA',
  'h_almuriab@yahoo.com': 'MENRUSH-DRGN-QDK9',
  'stevedecor1@hotmail.xo.uk': 'MENRUSH-573K-Z34Q',
  'ofawcett@live.co.uk': 'MENRUSH-PER3-CZKE',
  'jamesmkhan@hotmail.com': 'MENRUSH-JA9V-H2TF',
  '61caravan_couple@icloud.com': 'MENRUSH-926Z-5TWN',
  'michaelrobinsonse24@gmail.com': 'MENRUSH-ZBQ9-6H2D',
  'seragetoumi@gmail.com': 'MENRUSH-A986-KVJY',
  'bonkamorris04@gmail.com': 'MENRUSH-G6BT-QPZ8',
  'bevan.a1983@gmail.com': 'MENRUSH-NS7E-UAJ3',
  'ronalduck08@gmail.com': 'MENRUSH-FX26-V5F3',
  'brian.ambrosius.ho@gmail.com': 'MENRUSH-U4MK-SJQ8',
  'likelylad1980@gmail.com': 'MENRUSH-A8T3-7M7X',
  'paulsalkeld1@hotmail.co.uk': 'MENRUSH-T9H6-WMF3',
  'kdaniells395@gmail.com': 'MENRUSH-AEAH-KZYJ',
  'fobfob1960@gmail.com': 'MENRUSH-WGQ8-NXUY',
  'nick.m.ross@icloud.com': 'MENRUSH-NTZ2-D7TM',
};

function readFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function isSkip(email: string, source: string | null): boolean {
  const e = email.toLowerCase();
  const s = (source || '').toLowerCase();
  if (s === 'probe' || s === 'production-smoke' || s === 'production-live-proof' || s === 'healthcheck') {
    return true;
  }
  if (e.endsWith('@example.com') || e.endsWith('@menrush.com')) return true;
  if (e.includes('+waitlist')) return true;
  if (e.startsWith('al.zain9690')) return true;
  if (e === 'al.zain@menrush.com') return true;
  if (e === 'alangemini90@gmail.com' || e === 'alangemini@duck.com') return true;
  // Typo domain — will bounce
  if (e.includes('.xo.uk')) return true;
  return false;
}

function buildEmail(code: string, unsubscribeUrl: string) {
  const betaUrl = 'https://menrush.com/beta';
  const bodyHtml = [
    transactionalParagraph(
      'Friendly reminder — your MenRush closed beta invite is still open. We saved you a seat.',
    ),
    transactionalParagraph(
      `<strong style="color:#F0E0C0;">Your invite code</strong><br/><span style="font-family:ui-monospace,monospace;font-size:20px;letter-spacing:0.08em;color:#E0A14A;">${code}</span>`,
      true,
    ),
    transactionalParagraph(
      '1) Open <a href="https://menrush.com/beta" style="color:#C4832A;">menrush.com/beta</a><br/>2) Enter the code above<br/>3) Create your account with <strong>this same email address</strong>',
      true,
    ),
    transactionalParagraph(
      'Takes about two minutes. Premium is free during beta. If anything blocks you (code used, email already exists, or a confusing error), reply to this email — we will help.',
    ),
    transactionalParagraph(
      `Questions? Reply here or write <a href="mailto:hello@menrush.com" style="color:#C4832A;">hello@menrush.com</a>.`,
    ),
  ].join('');

  const html = buildTransactionalEmail({
    title: 'Your MenRush beta invite is waiting',
    preheader: `Your invite code: ${code} — still valid`,
    eyebrow: 'Beta reminder',
    headlineHtml: 'Still holding your <span style="color:#C4832A;">invite.</span>',
    subheadline: 'One code. Two minutes. You are on the list.',
    bodyHtml,
    ctaUrl: betaUrl,
    ctaLabel: 'Enter your invite code',
    footerNote: 'You received this because you are on the MenRush waitlist and have not registered yet.',
  }).replace(
    '</body>',
    `<div style="max-width:640px;margin:24px auto 0;padding:16px 24px;border-top:1px solid #2e2418;color:#a89070;font:12px/1.6 system-ui,sans-serif;text-align:center">
      Not interested? <a href="${unsubscribeUrl}" style="color:#c8861c">Unsubscribe</a>.
    </div></body>`,
  );

  const text = [
    'Reminder: your MenRush beta invite is waiting',
    '',
    `Your invite code: ${code}`,
    '',
    '1) https://menrush.com/beta',
    '2) Enter the code',
    '3) Register with this same email',
    '',
    'If you hit an error, reply to this email and we will help.',
    '',
    `Unsubscribe: ${unsubscribeUrl}`,
  ].join('\n');

  return {
    subject: 'Reminder: your MenRush beta invite is waiting',
    html,
    text,
  };
}

function unsubUrl(token: string) {
  const base = (process.env.PUBLIC_API_URL || process.env.FRONTEND_URL || 'https://menrush.com').replace(
    /\/$/,
    '',
  );
  return `${base}/api/waitlist/unsubscribe?token=${encodeURIComponent(token)}`;
}

async function main() {
  const dryRun = readFlag('dry-run');

  const pending = await query(
    `SELECT w.id AS subscriber_id, w.email, w.source, w.unsubscribe_token, s.sent_at AS invite_sent_at
     FROM waitlist_drip_sends s
     JOIN waitlist w ON w.id = s.subscriber_id
     WHERE s.template_key = $1
       AND s.smtp_message_id IS NOT NULL
       AND w.status = 'active'
       AND NOT EXISTS (SELECT 1 FROM users u WHERE LOWER(u.email) = LOWER(w.email))
     ORDER BY s.sent_at ASC`,
    [WAVE2_KEY],
  );

  const targets = (pending.rows as Array<{
    subscriber_id: number;
    email: string;
    source: string | null;
    unsubscribe_token: string | null;
  }>).filter((r) => !isSkip(r.email, r.source));

  console.log(
    JSON.stringify(
      {
        dry_run: dryRun,
        pending_total: pending.rows.length,
        targets: targets.length,
        emails: targets.map((t) => t.email),
      },
      null,
      2,
    ),
  );

  const results: Array<Record<string, unknown>> = [];

  for (const row of targets) {
    const email = String(row.email).trim().toLowerCase();

    const prior = await query(
      `SELECT id, smtp_message_id FROM waitlist_drip_sends
       WHERE subscriber_id = $1 AND template_key = $2`,
      [row.subscriber_id, REMINDER_KEY],
    );
    if (prior.rows[0]?.smtp_message_id) {
      results.push({ email, status: 'skip_already_reminded' });
      continue;
    }

    let code: string | undefined = ORIGINAL[email];
    if (code) {
      const ok = await inviteCodeService.validate(code);
      if (!ok.valid) code = undefined;
    }
    if (!code) {
      if (dryRun) {
        code = 'DRY-RUN-NEW';
      } else {
        const [minted] = await inviteCodeService.generateBatch({
          count: 1,
          maxUses: 1,
          expiresInDays: 90,
          note: 'wave-2-reminder',
        });
        code = minted.code;
      }
    }
    if (!code) {
      results.push({ email, status: 'error', error: 'no_code' });
      continue;
    }

    if (dryRun) {
      results.push({ email, status: 'dry-run', code });
      console.log(`[dry-run] ${email} -> ${code}`);
      continue;
    }

    const content = buildEmail(code, unsubUrl(row.unsubscribe_token || ''));

    const claim = await query(
      `INSERT INTO waitlist_drip_sends (subscriber_id, template_key, sent_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (subscriber_id, template_key) DO NOTHING
       RETURNING id`,
      [row.subscriber_id, REMINDER_KEY],
    );
    let claimId = claim.rows[0]?.id as string | undefined;
    if (!claimId) {
      const existing = await query(
        `SELECT id, smtp_message_id FROM waitlist_drip_sends WHERE subscriber_id=$1 AND template_key=$2`,
        [row.subscriber_id, REMINDER_KEY],
      );
      if (existing.rows[0]?.smtp_message_id) {
        results.push({ email, status: 'skip_already_reminded' });
        continue;
      }
      claimId = existing.rows[0]?.id as string | undefined;
    }

    try {
      const info = await sendWaitlistCampaignEmail({
        to: email,
        subject: content.subject,
        html: content.html,
        text: content.text,
      });
      if (claimId) {
        await query(`UPDATE waitlist_drip_sends SET smtp_message_id = $2 WHERE id = $1`, [
          claimId,
          info.id || null,
        ]);
      }
      results.push({ email, status: 'sent', code, message_id: info.id, provider: info.provider });
      console.log(`[sent] ${email} -> ${code}`);
      await new Promise((r) => setTimeout(r, 400));
    } catch (err: unknown) {
      if (claimId) {
        await query(`DELETE FROM waitlist_drip_sends WHERE id = $1 AND smtp_message_id IS NULL`, [
          claimId,
        ]);
      }
      const message = err instanceof Error ? err.message : String(err);
      results.push({ email, status: 'error', error: message });
      console.error(`[error] ${email}: ${message}`);
    }
  }

  const sent = results.filter((r) => r.status === 'sent').length;
  const skipped = results.filter((r) => String(r.status).startsWith('skip')).length;
  const failed = results.filter((r) => r.status === 'error').length;
  console.log(JSON.stringify({ sent, skipped, failed, dry_run: dryRun, results }, null, 2));
}

main()
  .then(() => pool.end())
  .catch((e) => {
    console.error(e);
    pool.end().finally(() => process.exit(1));
  });
