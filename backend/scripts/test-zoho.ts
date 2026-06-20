/* eslint-disable no-console */
/**
 * Smoke test for Zoho SMTP. Loads backend/.env and runs transporter.verify()
 * without sending mail. Run with:
 *   npx ts-node scripts/test-zoho.ts
 * Optional: pass --send to also send a real test email to CONTACT_TO_EMAIL.
 */
import * as path from 'path';
import * as dotenv from 'dotenv';
import nodemailer from 'nodemailer';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

async function main() {
  const host = process.env.ZOHO_SMTP_HOST || 'smtp.zoho.com';
  const port = parseInt(process.env.ZOHO_SMTP_PORT || '587', 10);
  const secure = process.env.ZOHO_SMTP_SECURE === 'true' || port === 465;
  const user = (process.env.ZOHO_SMTP_USER || '').trim();
  const pass = (process.env.ZOHO_SMTP_PASS || '').trim();
  const to = (process.env.CONTACT_TO_EMAIL || '').trim();
  const from = (process.env.CONTACT_FROM_EMAIL || user).trim();

  console.log('=== Zoho SMTP config ===');
  console.log('host  :', host);
  console.log('port  :', port);
  console.log('secure:', secure);
  console.log('user  :', user);
  console.log('pass  :', pass ? `(${pass.length} chars)` : '(MISSING)');
  console.log('to    :', to || '(unset, defaults to privacy@menrush.com)');
  console.log('from  :', from);
  console.log();

  if (!user || !pass) {
    console.error('FAIL: ZOHO_SMTP_USER and ZOHO_SMTP_PASS must be set.');
    process.exit(1);
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    // Surface connection-level errors instead of silently retrying.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
    // Log SMTP conversation so we can see exactly which step rejects.
    logger: true,
    debug: true,
  });

  console.log('--- transporter.verify() ---');
  try {
    await transporter.verify();
    console.log('PASS: SMTP authentication succeeded.\n');
  } catch (err: any) {
    console.error('FAIL: SMTP verify rejected.');
    console.error('  code   :', err?.code);
    console.error('  command:', err?.command);
    console.error('  response:', err?.response);
    console.error('  message:', err?.message);
    process.exit(2);
  }

  if (process.argv.includes('--send')) {
    console.log('--- sending test email ---');
    try {
      const info = await transporter.sendMail({
        from: `"MenRush SMTP Test" <${from}>`,
        to: to || from,
        subject: '[MenRush] SMTP smoke test',
        text: 'If you see this, Zoho SMTP from MenRush backend works.',
      });
      console.log('PASS: sent. messageId =', info.messageId);
      console.log('         response =', info.response);
    } catch (err: any) {
      console.error('FAIL: sendMail rejected.');
      console.error('  code   :', err?.code);
      console.error('  command:', err?.command);
      console.error('  response:', err?.response);
      console.error('  message:', err?.message);
      process.exit(3);
    }
  }
}

main().catch((e) => {
  console.error('Unexpected error:', e);
  process.exit(99);
});
