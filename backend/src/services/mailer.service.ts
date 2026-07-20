import nodemailer, { Transporter } from 'nodemailer';
import { Resend } from 'resend';

// ═══════════════════════════════════════════════════════════════════════════
// Zoho SMTP (contact form + waitlist drip) — unchanged transport contract
// ═══════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════
// Resend (transactional — admin smoke test; product flows wired separately)
// ═══════════════════════════════════════════════════════════════════════════

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  /** Overrides the default RESEND_REPLY_TO (e.g. contact form → reply to the sender). */
  replyTo?: string;
}

export interface EmailStatus {
  id: string;
  createdAt: string;
  from: string;
  to: string[];
  subject: string;
  lastEvent:
    | 'bounced'
    | 'canceled'
    | 'clicked'
    | 'complained'
    | 'delivered'
    | 'delivery_delayed'
    | 'failed'
    | 'opened'
    | 'queued'
    | 'scheduled'
    | 'sent'
    | 'suppressed';
}

export class MailerSendError extends Error {
  constructor(
    message: string,
    public readonly resendMessage?: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'MailerSendError';
  }
}

let resendClient: Resend | null = null;

function getResend(): Resend {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    throw new Error(
      '[mailer] RESEND_API_KEY is required but missing. Set it in backend/.env (see backend/.env.example).',
    );
  }
  if (!resendClient) {
    resendClient = new Resend(key);
  }
  return resendClient;
}

/**
 * Log Resend availability at startup without blocking the rest of the app.
 * Contact + waitlist drip still use Zoho SMTP, so the backend should boot
 * even if Resend has not been configured yet.
 */
export function logResendMailerStatus(): void {
  if (!process.env.RESEND_API_KEY?.trim()) {
    console.warn(
      '[mailer] RESEND_API_KEY is not set. Resend-powered admin test email is disabled until configured.',
    );
    return;
  }
  console.log('[mailer] Resend API key detected. Transactional mail smoke tests are available.');
}

function formatToForLog(to: string | string[]): string {
  return Array.isArray(to) ? to.join(', ') : to;
}

function formatMenRushFromAddress(raw: string): string {
  const value = raw.trim();
  if (!value) return value;
  if (/^"?MenRush"?\s*</i.test(value)) return value;

  const angleMatch = value.match(/<([^>]+)>/);
  const email = angleMatch?.[1]?.trim() || value;
  return `"MenRush" <${email}>`;
}

/**
 * Send a transactional email via Resend. Not wired into contact/drip yet —
 * used by POST /api/admin/test-email and future flows.
 */
function stripHtmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function sendViaZohoSmtp(params: SendEmailParams): Promise<{ id: string }> {
  const transporter = getMailer();
  const from = (
    process.env.MAIL_FROM_EMAIL ||
    process.env.CONTACT_FROM_EMAIL ||
    getMailerFromAddress()
  ).trim();
  const replyTo = (params.replyTo || process.env.RESEND_REPLY_TO || 'hello@menrush.com').trim();
  const recipients = Array.isArray(params.to) ? params.to : [params.to];
  const text = params.text || stripHtmlToText(params.html);

  const info = await transporter.sendMail({
    from: `"MenRush" <${from}>`,
    to: recipients,
    replyTo,
    subject: params.subject,
    html: params.html,
    text,
  });

  const id = info.messageId || `zoho-${Date.now()}`;
  console.log(`[mailer] sent ${id} to ${recipients.join(', ')} via Zoho SMTP subject="${params.subject}"`);
  return { id };
}

function resendConfigured(): boolean {
  return Boolean(
    process.env.RESEND_API_KEY?.trim() &&
      process.env.RESEND_FROM_EMAIL?.trim() &&
      process.env.RESEND_REPLY_TO?.trim(),
  );
}

