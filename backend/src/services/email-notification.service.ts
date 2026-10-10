/**
 * Activity email notifications (message / match / jerk).
 *
 * Live send is off unless EMAIL_NOTIFICATIONS_ENABLED=true. Prod stays off
 * until Quality Check passes this. Jerk mail is a second flag
 * (EMAIL_NOTIFY_JERK_ENABLED) because #325/#326 is on hold.
 *
 * Sends through Resend only (never Zoho). Re-checks block, hide-from, deleted
 * accounts and email_confirmed at send time. At most one mail per type per
 * hour per person, claimed atomically on email_notification_sends.
 */

import crypto from 'crypto';
import { query } from '../db';
import { sendEmail, type SendEmailParams } from './mailer.service';
import {
  EMAIL_NOTIFY_SUBJECT,
  buildEmailNotificationHtml,
  buildEmailNotificationText,
  type EmailNotifyType,
} from './email-notification.emails';

export type { EmailNotifyType };

export const EMAIL_NOTIFY_TYPES: readonly EmailNotifyType[] = ['message', 'match', 'jerk'];

export type EmailNotifyPrefs = {
  messages: boolean;
  matches: boolean;
  jerks: boolean;
};

export type NotifySkipReason =
  | 'disabled'
  | 'jerk_hold'
  | 'opt_out'
  | 'active'
  | 'throttled'
  | 'blocked'
  | 'hidden'
  | 'deleted'
  | 'unconfirmed'
  | 'no_email'
  | 'self';

export type NotifyResult =
  | { status: 'sent'; messageId: string }
  | { status: 'skipped'; reason: NotifySkipReason };

const PREF_COLUMN: Record<EmailNotifyType, string> = {
  message: 'email_notify_messages',
  match: 'email_notify_matches',
  jerk: 'email_notify_jerks',
};

type Sender = (params: SendEmailParams) => Promise<{ id: string }>;

let senderOverride: Sender | null = null;

/** Test-only hook so integration checks never hit Resend. */
export function setEmailNotificationSender(fn: Sender | null): void {
  senderOverride = fn;
}

export function isEmailNotifyType(value: unknown): value is EmailNotifyType {
  return typeof value === 'string' && (EMAIL_NOTIFY_TYPES as readonly string[]).includes(value);
}

export function envFlagOn(name: string): boolean {
  const v = (process.env[name] ?? '').trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}

export function isEmailNotificationsEnabled(): boolean {
  return envFlagOn('EMAIL_NOTIFICATIONS_ENABLED');
}

export function isJerkEmailEnabled(): boolean {
  return envFlagOn('EMAIL_NOTIFY_JERK_ENABLED');
}

export function showSenderName(): boolean {
  return envFlagOn('EMAIL_NOTIFY_SHOW_SENDER_NAME');
}

export function emailNotifyActiveMinutes(): number {
  const n = parseInt(process.env.EMAIL_NOTIFY_ACTIVE_MINUTES || '15', 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 180) : 15;
}

export function publicAppBaseUrl(): string {
  return (process.env.FRONTEND_URL || 'https://menrush.com').replace(/\/$/, '').split(',')[0];
}

export function publicApiBaseUrl(): string {
  return (
    process.env.PUBLIC_API_URL ||
    process.env.FRONTEND_URL ||
    'https://menrush.com'
  )
    .replace(/\/$/, '')
    .split(',')[0];
}

export function settingsEmailNotificationsUrl(): string {
  return `${publicAppBaseUrl()}/settings#email-notifications`;
}

function unsubSecret(): string {
  return process.env.JWT_SECRET || 'your-secret-key';
}

function base64UrlEncode(value: string | Buffer): string {
  const buf = Buffer.isBuffer(value) ? value : Buffer.from(value);
  return buf.toString('base64url');
}

function base64UrlDecode(input: string): Buffer {
  return Buffer.from(input, 'base64url');
}

export type UnsubscribePayload = {
  userId: string;
  type: EmailNotifyType;
  purpose: 'email-unsub';
  exp: number;
};

export function signUnsubscribeToken(
  userId: string,
  type: EmailNotifyType,
  ttlSeconds = 365 * 24 * 60 * 60,
): string {
  const payload: UnsubscribePayload = {
    userId,
    type,
    purpose: 'email-unsub',
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const payloadJson = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', unsubSecret()).update(payloadJson).digest();
  return `${base64UrlEncode(payloadJson)}.${base64UrlEncode(signature)}`;
}

export function verifyUnsubscribeToken(token: string): UnsubscribePayload {
  const [payloadPart, signaturePart] = token.split('.');
  if (!payloadPart || !signaturePart) {
    throw new Error('invalid_token');
  }
  const payloadJson = base64UrlDecode(payloadPart).toString('utf8');
  const expected = crypto.createHmac('sha256', unsubSecret()).update(payloadJson).digest();
  const actual = base64UrlDecode(signaturePart);
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    throw new Error('invalid_token');
  }
  const payload = JSON.parse(payloadJson) as UnsubscribePayload;
  if (payload.purpose !== 'email-unsub' || !isEmailNotifyType(payload.type) || !payload.userId) {
    throw new Error('invalid_token');
  }
  if (payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('expired_token');
  }
  return payload;
}

