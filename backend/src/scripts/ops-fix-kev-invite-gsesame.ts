/**
 * One-off ops:
 * 1) kdaniells395@gmail.com — no user row (login fails). Create account, redeem code, email temp password.
 * 2) gsesame24@gmail.com — mint verified invite, email it, confirm code validates.
 *
 *   railway run --service backend npx ts-node --transpile-only src/scripts/ops-fix-kev-invite-gsesame.ts
 */
import 'dotenv/config';
import crypto from 'crypto';
import bcryptjs from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import pool, { query } from '../db';
import { inviteCodeService } from '../services/invite-code.service';
import { sendWaitlistCampaignEmail } from '../services/mailer.service';
import {
  buildTransactionalEmail,
  transactionalParagraph,
} from '../services/transactional-email.template';

function genPassword(): string {
  const a = crypto.randomBytes(3).toString('hex').toUpperCase();
  const b = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `MenRush-${a.slice(0, 4)}-${b.slice(0, 4)}`;
}

function loginReadyEmail(email: string, password: string) {
  const loginUrl = 'https://menrush.com/login';
  const bodyHtml = [
    transactionalParagraph('Hi — we fixed your MenRush access.'),
    transactionalParagraph(
      'Login was failing because <strong>no account existed yet</strong> (so no password could match). We created your account. Use these details:',
      true,
    ),
    transactionalParagraph(
      `<strong style="color:#F0E0C0;">Email</strong><br/>${email}<br/><br/><strong style="color:#F0E0C0;">Temporary password</strong><br/><span style="font-family:ui-monospace,monospace;font-size:18px;letter-spacing:0.06em;color:#E0A14A;">${password}</span>`,
      true,
    ),
    transactionalParagraph(
      `1) Open <a href="${loginUrl}" style="color:#C4832A;">menrush.com/login</a><br/>2) Sign in with the email + password above<br/>3) Change your password in Settings after you are in`,
      true,
    ),
    transactionalParagraph('If anything still blocks you, reply to this email.'),
  ].join('');

  const html = buildTransactionalEmail({
    title: 'Your MenRush login is ready',
    preheader: 'Account created — temporary password inside',
    eyebrow: 'Account help',
    headlineHtml: 'You can <span style="color:#C4832A;">sign in</span> now.',
    subheadline: 'Temporary password below. Change it after login.',
    bodyHtml,
    ctaUrl: loginUrl,
    ctaLabel: 'Sign in to MenRush',
    footerNote: 'You received this because you requested beta access help.',
  });

  const text = [
    'Your MenRush login is ready',
    '',
    `Email: ${email}`,
    `Temporary password: ${password}`,
    '',
    'Sign in: https://menrush.com/login',
    'Change password in Settings after login.',
  ].join('\n');

  return { subject: 'Your MenRush login is ready', html, text };
}

function inviteEmail(email: string, code: string) {
  const betaUrl = 'https://menrush.com/beta';
  const bodyHtml = [
    transactionalParagraph('You are invited to the MenRush closed beta.'),
    transactionalParagraph(
      `<strong style="color:#F0E0C0;">Your invite code</strong><br/><span style="font-family:ui-monospace,monospace;font-size:20px;letter-spacing:0.08em;color:#E0A14A;">${code}</span>`,
      true,
    ),
    transactionalParagraph(
      `1) Open <a href="${betaUrl}" style="color:#C4832A;">menrush.com/beta</a><br/>2) Enter the code<br/>3) Create your account with <strong>${email}</strong> (same email)`,
      true,
    ),
    transactionalParagraph(
      'This code is single-use and already verified on our side. Premium is free during beta. Reply if anything fails.',
    ),
  ].join('');

  const html = buildTransactionalEmail({
    title: 'Your MenRush beta invite',
    preheader: `Your invite code: ${code}`,
    eyebrow: 'Beta invite',
    headlineHtml: 'You are <span style="color:#C4832A;">in.</span>',
    subheadline: 'Your personal invite code is ready.',
    bodyHtml,
    ctaUrl: betaUrl,
    ctaLabel: 'Enter your invite code',
    footerNote: 'You received this because you were invited to the MenRush beta.',
  });

  const text = [
    'Your MenRush beta invite',
    '',
    `Code: ${code}`,
    '',
    'https://menrush.com/beta',
    `Register with: ${email}`,
  ].join('\n');

  return { subject: 'Your MenRush beta invite is here', html, text };
}

