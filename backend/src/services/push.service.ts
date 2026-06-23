import webpush from 'web-push';
import { query } from '../db';

/**
 * Web-push delivery for background / locked-phone notifications.
 *
 * VAPID keys come from the environment. If they are absent we treat push as
 * "not configured" and become a no-op rather than pretending to deliver — the
 * caller can inspect the returned `configured` flag. Subscriptions that the
 * push service reports as gone (HTTP 404 / 410) are pruned so we don't keep
 * trying to reach dead endpoints.
 */

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';

let configured = false;
if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL || 'admin@menrush.com'}`,
    VAPID_PUBLIC,
    VAPID_PRIVATE,
  );
  configured = true;
}

export interface PushPayload {
  title: string;
  body: string;
  /** In-app path the notification should open, e.g. `/messages/<id>`. */
  url: string;
  /** Collapses repeat notifications for the same context (e.g. one chat). */
  tag?: string;
  icon?: string;
}

export interface PushSender {
  sendNotification: (
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
    payload: string,
  ) => Promise<unknown>;
}

type QueryFn = (text: string, values?: unknown[]) => Promise<{ rows: any[]; rowCount?: number | null }>;

export function isPushConfigured(): boolean {
  return configured;
}

/**
 * Core implementation, parameterised over its dependencies so it can be unit
 * tested without a live database or the real web-push transport.
 */
export async function deliverPush(
  deps: { runQuery: QueryFn; sender: PushSender; enabled: boolean },
  userId: string,
  payload: PushPayload,
): Promise<{ configured: boolean; sent: number; pruned: number }> {
  if (!deps.enabled) return { configured: false, sent: 0, pruned: 0 };

  const subs = await deps.runQuery(
    `SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1`,
    [userId],
  );

  let sent = 0;
  let pruned = 0;
  const body = JSON.stringify(payload);

  await Promise.all(
    subs.rows.map(async (s: { endpoint: string; p256dh: string; auth: string }) => {
      try {
        await deps.sender.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
        );
        sent += 1;
      } catch (err: any) {
        const code = err?.statusCode ?? err?.status;
        // 404 Not Found / 410 Gone → the subscription is dead; drop it.
        if (code === 404 || code === 410) {
          pruned += 1;
          await deps
            .runQuery(`DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2`, [
              userId,
              s.endpoint,
            ])
            .catch(() => undefined);
        }
      }
    }),
  );

  return { configured: true, sent, pruned };
}

/** Production entry point: send a push to every device a user has registered. */
export async function sendPushToUser(userId: string, payload: PushPayload) {
  return deliverPush({ runQuery: query, sender: webpush as PushSender, enabled: configured }, userId, payload);
}
