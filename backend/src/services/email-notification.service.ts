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

export type EmailNotifyState = EmailNotifyPrefs & {
  enabled: boolean;
  jerkEnabled: boolean;
};

export function emailNotifyFlags(): { enabled: boolean; jerkEnabled: boolean } {
  return {
    enabled: isEmailNotificationsEnabled(),
    jerkEnabled: isJerkEmailEnabled(),
  };
}

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

const UNSUB_VERSION_COLUMN: Record<EmailNotifyType, string> = {
  message: 'email_unsub_version_message',
  match: 'email_unsub_version_match',
  jerk: 'email_unsub_version_jerk',
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

/** Distinct from login tokens. The hotfix that rejects purpose on login is not required. */
export const EMAIL_UNSUB_PURPOSE = 'email-unsub-v1' as const;
export const EMAIL_UNSUB_KEY_INFO = 'email-unsub-v1';
/** 90 days. Short-lived relative to a login, and revocable per type. */
export const EMAIL_UNSUB_TTL_SECONDS = 90 * 24 * 60 * 60;

/**
 * Signing key for unsubscribe tokens. Never JWT_SECRET itself, and never a
 * hardcoded default secret. EMAIL_UNSUB_SECRET if set; otherwise
 * HMAC-SHA256(JWT_SECRET, 'email-unsub-v1').
 */
export function unsubSigningKey(): Buffer {
  const dedicated = (process.env.EMAIL_UNSUB_SECRET ?? '').trim();
  if (dedicated) return Buffer.from(dedicated, 'utf8');
  const jwt = (process.env.JWT_SECRET ?? '').trim();
  if (!jwt) {
    throw new Error('EMAIL_UNSUB_SECRET or JWT_SECRET is required');
  }
  return crypto.createHmac('sha256', jwt).update(EMAIL_UNSUB_KEY_INFO).digest();
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
  purpose: typeof EMAIL_UNSUB_PURPOSE;
  v: number;
  exp: number;
};

export function signUnsubscribeToken(
  userId: string,
  type: EmailNotifyType,
  options?: { ttlSeconds?: number; version?: number },
): string {
  const payload: UnsubscribePayload = {
    userId,
    type,
    purpose: EMAIL_UNSUB_PURPOSE,
    v: options?.version ?? 1,
    exp: Math.floor(Date.now() / 1000) + (options?.ttlSeconds ?? EMAIL_UNSUB_TTL_SECONDS),
  };
  const payloadJson = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', unsubSigningKey()).update(payloadJson).digest();
  return `${base64UrlEncode(payloadJson)}.${base64UrlEncode(signature)}`;
}

/**
 * HMAC + purpose + shape only. Expired and used tokens still come back
 * `{ ok: true }` so a fail-IP bucket cannot block a validly signed link.
 * Forged or malformed tokens are `{ ok: false }`.
 */
export function readSignedUnsubscribeToken(
  token: string,
): { ok: true; payload: UnsubscribePayload } | { ok: false } {
  try {
    const [payloadPart, signaturePart] = token.split('.');
    if (!payloadPart || !signaturePart) return { ok: false };
    const payloadJson = base64UrlDecode(payloadPart).toString('utf8');
    const expected = crypto.createHmac('sha256', unsubSigningKey()).update(payloadJson).digest();
    const actual = base64UrlDecode(signaturePart);
    if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
      return { ok: false };
    }
    const payload = JSON.parse(payloadJson) as UnsubscribePayload;
    if (
      payload.purpose !== EMAIL_UNSUB_PURPOSE ||
      !isEmailNotifyType(payload.type) ||
      !payload.userId ||
      !Number.isInteger(payload.v)
    ) {
      return { ok: false };
    }
    return { ok: true, payload };
  } catch {
    return { ok: false };
  }
}

/** Crypto + purpose + expiry. Does not check the per-user version. */
export function verifyUnsubscribeToken(token: string): UnsubscribePayload {
  const signed = readSignedUnsubscribeToken(token);
  if (!signed.ok) {
    throw new Error('invalid_token');
  }
  if (signed.payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('expired_token');
  }
  return signed.payload;
}

/**
 * Live pref for that type. `null` if the member is gone. Expiry and token
 * version are ignored: opting out is always safe to honour.
 */
export async function emailNotifyTypeEnabled(
  userId: string,
  type: EmailNotifyType,
): Promise<boolean | null> {
  const col = PREF_COLUMN[type];
  const result = await query(
    `SELECT COALESCE(${col}, TRUE) AS on FROM users WHERE id = $1`,
    [userId],
  );
  if (!result.rows[0]) return null;
  return Boolean(result.rows[0].on);
}