/** Account emails (password reset, etc.): prefer Resend, fall back to Zoho SMTP. */
export async function sendTransactionalEmail(
  params: SendEmailParams,
): Promise<{ id: string; provider: 'resend' | 'zoho' }> {
  if (resendConfigured()) {
    try {
      const result = await sendEmail(params);
      return { id: result.id, provider: 'resend' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[mailer] Resend transactional send failed, trying Zoho SMTP: ${msg}`);
    }
  }

  try {
    const result = await sendViaZohoSmtp(params);
    return { id: result.id, provider: 'zoho' };
  } catch (err) {
    if (err instanceof MailerNotConfiguredError) {
      throw new Error(
        'Transactional email is not configured. Set RESEND_* or ZOHO_SMTP_* env vars on the backend.',
      );
    }
    throw err;
  }
}

/** Waitlist drip: prefer Resend, fall back to Zoho SMTP if Resend fails or is unset. */
export async function sendWaitlistCampaignEmail(
  params: SendEmailParams,
): Promise<{ id: string; provider: 'resend' | 'zoho' }> {
  if (resendConfigured()) {
    try {
      const result = await sendEmail(params);
      return { id: result.id, provider: 'resend' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[mailer] Resend waitlist send failed, trying Zoho SMTP: ${msg}`);
    }
  }

  try {
    const result = await sendViaZohoSmtp(params);
    return { id: result.id, provider: 'zoho' };
  } catch (err) {
    if (err instanceof MailerNotConfiguredError) {
      throw new Error(
        'Waitlist email is not configured. Set RESEND_* or ZOHO_SMTP_* env vars on the backend.',
      );
    }
    throw err;
  }
}

export async function sendEmail(params: SendEmailParams): Promise<{ id: string }> {
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  const replyTo = params.replyTo?.trim() || process.env.RESEND_REPLY_TO?.trim();

  if (!from) {
    throw new Error('[mailer] RESEND_FROM_EMAIL is not set');
  }
  if (!replyTo) {
    throw new Error('[mailer] RESEND_REPLY_TO is not set');
  }

  const toLog = formatToForLog(params.to);

  try {
    const { data, error } = await getResend().emails.send({
      from: formatMenRushFromAddress(from),
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
      replyTo,
    });

    if (error) {
      const msg =
        typeof error.message === 'string' && error.message.length > 0
          ? error.message
          : JSON.stringify(error);
      console.error(`[mailer] FAILED to ${toLog}: ${msg}`);
      throw new MailerSendError(`Resend API error: ${msg}`, msg, error);
    }

    if (!data?.id) {
      const msg = 'Resend returned success but no message id';
      console.error(`[mailer] FAILED to ${toLog}: ${msg}`);
      throw new MailerSendError(msg);
    }

    console.log(`[mailer] sent ${data.id} to ${toLog} subject="${params.subject}"`);
    return { id: data.id };
  } catch (err) {
    if (err instanceof MailerSendError) {
      throw err;
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[mailer] FAILED to ${toLog}: ${msg}`);
    throw new MailerSendError(`Resend send failed: ${msg}`, msg, err);
  }
}

export async function getEmailStatus(id: string): Promise<EmailStatus> {
  try {
    const { data, error } = await getResend().emails.get(id);
    if (error) {
      const msg =
        typeof error.message === 'string' && error.message.length > 0
          ? error.message
          : JSON.stringify(error);
      throw new MailerSendError(`Resend email lookup failed: ${msg}`, msg, error);
    }
    if (!data) {
      throw new MailerSendError('Resend email lookup returned no data');
    }

    return {
      id: data.id,
      createdAt: data.created_at,
      from: data.from,
      to: data.to,
      subject: data.subject,
      lastEvent: data.last_event,
    };
  } catch (err) {
    if (err instanceof MailerSendError) {
      throw err;
    }
    const msg = err instanceof Error ? err.message : String(err);
    throw new MailerSendError(`Resend email lookup failed: ${msg}`, msg, err);
  }
}
