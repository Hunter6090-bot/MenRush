/**
 * Reset password for zain.3la2@hotmail.com and email temp credentials.
 *   railway run --service backend npx ts-node --transpile-only src/scripts/ops-reset-boa90-password.ts
 */
import 'dotenv/config';
import crypto from 'crypto';
import bcryptjs from 'bcryptjs';
import pool, { query } from '../db';
import { sendTransactionalEmail } from '../services/mailer.service';
import {
  buildTransactionalEmail,
  transactionalParagraph,
} from '../services/transactional-email.template';

const EMAIL = 'zain.3la2@hotmail.com';

function genPassword(): string {
  const a = crypto.randomBytes(3).toString('hex').toUpperCase();
  const b = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `MenRush-${a.slice(0, 4)}-${b.slice(0, 4)}`;
}

async function main() {
  const u = await query(`SELECT id, email, name FROM users WHERE LOWER(email) = LOWER($1)`, [
    EMAIL,
  ]);
  if (!u.rows[0]) throw new Error('user_not_found');

  const password = genPassword();
  const hash = await bcryptjs.hash(password, 10);
  await query(`UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1`, [
    u.rows[0].id,
    hash,
  ]);

  const loginUrl = 'https://menrush.com/login';
  const name = (u.rows[0].name as string) || 'there';
  const html = buildTransactionalEmail({
    title: 'Your MenRush password was reset',
    preheader: 'Temporary password inside — sign in now.',
    eyebrow: 'Account help',
    headlineHtml: 'Password <span style="color:#C4832A;">reset</span>',
    subheadline: 'Use the temporary password below, then change it in Settings.',
    bodyHtml: [
      transactionalParagraph(`Hi ${name} — we reset your MenRush password.`),
      transactionalParagraph(
        `<strong style="color:#F0E0C0;">Email</strong><br/>${EMAIL}<br/><br/><strong style="color:#F0E0C0;">Temporary password</strong><br/><span style="font-family:ui-monospace,monospace;font-size:18px;letter-spacing:0.06em;color:#E0A14A;">${password}</span>`,
        true,
      ),
      transactionalParagraph(
        `1) Open <a href="${loginUrl}" style="color:#C4832A;">menrush.com/login</a><br/>2) Sign in<br/>3) Change password in Settings`,
        true,
      ),
    ].join(''),
    ctaUrl: loginUrl,
    ctaLabel: 'Sign in to MenRush',
    footerNote: 'You received this because a password reset was requested for your MenRush account.',
  });

  const info = await sendTransactionalEmail({
    to: EMAIL,
    subject: 'Your MenRush password was reset',
    html,
    text: `Temporary password: ${password}\nSign in: ${loginUrl}\nChange it in Settings after login.`,
  });

  const row = await query(`SELECT password_hash FROM users WHERE id = $1`, [u.rows[0].id]);
  const loginOk = await bcryptjs.compare(password, row.rows[0].password_hash);

  console.log(
    JSON.stringify(
      {
        email: EMAIL,
        password,
        bcrypt_ok: loginOk,
        message_id: info.id,
        provider: info.provider,
      },
      null,
      2,
    ),
  );
}

main()
  .then(() => pool.end())
  .catch((e) => {
    console.error(e);
    pool.end().finally(() => process.exit(1));
  });
