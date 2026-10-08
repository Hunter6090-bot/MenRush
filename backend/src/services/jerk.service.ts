import pool, { query } from '../db';
import { accessControl, SecurityError } from '../security/access';
import { notificationService } from './notification.service';
import { sendPushToUser, PushPayload } from './push.service';
import {
  JERK_DAILY_LIMIT,
  JERK_LIMIT_MESSAGE,
  JERK_REPEAT_WINDOW_HOURS,
  jerkMessage,
} from '../constants/jerk';

/**
 * Jerk: one-tap nudge. Lives in its own `jerks` table and NEVER writes to
 * `likes`, so it can never create a like or a match. Real likes keep using
 * userService.likeUser.
 *
 * Rules:
 *  - no self-jerk (400 invalid_target)
 *  - blocks either way, hidden / ghost / unknown targets → neutral 404
 *    target_unavailable (nothing about the block or the target leaks)
 *  - JERK_DAILY_LIMIT new jerks per sender per rolling 24h → 429 jerk_daily_limit
 *  - repeat to the same person inside JERK_REPEAT_WINDOW_HOURS → 200 status
 *    'repeat', no new row, no notification, no push, not counted
 *  - a new jerk creates an in-app 'jerk' notification + web push and emits a
 *    jerk_sent event line
 */

type QueryResult = { rows: any[]; rowCount?: number | null };
export type JerkQueryFn = (text: string, values?: unknown[]) => Promise<QueryResult>;

type NotifyIo = { to: (room: string) => { emit: (event: string, data: unknown) => void } } | null;

export interface JerkDeps {
  runQuery: JerkQueryFn;
  /** Runs fn inside BEGIN/COMMIT on one client. */
  withTransaction: <T>(fn: (q: JerkQueryFn) => Promise<T>) => Promise<T>;
  assertCanJerk: (fromId: string, toId: string) => Promise<void>;
  notify: (
    io: NotifyIo,
    params: {
      userId: string;
      actorId: string;
      type: 'jerk';
      title: string;
      body?: string | null;
      linkPath?: string | null;
    },
  ) => Promise<unknown>;
  push: (userId: string, payload: PushPayload) => Promise<unknown>;
  logEvent: (event: 'jerk_sent' | 'jerk_repeat' | 'jerk_limited', fields: Record<string, unknown>) => void;
  dailyLimit?: number;
  repeatWindowHours?: number;
}

export type JerkResult = {
  status: 'sent' | 'repeat';
  jerk_id: string;
  sent_today: number;
  daily_limit: number;
};

