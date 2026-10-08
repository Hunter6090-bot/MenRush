/**
 * Jerk one-tap action checks.
 *
 * Unit (always, no DB): fake deps prove block respected, daily limit, 24h
 * idempotency, no like/match writes, notification + push queued with copy,
 * and push gated on the recipient's push setting (push off → in-app only).
 *
 * Integration (only when DATABASE_URL is set and JERK_CHECKS_DB=1): same rules
 * against real Postgres (jerks table, notifications CHECK, blocks, likes).
 *
 *   npm run test:jerk
 *   JERK_CHECKS_DB=1 DATABASE_URL=postgres://... npm run test:jerk
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { SecurityError } from '../src/security/access';
import { hasPushSubscription, type PushPayload } from '../src/services/push.service';
import {
  createJerkService,
  JerkDeps,
  JerkLimitError,
  JerkQueryFn,
} from '../src/services/jerk.service';
import {
  JERK_DAILY_LIMIT,
  JERK_MESSAGE_TEMPLATE,
  jerkMessage,
} from '../src/constants/jerk';

type Jerk = { id: string; from: string; to: string; created_at: number };

function makeFake(
  opts: { blocked?: Array<[string, string]>; names?: Record<string, string>; pushOff?: string[] } = {},
) {
  const jerks: Jerk[] = [];
  const queries: string[] = [];
  const notifications: Array<Record<string, unknown>> = [];
  const pushes: Array<{ userId: string; payload: PushPayload }> = [];
  const events: Array<{ event: string; fields: Record<string, unknown> }> = [];
  const blocked = opts.blocked ?? [];
  const names = opts.names ?? {};
  const pushOff = new Set(opts.pushOff ?? []);
  const pushChecks: string[] = [];
  let clock = Date.now();

  const runQuery: JerkQueryFn = async (text, values = []) => {
    queries.push(text);
    const v = values as any[];
    if (/pg_advisory_xact_lock/.test(text)) return { rows: [] };
    if (/SELECT id FROM jerks/.test(text)) {
      const windowMs = Number(v[2]) * 3600_000;
      const hit = jerks
        .filter((j) => j.from === v[0] && j.to === v[1] && j.created_at > clock - windowMs)
        .sort((a, b) => b.created_at - a.created_at)[0];
      return { rows: hit ? [{ id: hit.id }] : [] };
    }
    if (/COUNT\(\*\)::int AS n FROM jerks/.test(text)) {
      return { rows: [{ n: jerks.filter((j) => j.from === v[0] && j.created_at > clock - 86_400_000).length }] };
    }
    if (/INSERT INTO jerks/.test(text)) {
      const row = { id: randomUUID(), from: v[0], to: v[1], created_at: clock };
      jerks.push(row);
      return { rows: [{ id: row.id }], rowCount: 1 };
    }
    if (/SELECT name FROM users/.test(text)) return { rows: names[v[0]] ? [{ name: names[v[0]] }] : [] };
    throw new Error(`unexpected query: ${text}`);
  };

  const deps: JerkDeps = {
    runQuery,
    withTransaction: (fn) => fn(runQuery),
    assertCanJerk: async (from, to) => {
      if (blocked.some(([a, b]) => (a === from && b === to) || (a === to && b === from))) {
        throw new SecurityError('interaction_blocked', 403, 'Interaction is blocked');
      }
    },
    notify: async (_io, params) => {
      notifications.push(params);
      return params;
    },
    push: async (userId, payload) => {
      pushes.push({ userId, payload });
    },
    wantsPush: async (userId) => {
      pushChecks.push(userId);
      return !pushOff.has(userId);
    },
    logEvent: (event, fields) => events.push({ event, fields }),
  };

  return {
    deps,
    jerks,
    queries,
    notifications,
    pushes,
    pushChecks,
    events,
    advance: (ms: number) => {
      clock += ms;
    },
  };
}

const flush = () => new Promise((r) => setImmediate(r));
const id = () => randomUUID();

async function unitChecks() {
  // Copy lives in one constant.
  assert.strictEqual(JERK_MESSAGE_TEMPLATE, '{name} jerked you 😏');
  assert.strictEqual(jerkMessage('Dan'), 'Dan jerked you 😏');
  assert.strictEqual(jerkMessage(''), 'Someone jerked you 😏');
  assert.strictEqual(JERK_DAILY_LIMIT, 20);
  console.log('PASS copy constant + daily limit constant');

  // Self-jerk rejected.
  {
    const f = makeFake();
    const svc = createJerkService(f.deps);
    const me = id();
    await assert.rejects(svc.sendJerk(me, me), (e: any) => e instanceof SecurityError && e.status === 400);
    assert.strictEqual(f.jerks.length, 0);
    console.log('PASS no self-jerk (400)');
  }

  // Blocks respected both ways, neutral 404, nothing written or sent.
  {
    const a = id();
    const b = id();
    const c = id();
    const f = makeFake({ blocked: [[a, b], [c, a]] });
    const svc = createJerkService(f.deps);
    for (const target of [b, c]) {
      await assert.rejects(
        svc.sendJerk(a, target),
        (e: any) => e instanceof SecurityError && e.status === 404 && e.code === 'target_unavailable',
      );
    }
    await flush();
    assert.strictEqual(f.jerks.length, 0, 'no jerk row when blocked');
    assert.strictEqual(f.notifications.length, 0, 'no notification when blocked');
    assert.strictEqual(f.pushes.length, 0, 'no push when blocked');
    console.log('PASS block respected both ways (neutral 404, no row, no alert)');
  }

  // Bad id → neutral 404, no query.
  {
    const f = makeFake();
    const svc = createJerkService(f.deps);
    await assert.rejects(svc.sendJerk(id(), 'not-a-uuid'), (e: any) => e.status === 404);
    assert.strictEqual(f.queries.length, 0);
    console.log('PASS malformed id → 404 without DB work');
  }

  // Sent: notification + push queued, event emitted, never touches likes.
  {
    const a = id();
    const b = id();
    const f = makeFake({ names: { [a]: 'Dan' } });
    const svc = createJerkService(f.deps);
    const res = await svc.sendJerk(a, b);
    await flush();
    assert.strictEqual(res.status, 'sent');
    assert.strictEqual(res.sent_today, 1);
    assert.strictEqual(res.daily_limit, 20);
    assert.strictEqual(f.notifications.length, 1);
    assert.deepStrictEqual(
      { ...f.notifications[0] },
      { userId: b, actorId: a, type: 'jerk', title: 'Dan jerked you 😏', body: null, linkPath: `/profile/${a}` },
    );
    assert.strictEqual(f.pushes.length, 1);
    assert.strictEqual(f.pushes[0].userId, b);
    assert.strictEqual(f.pushes[0].payload.title, 'Dan jerked you 😏');
    assert.strictEqual(f.pushes[0].payload.url, `/profile/${a}`);
    assert.ok(f.events.some((e) => e.event === 'jerk_sent' && e.fields.to === b));
    assert.ok(!f.queries.some((q) => /\blikes\b/i.test(q)), 'jerk never reads or writes likes');
    console.log('PASS sent → jerk notification + push queued + jerk_sent event, no likes touched');
  }

  // Repeat within 24h idempotent: one row, one notification, one push; after 24h it can send again.
  {
    const a = id();
    const b = id();
    const f = makeFake({ names: { [a]: 'Dan' } });
    const svc = createJerkService(f.deps);
    const first = await svc.sendJerk(a, b);
    f.advance(60 * 60 * 1000);
    const second = await svc.sendJerk(a, b);
    const third = await svc.sendJerk(a, b);
    await flush();
    assert.strictEqual(second.status, 'repeat');
    assert.strictEqual(third.status, 'repeat');
    assert.strictEqual(second.jerk_id, first.jerk_id);
    assert.strictEqual(f.jerks.length, 1);
    assert.strictEqual(f.notifications.length, 1, 'no duplicate notification');
    assert.strictEqual(f.pushes.length, 1, 'no duplicate push');
    f.advance(24 * 60 * 60 * 1000);
    const later = await svc.sendJerk(a, b);
    await flush();
    assert.strictEqual(later.status, 'sent');
    assert.strictEqual(f.notifications.length, 2);
    console.log('PASS repeat inside 24h is idempotent (no duplicate alert); fresh after 24h');
  }

  // Daily limit: 20 new targets OK, 21st → 429; repeats do not count; resets after 24h.
  {
    const a = id();
    const f = makeFake();
    const svc = createJerkService(f.deps);
    const targets = Array.from({ length: JERK_DAILY_LIMIT + 1 }, () => id());
    for (let i = 0; i < JERK_DAILY_LIMIT; i++) {
      const r = await svc.sendJerk(a, targets[i]);
      assert.strictEqual(r.status, 'sent');
    }
    // A repeat at the cap still answers 200 'repeat' (not 429).
    const rep = await svc.sendJerk(a, targets[0]);
    assert.strictEqual(rep.status, 'repeat');
    await assert.rejects(
      svc.sendJerk(a, targets[JERK_DAILY_LIMIT]),
      (e: any) => e instanceof JerkLimitError && e.status === 429 && e.code === 'jerk_daily_limit',
    );
    await flush();
    assert.strictEqual(f.jerks.length, JERK_DAILY_LIMIT);
    assert.strictEqual(f.notifications.length, JERK_DAILY_LIMIT);
    assert.ok(f.events.some((e) => e.event === 'jerk_limited'));
    f.advance(24 * 60 * 60 * 1000 + 1000);
    const after = await svc.sendJerk(a, targets[JERK_DAILY_LIMIT]);
    assert.strictEqual(after.status, 'sent');
    console.log(`PASS daily limit ${JERK_DAILY_LIMIT}: 21st → 429 jerk_daily_limit, resets after 24h`);
  }

  // Notify failure does not break the send; push still queued.
  {
    const a = id();
    const b = id();
    const f = makeFake();
    f.deps.notify = async () => {
      throw new Error('boom');
    };
    const svc = createJerkService(f.deps);
    const origError = console.error;
    console.error = () => undefined;
    try {
      const r = await svc.sendJerk(a, b);
      await flush();
      assert.strictEqual(r.status, 'sent');
      assert.strictEqual(f.pushes.length, 1);
    } finally {
      console.error = origError;
    }
    console.log('PASS notification failure is non-fatal');
  }

  // Push OFF: in-app notification still created, NO push queued.
  {
    const a = id();
    const b = id();
    const f = makeFake({ names: { [a]: 'Dan' }, pushOff: [b] });
    const svc = createJerkService(f.deps);
    const res = await svc.sendJerk(a, b);
    await flush();
    assert.strictEqual(res.status, 'sent');
    assert.strictEqual(f.jerks.length, 1, 'jerk row still written');
    assert.strictEqual(f.notifications.length, 1, 'in-app notification still created');
    assert.strictEqual(f.notifications[0].userId, b);
    assert.strictEqual(f.notifications[0].type, 'jerk');
    assert.strictEqual(f.notifications[0].title, 'Dan jerked you 😏');
    assert.deepStrictEqual(f.pushChecks, [b], 'push setting checked for the recipient');
    assert.strictEqual(f.pushes.length, 0, 'no push queued when push is off');
    assert.ok(f.events.some((e) => e.event === 'jerk_sent' && e.fields.to === b));
    console.log('PASS push off → in-app notification created, no push queued');
  }

  // Push ON: push queued as before, alongside the in-app notification.
  {
    const a = id();
    const b = id();
    const other = id();
    const f = makeFake({ names: { [a]: 'Dan' }, pushOff: [other] });
    const svc = createJerkService(f.deps);
    const res = await svc.sendJerk(a, b);
    await flush();
    assert.strictEqual(res.status, 'sent');
    assert.strictEqual(f.notifications.length, 1);
    assert.deepStrictEqual(f.pushChecks, [b]);
    assert.strictEqual(f.pushes.length, 1, 'push queued when push is on');
    assert.strictEqual(f.pushes[0].userId, b);
    assert.deepStrictEqual(f.pushes[0].payload, {
      title: 'Dan jerked you 😏',
      body: '',
      url: `/profile/${a}`,
      tag: `jerk-${a}`,
    });
    console.log('PASS push on → push queued as before');
  }

  // Push setting check fails → fail closed: no push, in-app notification stands, send still 200.
  {
    const a = id();
    const b = id();
    const f = makeFake();
    f.deps.wantsPush = async () => {
      throw new Error('db down');
    };
    const svc = createJerkService(f.deps);
    const res = await svc.sendJerk(a, b);
    await flush();
    assert.strictEqual(res.status, 'sent');
    assert.strictEqual(f.notifications.length, 1);
    assert.strictEqual(f.pushes.length, 0);
    console.log('PASS push setting check failure → no push, notification kept');
  }

  // hasPushSubscription reads push_subscriptions (the Settings push toggle's table).
  {
    const on = id();
    const off = id();
    const seen: Array<{ text: string; values: unknown[] }> = [];
    const fakeQuery = async (text: string, values: unknown[] = []) => {
      seen.push({ text, values });
      return { rows: values[0] === on ? [{ '?column?': 1 }] : [] };
    };
    assert.strictEqual(await hasPushSubscription(on, fakeQuery), true);
    assert.strictEqual(await hasPushSubscription(off, fakeQuery), false);
    assert.ok(seen.every((q) => /FROM push_subscriptions WHERE user_id = \$1/.test(q.text)));
    console.log('PASS hasPushSubscription keys on push_subscriptions rows');
  }
}

function staticChecks() {
  const root = path.join(__dirname, '..');
  const routes = fs.readFileSync(path.join(root, 'src/routes/users.ts'), 'utf8');
  assert.ok(routes.includes("router.post('/jerk/:id'"), 'POST /users/jerk/:id route exists');
  assert.ok(/status\(429\)/.test(routes), 'route answers 429 for the daily limit');
  const svc = fs.readFileSync(path.join(root, 'src/services/jerk.service.ts'), 'utf8');
  assert.ok(!/INSERT INTO likes/i.test(svc), 'jerk service never inserts likes');
  const notif = fs.readFileSync(path.join(root, 'src/services/notification.service.ts'), 'utf8');
  assert.ok(notif.includes("| 'jerk'"), "NotificationType includes 'jerk'");
  const migDirs = [path.join(root, '../database/migrations'), path.join(root, 'database/migrations')];
  for (const dir of migDirs) {
    if (!fs.existsSync(dir)) continue;
    const mig = fs.readdirSync(dir).find((f) => /_jerks\.sql$/.test(f));
    assert.ok(mig, `jerks migration present in ${dir}`);
    const sql = fs.readFileSync(path.join(dir, mig!), 'utf8');
    assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS jerks'));
    assert.ok(sql.includes("'jerk'"));
  }
  console.log('PASS static: route, 429, no likes insert, notification type, migration in both dirs');
}

async function integrationChecks() {
  const { default: pool, query } = await import('../src/db');
  const { notificationService } = await import('../src/services/notification.service');
  const { accessControl } = await import('../src/security/access');
  const { withPoolTransaction, logJerkEvent } = await import('../src/services/jerk.service');

  const pushes: Array<{ userId: string; payload: PushPayload }> = [];
  const emitted: Array<{ room: string; event: string; data: any }> = [];
  const io = {
    to: (room: string) => ({ emit: (event: string, data: unknown) => emitted.push({ room, event, data }) }),
  };
  const svc = createJerkService({
    runQuery: query,
    withTransaction: withPoolTransaction,
    assertCanJerk: async (f, t) => {
      await accessControl.assertProfileView(f, t);
      await accessControl.assertInteraction(f, t);
    },
    notify: (i, p) => notificationService.notify(i, p),
    push: async (userId, payload) => {
      pushes.push({ userId, payload });
    },
    wantsPush: (userId) => hasPushSubscription(userId),
    logEvent: logJerkEvent,
    dailyLimit: 3,
  });

  const users = Array.from({ length: 6 }, () => randomUUID());
  const [a, b, c, d, e, g] = users;
  try {
    for (const [i, u] of users.entries()) {
      await query(
        `INSERT INTO users (id, email, password_hash, name, age, is_verified, verification_status)
         VALUES ($1, $2, 'x', $3, 30, TRUE, 'verified')`,
        [u, `jerk-${u.slice(0, 8)}@test.menrush.local`, `Jerk${i}`],
      );
      await query(
        `INSERT INTO profiles (user_id, is_visible) VALUES ($1, TRUE)
         ON CONFLICT (user_id) DO UPDATE SET is_visible = TRUE`,
        [u],
      );
    }

    // b has push on (a subscription row); e has none (push off).
    await query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES ($1, $2, 'p', 'a')`,
      [b, `https://push.test.menrush.local/${b}`],
    );

    const likesBefore = (await query(`SELECT COUNT(*)::int AS n FROM likes WHERE liker_id = ANY($1::uuid[]) OR liked_id = ANY($1::uuid[])`, [users])).rows[0].n;

    const r1 = await svc.sendJerk(a, b, { io });
    await flush();
    assert.strictEqual(r1.status, 'sent');
    const n1 = await query(`SELECT type, title, link_path FROM notifications WHERE user_id = $1 AND actor_id = $2`, [b, a]);
    assert.strictEqual(n1.rows.length, 1);
    assert.strictEqual(n1.rows[0].type, 'jerk');
    assert.strictEqual(n1.rows[0].title, 'Jerk0 jerked you 😏');
    assert.ok(emitted.some((x) => x.room === `user:${b}` && x.data.type === 'jerk'), 'socket notification emitted');
    assert.strictEqual(pushes.filter((p) => p.userId === b).length, 1, 'push queued');

    const r2 = await svc.sendJerk(a, b, { io });
    await flush();
    assert.strictEqual(r2.status, 'repeat');
    assert.strictEqual((await query(`SELECT COUNT(*)::int AS n FROM jerks WHERE from_user_id = $1 AND to_user_id = $2`, [a, b])).rows[0].n, 1);
    assert.strictEqual((await query(`SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = $1 AND actor_id = $2`, [b, a])).rows[0].n, 1);
    assert.strictEqual(pushes.filter((p) => p.userId === b).length, 1, 'no duplicate push');

    // Concurrent double tap → still one row.
    const both = await Promise.all([svc.sendJerk(a, c), svc.sendJerk(a, c)]);
    assert.deepStrictEqual(both.map((x) => x.status).sort(), ['repeat', 'sent']);
    assert.strictEqual((await query(`SELECT COUNT(*)::int AS n FROM jerks WHERE from_user_id = $1 AND to_user_id = $2`, [a, c])).rows[0].n, 1);

    // Blocks both ways.
    await query(`INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2)`, [d, a]);
    await assert.rejects(svc.sendJerk(a, d), (x: any) => x.status === 404 && x.code === 'target_unavailable');
    await assert.rejects(svc.sendJerk(d, a), (x: any) => x.status === 404 && x.code === 'target_unavailable');
    assert.strictEqual((await query(`SELECT COUNT(*)::int AS n FROM jerks WHERE (from_user_id = $1 AND to_user_id = $2) OR (from_user_id = $2 AND to_user_id = $1)`, [a, d])).rows[0].n, 0);

    // Limit 3 (injected for the DB run): a has sent to b, c → one more, then 429.
    const r3 = await svc.sendJerk(a, e, { io });
    await flush();
    assert.strictEqual(r3.status, 'sent');
    // e has push off: in-app notification row + socket, but no push queued.
    assert.strictEqual((await query(`SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = $1 AND actor_id = $2 AND type = 'jerk'`, [e, a])).rows[0].n, 1);
    assert.ok(emitted.some((x) => x.room === `user:${e}` && x.data.type === 'jerk'), 'socket notification emitted with push off');
    assert.strictEqual(pushes.filter((p) => p.userId === e).length, 0, 'no push when push is off');
    await assert.rejects(svc.sendJerk(a, g), (x: any) => x instanceof JerkLimitError && x.status === 429);

    // Self-jerk blocked by the DB too.
    await assert.rejects(query(`INSERT INTO jerks (from_user_id, to_user_id) VALUES ($1, $1)`, [a]));

    // No like / match created.
    const likesAfter = (await query(`SELECT COUNT(*)::int AS n FROM likes WHERE liker_id = ANY($1::uuid[]) OR liked_id = ANY($1::uuid[])`, [users])).rows[0].n;
    assert.strictEqual(likesAfter, likesBefore, 'jerk created no like or match');

    // seen_at set when the recipient reads the jerk notification.
    const notifId = (await query(`SELECT id FROM notifications WHERE user_id = $1 AND actor_id = $2 AND type = 'jerk'`, [b, a])).rows[0].id;
    const seen = await svc.markSeenForNotification(b, notifId);
    assert.strictEqual(seen, 1);
    assert.ok((await query(`SELECT seen_at FROM jerks WHERE from_user_id = $1 AND to_user_id = $2`, [a, b])).rows[0].seen_at);

    console.log('PASS integration: notification row + socket + push (push on) / no push (push off), repeat idempotent (also concurrent), blocks both ways, limit 429, no likes, seen_at');
  } finally {
    await query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [users]).catch(() => undefined);
    await pool.end();
  }
}

(async () => {
  await unitChecks();
  staticChecks();
  if (process.env.JERK_CHECKS_DB === '1' && process.env.DATABASE_URL) {
    await integrationChecks();
  } else {
    console.log('SKIP integration (set JERK_CHECKS_DB=1 and DATABASE_URL)');
  }
  console.log('ALL JERK CHECKS PASSED');
  process.exit(0);
})().catch((err) => {
  console.error('FAIL', err);
  process.exit(1);
});