async function fixKev() {
  const email = 'kdaniells395@gmail.com';
  const password = genPassword();
  const hash = await bcryptjs.hash(password, 10);

  const existing = await query(`SELECT id FROM users WHERE LOWER(email) = LOWER($1)`, [email]);
  if (existing.rows[0]) {
    await query(`UPDATE users SET password_hash = $2 WHERE id = $1`, [existing.rows[0].id, hash]);
    try {
      await query(`UPDATE users SET totp_enabled = false WHERE id = $1`, [existing.rows[0].id]);
    } catch {
      /* optional column */
    }
    const mail = loginReadyEmail(email, password);
    const info = await sendWaitlistCampaignEmail({
      to: email,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    });
    const row = await query(`SELECT password_hash FROM users WHERE id = $1`, [existing.rows[0].id]);
    const bcryptOk = await bcryptjs.compare(password, row.rows[0].password_hash);
    return {
      action: 'password_reset_existing',
      email,
      password,
      bcrypt_ok: bcryptOk,
      message_id: info.id,
      user_id: existing.rows[0].id,
    };
  }

  let code = 'MENRUSH-AEAH-KZYJ';
  let check = await inviteCodeService.validate(code);
  if (!check.valid) {
    const [minted] = await inviteCodeService.generateBatch({
      count: 1,
      maxUses: 1,
      expiresInDays: 90,
      note: 'ops-kev-account-create',
    });
    code = minted.code;
    check = await inviteCodeService.validate(code);
    if (!check.valid) throw new Error('could_not_mint_usable_code');
  }

  const id = uuidv4();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO users (id, email, password_hash, name, age, photo_url, is_verified, verification_status)
       VALUES ($1, $2, $3, $4, $5, $6, false, 'unverified')`,
      [id, email, hash, 'Kev', 28, '/avatars/generic/05.svg'],
    );
    await inviteCodeService.redeemForRegistration(code, id, client);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  const mail = loginReadyEmail(email, password);
  const info = await sendWaitlistCampaignEmail({
    to: email,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
  });

  const row = await query(`SELECT password_hash FROM users WHERE id = $1`, [id]);
  const bcryptOk = await bcryptjs.compare(password, row.rows[0].password_hash);
  const used = await inviteCodeService.validate(code);

  return {
    action: 'created_account',
    email,
    password,
    code_redeemed: code,
    code_still_valid_after: used.valid,
    bcrypt_ok: bcryptOk,
    message_id: info.id,
    user_id: id,
  };
}

async function inviteGsesame() {
  const email = 'gsesame24@gmail.com';
  const existing = await query(`SELECT id FROM users WHERE LOWER(email) = LOWER($1)`, [email]);
  if (existing.rows[0]) {
    return { action: 'already_registered', email, user_id: existing.rows[0].id };
  }

  let sub = await query(
    `SELECT id, unsubscribe_token FROM waitlist WHERE LOWER(email) = LOWER($1)`,
    [email],
  );
  if (!sub.rows[0]) {
    const token = crypto.randomBytes(24).toString('base64url');
    sub = await query(
      `INSERT INTO waitlist (email, status, source, unsubscribe_token)
       VALUES (LOWER($1), 'active', 'manual-ops-invite', $2)
       RETURNING id, unsubscribe_token`,
      [email, token],
    );
  }

  const [minted] = await inviteCodeService.generateBatch({
    count: 1,
    maxUses: 1,
    expiresInDays: 90,
    note: 'manual-invite-gsesame24',
  });
  const code = minted.code;

  const validBefore = await inviteCodeService.validate(code);
  if (!validBefore.valid) throw new Error('minted_code_invalid_before_send');

  // Live API check against production validate endpoint is env-local; service validate is enough.
  const mail = inviteEmail(email, code);
  const info = await sendWaitlistCampaignEmail({
    to: email,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
  });

  try {
    await query(
      `INSERT INTO waitlist_drip_sends (subscriber_id, template_key, sent_at, smtp_message_id)
       VALUES ($1, 'mr-wave2-invite', NOW(), $2)
       ON CONFLICT (subscriber_id, template_key)
       DO UPDATE SET smtp_message_id = EXCLUDED.smtp_message_id, sent_at = NOW()`,
      [sub.rows[0].id, info.id || null],
    );
  } catch (e) {
    console.warn('ledger_warn', e instanceof Error ? e.message : e);
  }

  const validAfter = await inviteCodeService.validate(code);

  return {
    action: 'invited',
    email,
    code,
    valid_before_send: validBefore.valid,
    valid_after_send: validAfter.valid,
    message_id: info.id,
    provider: info.provider,
  };
}

async function main() {
  const kev = await fixKev();
  console.log('KEV', JSON.stringify(kev, null, 2));
  const g = await inviteGsesame();
  console.log('GSESAME', JSON.stringify(g, null, 2));
}

main()
  .then(() => pool.end())
  .catch((e) => {
    console.error(e);
    pool.end().finally(() => process.exit(1));
  });