export class JerkLimitError extends Error {
  readonly status = 429;
  readonly code = 'jerk_daily_limit';
  constructor(public readonly dailyLimit: number) {
    super(JERK_LIMIT_MESSAGE);
    this.name = 'JerkLimitError';
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Single-line JSON for Railway log drains, same shape as call-metrics. */
export function logJerkEvent(event: string, fields: Record<string, unknown> = {}): void {
  console.log(
    `[engagement-metrics] ${JSON.stringify({ ts: new Date().toISOString(), component: 'jerk', event, ...fields })}`,
  );
}

export function createJerkService(deps: JerkDeps) {
  const dailyLimit = deps.dailyLimit ?? JERK_DAILY_LIMIT;
  const windowHours = deps.repeatWindowHours ?? JERK_REPEAT_WINDOW_HOURS;

  return {
    dailyLimit,

    async sendJerk(fromId: string, toId: string, opts: { io?: NotifyIo } = {}): Promise<JerkResult> {
      if (!toId || fromId === toId) {
        throw new SecurityError('invalid_target', 400, 'Invalid interaction target');
      }
      if (!UUID_RE.test(toId)) {
        throw new SecurityError('target_unavailable', 404, 'User unavailable');
      }

      try {
        await deps.assertCanJerk(fromId, toId);
      } catch (err) {
        if (err instanceof SecurityError) {
          // Keep verification gating honest for the sender; everything about
          // the target (block either way, ghost, hidden, gone) looks the same.
          if (err.code === 'verification_required' || err.code === 'account_unavailable') throw err;
          if (err.code === 'invalid_target') throw err;
          throw new SecurityError('target_unavailable', 404, 'User unavailable');
        }
        throw err;
      }

      const outcome = await deps.withTransaction(async (q) => {
        // Serialise per sender so the daily cap and the repeat check hold under double taps.
        await q(`SELECT pg_advisory_xact_lock(hashtext('jerk:' || $1::text))`, [fromId]);

        const recent = await q(
          `SELECT id FROM jerks
           WHERE from_user_id = $1 AND to_user_id = $2
             AND created_at > NOW() - make_interval(hours => $3::int)
           ORDER BY created_at DESC
           LIMIT 1`,
          [fromId, toId, windowHours],
        );
        const today = await q(
          `SELECT COUNT(*)::int AS n FROM jerks
           WHERE from_user_id = $1 AND created_at > NOW() - INTERVAL '24 hours'`,
          [fromId],
        );
        const sentToday = Number(today.rows[0]?.n ?? 0);

        if (recent.rows[0]) {
          return { kind: 'repeat' as const, id: String(recent.rows[0].id), sentToday };
        }
        if (sentToday >= dailyLimit) {
          return { kind: 'limited' as const, sentToday };
        }
        const inserted = await q(
          `INSERT INTO jerks (from_user_id, to_user_id) VALUES ($1, $2) RETURNING id`,
          [fromId, toId],
        );
        return { kind: 'sent' as const, id: String(inserted.rows[0].id), sentToday: sentToday + 1 };
      });

      if (outcome.kind === 'limited') {
        deps.logEvent('jerk_limited', { from: fromId, sent_today: outcome.sentToday, limit: dailyLimit });
        throw new JerkLimitError(dailyLimit);
      }

      if (outcome.kind === 'repeat') {
        deps.logEvent('jerk_repeat', { from: fromId, to: toId, jerk_id: outcome.id });
        return { status: 'repeat', jerk_id: outcome.id, sent_today: outcome.sentToday, daily_limit: dailyLimit };
      }

      const nameRow = await deps.runQuery(`SELECT name FROM users WHERE id = $1`, [fromId]);
      const title = jerkMessage(nameRow.rows[0]?.name as string | undefined);
      const linkPath = `/profile/${fromId}`;

      try {
        await deps.notify(opts.io ?? null, {
          userId: toId,
          actorId: fromId,
          type: 'jerk',
          title,
          body: null,
          linkPath,
        });
      } catch (err) {
        console.error('[jerk] notify failed', err);
      }

      void Promise.resolve()
        .then(() =>
          deps.push(toId, {
            title,
            body: '',
            url: linkPath,
            tag: `jerk-${fromId}`,
          }),
        )
        .catch(() => undefined);

      deps.logEvent('jerk_sent', { from: fromId, to: toId, jerk_id: outcome.id, sent_today: outcome.sentToday });
      return { status: 'sent', jerk_id: outcome.id, sent_today: outcome.sentToday, daily_limit: dailyLimit };
    },

    /** Recipient has seen jerks (from one sender, or all). */
    async markSeen(toId: string, fromId?: string | null): Promise<number> {
      const result = fromId
        ? await deps.runQuery(
            `UPDATE jerks SET seen_at = NOW()
             WHERE to_user_id = $1 AND from_user_id = $2 AND seen_at IS NULL`,
            [toId, fromId],
          )
        : await deps.runQuery(
            `UPDATE jerks SET seen_at = NOW() WHERE to_user_id = $1 AND seen_at IS NULL`,
            [toId],
          );
      return result.rowCount ?? 0;
    },

    /** A 'jerk' notification was opened/read: mark that sender's jerks seen. */
    async markSeenForNotification(toId: string, notificationId: string): Promise<number> {
      const result = await deps.runQuery(
        `UPDATE jerks SET seen_at = NOW()
         WHERE to_user_id = $1 AND seen_at IS NULL
           AND from_user_id = (
             SELECT actor_id FROM notifications
             WHERE id = $2 AND user_id = $1 AND type = 'jerk'
           )`,
        [toId, notificationId],
      );
      return result.rowCount ?? 0;
    },
  };
}

export async function withPoolTransaction<T>(fn: (q: JerkQueryFn) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn((text, values) => client.query(text, values as any[]));
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export const jerkService = createJerkService({
  runQuery: query,
  withTransaction: withPoolTransaction,
  assertCanJerk: async (fromId, toId) => {
    await accessControl.assertProfileView(fromId, toId);
    await accessControl.assertInteraction(fromId, toId);
  },
  notify: (io, params) => notificationService.notify(io, params),
  push: (userId, payload) => sendPushToUser(userId, payload),
  logEvent: logJerkEvent,
});