export function unsubscribeUrl(userId: string, type: EmailNotifyType): string {
  const token = signUnsubscribeToken(userId, type);
  return `${publicApiBaseUrl()}/api/email-unsubscribe?token=${encodeURIComponent(token)}`;
}

export async function getEmailNotifyPrefs(userId: string): Promise<EmailNotifyPrefs> {
  const result = await query(
    `SELECT
       COALESCE(email_notify_messages, TRUE) AS messages,
       COALESCE(email_notify_matches, TRUE) AS matches,
       COALESCE(email_notify_jerks, TRUE) AS jerks
     FROM users
     WHERE id = $1`,
    [userId],
  );
  if (!result.rows[0]) {
    return { messages: true, matches: true, jerks: true };
  }
  return {
    messages: Boolean(result.rows[0].messages),
    matches: Boolean(result.rows[0].matches),
    jerks: Boolean(result.rows[0].jerks),
  };
}

export async function setEmailNotifyPrefs(
  userId: string,
  patch: Partial<EmailNotifyPrefs>,
): Promise<EmailNotifyPrefs> {
  const sets: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (typeof patch.messages === 'boolean') {
    sets.push(`email_notify_messages = $${i++}`);
    values.push(patch.messages);
  }
  if (typeof patch.matches === 'boolean') {
    sets.push(`email_notify_matches = $${i++}`);
    values.push(patch.matches);
  }
  if (typeof patch.jerks === 'boolean') {
    sets.push(`email_notify_jerks = $${i++}`);
    values.push(patch.jerks);
  }
  if (sets.length === 0) {
    return getEmailNotifyPrefs(userId);
  }
  values.push(userId);
  await query(
    `UPDATE users SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${i}`,
    values,
  );
  return getEmailNotifyPrefs(userId);
}

export async function optOutType(userId: string, type: EmailNotifyType): Promise<boolean> {
  const col = PREF_COLUMN[type];
  const result = await query(
    `UPDATE users SET ${col} = FALSE, updated_at = NOW() WHERE id = $1 RETURNING id`,
    [userId],
  );
  return Boolean(result.rows[0]);
}

type SafetyRow = {
  actor_id: string;
  actor_name: string;
  recipient_id: string;
  recipient_email: string | null;
  email_confirmed: boolean;
  pref_on: boolean;
  blocked: boolean;
  hidden: boolean;
  socket_online: boolean;
  last_seen: Date | string | null;
};

async function loadSafety(actorId: string, recipientId: string, type: EmailNotifyType): Promise<SafetyRow | null> {
  const prefCol = PREF_COLUMN[type];
  const result = await query(
    `SELECT
       actor.id AS actor_id,
       actor.name AS actor_name,
       recipient.id AS recipient_id,
       recipient.email AS recipient_email,
       COALESCE(recipient.email_confirmed, FALSE) AS email_confirmed,
       COALESCE(recipient.${prefCol}, TRUE) AS pref_on,
       EXISTS (
         SELECT 1 FROM blocks b
         WHERE (b.blocker_id = $1 AND b.blocked_id = $2)
            OR (b.blocker_id = $2 AND b.blocked_id = $1)
       ) AS blocked,
       EXISTS (
         SELECT 1 FROM location_hidden_from lh
         WHERE (lh.owner_id = $1 AND lh.hidden_user_id = $2)
            OR (lh.owner_id = $2 AND lh.hidden_user_id = $1)
       ) AS hidden,
       COALESCE(p.online, FALSE) AS socket_online,
       p.last_seen
     FROM users actor
     JOIN users recipient ON recipient.id = $2
     LEFT JOIN profiles p ON p.user_id = recipient.id
     WHERE actor.id = $1`,
    [actorId, recipientId],
  );
  return (result.rows[0] as SafetyRow) ?? null;
}

function isRecipientActive(row: SafetyRow, now = Date.now()): boolean {
  if (row.socket_online) return true;
  if (!row.last_seen) return false;
  const seen = row.last_seen instanceof Date ? row.last_seen.getTime() : Date.parse(String(row.last_seen));
  if (!Number.isFinite(seen)) return false;
  return now - seen < emailNotifyActiveMinutes() * 60 * 1000;
}