export async function currentUnsubVersion(
  userId: string,
  type: EmailNotifyType,
): Promise<number | null> {
  const col = UNSUB_VERSION_COLUMN[type];
  const result = await query(`SELECT ${col} AS v FROM users WHERE id = $1`, [userId]);
  if (!result.rows[0]) return null;
  const v = Number(result.rows[0].v);
  return Number.isInteger(v) ? v : 1;
}

/** Verify signature, purpose, expiry, and the live version for that type. */
export async function readValidUnsubscribeToken(token: string): Promise<UnsubscribePayload> {
  const payload = verifyUnsubscribeToken(token);
  const version = await currentUnsubVersion(payload.userId, payload.type);
  if (version === null || version !== payload.v) {
    throw new Error('revoked_token');
  }
  return payload;
}

export async function issueUnsubscribeToken(
  userId: string,
  type: EmailNotifyType,
  ttlSeconds = EMAIL_UNSUB_TTL_SECONDS,
): Promise<string> {
  const version = (await currentUnsubVersion(userId, type)) ?? 1;
  return signUnsubscribeToken(userId, type, { ttlSeconds, version });
}

export async function unsubscribeUrl(userId: string, type: EmailNotifyType): Promise<string> {
  const token = await issueUnsubscribeToken(userId, type);
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

export async function getEmailNotifyState(userId: string): Promise<EmailNotifyState> {
  const prefs = await getEmailNotifyPrefs(userId);
  return { ...emailNotifyFlags(), ...prefs };
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
  const versionCol = UNSUB_VERSION_COLUMN[type];
  const result = await query(
    `UPDATE users
        SET ${col} = FALSE,
            ${versionCol} = ${versionCol} + 1,
            updated_at = NOW()
      WHERE id = $1
      RETURNING id`,
    [userId],
  );
  return Boolean(result.rows[0]);
}

type SafetyRow = {
  actor_id: string;
  actor_name: string;
  actor_ghost: boolean;
  recipient_id: string;
  recipient_email: string | null;
  email_confirmed: boolean;
  pref_on: boolean;
  blocked: boolean;
  hidden: boolean;
  recipient_active: boolean;
};

async function loadSafety(actorId: string, recipientId: string, type: EmailNotifyType): Promise<SafetyRow | null> {
  const prefCol = PREF_COLUMN[type];
  const minutes = emailNotifyActiveMinutes();
  const result = await query(
    `SELECT
       actor.id AS actor_id,
       actor.name AS actor_name,
       COALESCE(actor_p.is_ghost, FALSE) AS actor_ghost,
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
       (
         COALESCE(p.online, FALSE)
         OR (
           p.last_seen IS NOT NULL
           AND p.last_seen > NOW() - make_interval(mins => $3::int)
         )
       ) AS recipient_active
     FROM users actor
     JOIN users recipient ON recipient.id = $2
     LEFT JOIN profiles p ON p.user_id = recipient.id
     LEFT JOIN profiles actor_p ON actor_p.user_id = actor.id
     WHERE actor.id = $1`,
    [actorId, recipientId, minutes],
  );
  return (result.rows[0] as SafetyRow) ?? null;
}

function skipFromSafety(row: SafetyRow | null, type: EmailNotifyType): NotifySkipReason | null {
  if (!row) return 'deleted';
  if (!row.pref_on) return 'opt_out';
  if (row.blocked) return 'blocked';
  if (row.hidden) return 'hidden';
  if (!row.email_confirmed) return 'unconfirmed';
  if (!row.recipient_email || !String(row.recipient_email).includes('@')) return 'no_email';
  if (row.recipient_active) return 'active';
  void type;
  return null;
}

async function claimHourlySlot(
  userId: string,
  type: EmailNotifyType,
): Promise<{ claimed: boolean; hourSlot: Date }> {
  const result = await query(
    `INSERT INTO email_notification_sends (user_id, notify_type, hour_slot)
     VALUES ($1, $2, date_trunc('hour', NOW(), 'UTC'))
     ON CONFLICT (user_id, notify_type, hour_slot) DO NOTHING
     RETURNING hour_slot`,
    [userId, type],
  );
  if (result.rows[0]) {
    return { claimed: true, hourSlot: result.rows[0].hour_slot };
  }
  const slot = await query(`SELECT date_trunc('hour', NOW(), 'UTC') AS hour_slot`);
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

  const senderName =
    showSenderName() && !again.actor_ghost ? String(again.actor_name || '').trim() : '';
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
  const unsub = await unsubscribeUrl(recipientId, type);

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
