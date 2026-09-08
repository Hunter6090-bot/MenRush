/**
 * Email confirmation + post-confirm welcome copy (Brand / Support signed 8 Sep 2026).
 * Pure builders — no DB. Used by auth.service and copy checks.
 */

import {
  buildTransactionalEmail,
  transactionalParagraph,
} from './transactional-email.template';

export const EMAIL_CONFIRM_TTL_MS = 24 * 60 * 60 * 1000;

export const CONFIRM_EMAIL_SUBJECT = 'Confirm your MenRush email';
export const WELCOME_EMAIL_SUBJECT = 'You are in. Welcome to MenRush';

/** Brand welcome bullets — exact order and wording. */
export const WELCOME_BULLETS = [
  'Nearby. Map or grid.',
  'Matches and chat.',
  '1:1 video when you match.',
  'Optional Verified.',
  'Authenticator 2FA in Settings.',
  'Privacy controls on what you show.',
] as const;

export function buildConfirmEmailHtml(confirmUrl: string): string {
  return buildTransactionalEmail({
    title: CONFIRM_EMAIL_SUBJECT,
    preheader: 'Confirm your email to finish creating your MenRush account. Link expires in 24 hours.',
    eyebrow: 'Account',
    headlineHtml: 'Confirm your<br/><span style="color:#C4832A;">email</span>',
    subheadline: 'Thanks for signing up to MenRush.',
    bodyHtml: [
      transactionalParagraph(
        'Confirm your email to finish creating your account. Tap the button below. The link expires in <strong style="color:#F0E0C0;">24 hours</strong>.',
      ),
      transactionalParagraph('If you did not sign up, ignore this message.'),
    ].join(''),
    ctaUrl: confirmUrl,
    ctaLabel: 'Confirm email',
    footerNote: 'You received this because someone signed up for MenRush with this email.',
  });
}

export function buildConfirmEmailText(confirmUrl: string): string {
  return [
    'Hi,',
    '',
    'Thanks for signing up to MenRush.',
    '',
    'Confirm your email to finish creating your account. Tap the button below. The link expires in 24 hours.',
    '',
    `Confirm email: ${confirmUrl}`,
    '',
    'If you did not sign up, ignore this message.',
    '',
    'The MenRush team',
  ].join('\n');
}

export function buildWelcomeEmailHtml(): string {
  const bulletsHtml = WELCOME_BULLETS.map(
    (line) =>
      `<li style="margin:0 0 10px 0; font-family:Helvetica,Arial,sans-serif; font-size:16px; line-height:1.6; color:#C4A878;">${escapeHtml(
        line,
      )}</li>`,
  ).join('');

  return buildTransactionalEmail({
    title: WELCOME_EMAIL_SUBJECT,
    preheader: 'Your account is ready. LIVE NOW. UK BETA OPEN.',
    eyebrow: 'Welcome',
    headlineHtml: 'You are in.<br/><span style="color:#C4832A;">Welcome to MenRush</span>',
    subheadline: 'Thanks for confirming your email. Your account is ready.',
    bodyHtml: [
      transactionalParagraph('Here is what you can use now:'),
      `<ul style="margin:0 0 24px 0; padding:0 0 0 22px;">${bulletsHtml}</ul>`,
      transactionalParagraph(
        'Sign up is free. No code. 30 days Premium before 1 October.',
      ),
      transactionalParagraph(
        '<strong style="color:#F0E0C0;">LIVE NOW. UK BETA OPEN.</strong>',
      ),
      transactionalParagraph(
        '<a href="https://menrush.com" style="color:#C4832A; text-decoration:underline;">https://menrush.com</a>',
      ),
    ].join(''),
    ctaUrl: 'https://menrush.com',
    ctaLabel: 'Open MenRush',
    footerNote: 'You received this because you confirmed your MenRush account.',
  });
}

export function buildWelcomeEmailText(): string {
  const bullets = WELCOME_BULLETS.map((line) => `• ${line}`).join('\n');
  return [
    'Hi,',
    '',
    'Thanks for confirming your email. Your account is ready.',
    '',
    'Here is what you can use now:',
    bullets,
    '',
    'Sign up is free. No code. 30 days Premium before 1 October.',
    'LIVE NOW. UK BETA OPEN.',
    'https://menrush.com',
    '',
    'The MenRush team',
  ].join('\n');
}

/** Non-production (or explicit env) may echo the raw confirm token for e2e/smoke. */
export function shouldExposeConfirmToken(): boolean {
  if (process.env.EMAIL_CONFIRM_EXPOSE_TOKEN === 'true') return true;
  if (process.env.EMAIL_CONFIRM_EXPOSE_TOKEN === 'false') return false;
  return process.env.NODE_ENV !== 'production';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