function skipFromSafety(row: SafetyRow | null, type: EmailNotifyType): NotifySkipReason | null {
  if (!row) return 'deleted';
  if (!row.pref_on) return 'opt_out';
  if (row.blocked) return 'blocked';
  if (row.hidden) return 'hidden';
  if (!row.email_confirmed) return 'unconfirmed';
  if (!row.recipient_email || !String(row.recipient_email).includes('@')) return 'no_email';
  if (isRecipientActive(row)) return 'active';
  void type;
  return null;
}

async function claimHourlySlot(
  userId: string,
  type: EmailNotifyType,
): Promise<{ claimed: boolean; hourSlot: Date }> {
  const result = await query(
    `INSERT INTO email_notification_sends (user_id, notify_type, hour_slot)
     VALUES ($1, $2, date_trunc('hour', timezone('UTC', NOW())))
     ON CONFLICT (user_id, notify_type, hour_slot) DO NOTHING
     RETURNING hour_slot`,
    [userId, type],
  );
  if (result.rows[0]) {
    return { claimed: true, hourSlot: result.rows[0].hour_slot };
  }
  const slot = await query(`SELECT date_trunc('hour', timezone('UTC', NOW())) AS hour_slot`);
  return { claimed: false, hourSlot: slot.rows[0].hour_slot };
}

async function releaseHourlySlot(userId: string, type: EmailNotifyType, hourSlot: Date): Promise<void> {
  await query(
    `DELETE FROM email_notification_sends
      WHERE user_id = $1 AND notify_type = $2 AND hour_slot = $3`,
    [userId, type, hourSlot],
  );
}

export async function maybeSendEmailNotification(params: {
  recipientId: string;
  actorId: string;
  type: EmailNotifyType;
  /** Test / preview script bypasses the master flag and presence/throttle as requested. */
  bypassEnabled?: boolean;
  bypassThrottleAndPresence?: boolean;
}): Promise<NotifyResult> {
  const { recipientId, actorId, type } = params;
  if (recipientId === actorId) {
    return { status: 'skipped', reason: 'self' };
  }
  if (!params.bypassEnabled && !isEmailNotificationsEnabled()) {
    return { status: 'skipped', reason: 'disabled' };
  }
  if (type === 'jerk' && !isJerkEmailEnabled() && !params.bypassEnabled) {
    return { status: 'skipped', reason: 'jerk_hold' };
  }

  const safety = await loadSafety(actorId, recipientId, type);
  const reason = skipFromSafety(safety, type);
  if (!safety || (reason && reason !== 'active' && reason !== 'opt_out')) {
    return { status: 'skipped', reason: reason ?? 'deleted' };
  }
  if (reason === 'opt_out') {
    return { status: 'skipped', reason: 'opt_out' };
  }
  if (reason === 'active' && !params.bypassThrottleAndPresence) {
    return { status: 'skipped', reason: 'active' };
  }

  let hourSlot: Date | null = null;
  if (!params.bypassThrottleAndPresence) {
    const claim = await claimHourlySlot(recipientId, type);
    if (!claim.claimed) {
      return { status: 'skipped', reason: 'throttled' };
    }
    hourSlot = claim.hourSlot;
  }

  // Re-check at send time so a block/delete that landed after the claim still wins.
  const again = await loadSafety(actorId, recipientId, type);
  const againReason = skipFromSafety(again, type);
  if (
    !again ||
    (againReason && againReason !== 'active') ||
    (againReason === 'active' && !params.bypassThrottleAndPresence)
  ) {
    if (hourSlot) await releaseHourlySlot(recipientId, type, hourSlot);
    return { status: 'skipped', reason: againReason ?? 'deleted' };
  }

  const senderName = showSenderName() ? String(again.actor_name || '').trim() : '';
  const openUrl = publicAppBaseUrl();
  const settingsUrl = settingsEmailNotificationsUrl();
  const html = buildEmailNotificationHtml({
    openUrl,
    settingsUrl,
    senderName: senderName || null,
  });
  const text = buildEmailNotificationText({
    openUrl,
    settingsUrl,
    senderName: senderName || null,
  });
  const unsub = unsubscribeUrl(recipientId, type);

  try {
    const send = senderOverride ?? sendEmail;
    const result = await send({
      to: String(again.recipient_email),
      subject: EMAIL_NOTIFY_SUBJECT,
      html,
      text,
      headers: {
        'List-Unsubscribe': `<${unsub}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
      logHint: `email-notify:${type}`,
    });
    return { status: 'sent', messageId: result.id };
  } catch (err) {
    if (hourSlot) await releaseHourlySlot(recipientId, type, hourSlot);
    throw err;
  }
}

/** Fire-and-forget from message / match routes. Never throws to the request. */
export function queueEmailNotification(params: {
  recipientId: string;
  actorId: string;
  type: EmailNotifyType;
}): void {
  void maybeSendEmailNotification(params).catch((err) => {
    const msg = err instanceof Error ? err.message : 'send_failed';
    console.error(`[email-notify] ${params.type} failed: ${msg}`);
  });
}
