import nodemailer, { Transporter } from 'nodemailer';

/**
 * Shared Zoho SMTP transport. Cached after first use so we don't pay TLS
 * handshake on every send (matters for drip batches; not for one-off contacts).
 *
 * Configured via env:
 *   ZOHO_SMTP_HOST   default smtp.zoho.com
 *   ZOHO_SMTP_PORT   default 587
 *   ZOHO_SMTP_SECURE default false (true forces implicit TLS — only with port 465)
 *   ZOHO_SMTP_USER   required — full Zoho mailbox address
 *   ZOHO_SMTP_PASS   required — Zoho app-specific password
 *
 * Verified end-to-end 2026-05-12 via backend/scripts/test-zoho.ts --send.
 */

export class MailerNotConfiguredError extends Error {
  constructor() {
    super('mailer_not_configured');
    this.name = 'MailerNotConfiguredError';
  }
}

let cached: Transporter | null = null;
let cachedKey = '';

function buildKey(): string {
  return [
    process.env.ZOHO_SMTP_HOST,
    process.env.ZOHO_SMTP_PORT,
    process.env.ZOHO_SMTP_SECURE,
    process.env.ZOHO_SMTP_USER,
    // Hash via length; we don't want the secret in memory keys.
    (process.env.ZOHO_SMTP_PASS || '').length,
  ].join('|');
}

export function getMailer(): Transporter {
  const user = (process.env.ZOHO_SMTP_USER || '').trim();
  const pass = (process.env.ZOHO_SMTP_PASS || '').trim();
  if (!user || !pass) throw new MailerNotConfiguredError();

  const key = buildKey();
  if (cached && key === cachedKey) return cached;

  const host = process.env.ZOHO_SMTP_HOST || 'smtp.zoho.com';
  const port = parseInt(process.env.ZOHO_SMTP_PORT || '587', 10);
  const secure = process.env.ZOHO_SMTP_SECURE === 'true' || port === 465;

  cached = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    // Keep the connection pool small but reusable across drip batches.
    pool: true,
    maxConnections: 3,
    maxMessages: 100,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  cachedKey = key;
  return cached;
}

export function getMailerFromAddress(): string {
  const user = (process.env.ZOHO_SMTP_USER || '').trim();
  const from = (process.env.MAIL_FROM_EMAIL || process.env.CONTACT_FROM_EMAIL || user).trim();
  return from;
}

/**
 * Reset cached transport (useful in tests or after env hot-reload).
 */
export function resetMailer(): void {
  if (cached) {
    try {
      cached.close();
    } catch {
      /* ignore */
    }
  }
  cached = null;
  cachedKey = '';
}
