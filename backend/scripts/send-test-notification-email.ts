/**
 * Render one activity-notification email and optionally send it through Resend.
 *
 * Bypasses EMAIL_NOTIFICATIONS_ENABLED and the live triggers (message / match /
 * jerk). Uses the same Claude transactional shell as the welcome email
 * (backend/src/services/transactional-email.template.ts).
 *
 *   npx ts-node --transpile-only scripts/send-test-notification-email.ts --to you@example.com
 *   npx ts-node --transpile-only scripts/send-test-notification-email.ts --to you@example.com --type match --out /tmp/notify.html
 *
 * --to is required. There is no default recipient.
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { sendEmail } from '../src/services/mailer.service';
import {
  EMAIL_NOTIFY_SUBJECT,
  buildEmailNotificationHtml,
  buildEmailNotificationText,
  type EmailNotifyType,
} from '../src/services/email-notification.emails';
import {
  isEmailNotifyType,
  settingsEmailNotificationsUrl,
  unsubscribeUrl,
} from '../src/services/email-notification.service';

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i < 0 || i + 1 >= process.argv.length) return undefined;
  return process.argv[i + 1];
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

async function main() {
  if (hasFlag('--help') || hasFlag('-h')) {
    console.log(
      'Usage: send-test-notification-email.ts --to <email> [--type message|match|jerk] [--out file.html] [--name DisplayName] [--no-send]',
    );
    process.exit(0);
  }

  const to = (arg('--to') || '').trim();
  if (!to) {
    console.error('Refused: --to is required. There is no default recipient.');
    process.exit(1);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    console.error('Refused: --to must be an email address.');
    process.exit(1);
  }

  const typeRaw = (arg('--type') || 'message').trim();
  if (!isEmailNotifyType(typeRaw)) {
    console.error('Refused: --type must be message, match or jerk.');
    process.exit(1);
  }
  const type = typeRaw as EmailNotifyType;
  const senderName = (arg('--name') || '').trim() || null;
  const out = (arg('--out') || '').trim();
  const noSend = hasFlag('--no-send');

  const openUrl = (process.env.FRONTEND_URL || 'https://menrush.com').replace(/\/$/, '').split(',')[0];
  const settingsUrl = settingsEmailNotificationsUrl();
  const html = buildEmailNotificationHtml({ openUrl, settingsUrl, senderName });
  const text = buildEmailNotificationText({ openUrl, settingsUrl, senderName });

  if (out) {
    const abs = path.resolve(out);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, html, 'utf8');
    console.log(`Wrote HTML to ${abs}`);
  }

  if (noSend) {
    console.log(`Rendered type=${type} (not sent).`);
    return;
  }

  const headers = await listUnsubscribeHeaders(to, type);
  const result = await sendEmail({
    to,
    subject: EMAIL_NOTIFY_SUBJECT,
    html,
    text,
    ...(headers ? { headers } : {}),
    logHint: `email-notify-test:${type}`,
  });
  console.log(`Sent type=${type} id=${result.id}`);
}

/**
 * Real RFC 8058 header only when --to is an existing member (token bound to
 * them). Never point List-Unsubscribe at Settings. Omit the header otherwise.
 */
async function listUnsubscribeHeaders(
  to: string,
  type: EmailNotifyType,
): Promise<Record<string, string> | undefined> {
  try {
    const { query, default: pool } = await import('../src/db');
    const result = await query(`SELECT id FROM users WHERE LOWER(email) = LOWER($1)`, [to]);
    const userId = result.rows[0]?.id as string | undefined;
    if (!userId) {
      await pool.end().catch(() => undefined);
      return undefined;
    }
    const unsub = await unsubscribeUrl(userId, type);
    await pool.end().catch(() => undefined);
    return {
      'List-Unsubscribe': `<${unsub}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    };
  } catch {
    return undefined;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
