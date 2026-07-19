/**
 * Focused unit tests for the push-delivery service. Runnable without a live
 * database or web-push transport (both are injected). Mirrors the existing
 * ts-node script style (see test:security). Exits non-zero on failure.
 *
 *   npm run test:push
 */
import assert from 'assert';
import { deliverPush, PushPayload } from '../src/services/push.service';

type Call = { text: string; values?: unknown[] };

function makeQuery(rows: any[]) {
  const calls: Call[] = [];
  const runQuery = async (text: string, values?: unknown[]) => {
    calls.push({ text, values });
    if (/^\s*SELECT/i.test(text)) return { rows, rowCount: rows.length };
    return { rows: [], rowCount: 0 };
  };
  return { runQuery, calls };
}

const payload: PushPayload = { title: 'Alice', body: 'Hi', url: '/messages/a', tag: 'msg-a' };

async function run() {
  // 1. No-op when push is not configured (no VAPID keys).
  {
    const { runQuery, calls } = makeQuery([{ endpoint: 'e1', p256dh: 'p', auth: 'a' }]);
    const sender = { sendNotification: async () => undefined };
    const res = await deliverPush({ runQuery, sender, enabled: false }, 'user-1', payload);
    assert.deepStrictEqual(res, { configured: false, sent: 0, pruned: 0 }, 'disabled → no-op');
    assert.strictEqual(calls.length, 0, 'disabled → no DB query');
  }

  // 2. Sends to every registered subscription.
  {
    const { runQuery } = makeQuery([
      { endpoint: 'e1', p256dh: 'p1', auth: 'a1' },
      { endpoint: 'e2', p256dh: 'p2', auth: 'a2' },
    ]);
    const seen: string[] = [];
    const sender = {
      sendNotification: async (sub: any, body: string) => {
        seen.push(sub.endpoint);
        assert.strictEqual(JSON.parse(body).url, '/messages/a', 'payload url forwarded');
      },
    };
    const res = await deliverPush({ runQuery, sender, enabled: true }, 'user-1', payload);
    assert.strictEqual(res.sent, 2, 'sent to both devices');
    assert.strictEqual(res.pruned, 0, 'nothing pruned');
    assert.deepStrictEqual(seen.sort(), ['e1', 'e2'], 'both endpoints contacted');
  }

  // 3. Prunes dead subscriptions (404 / 410) and still delivers the live one.
  {
    const { runQuery, calls } = makeQuery([
      { endpoint: 'dead-410', p256dh: 'p', auth: 'a' },
      { endpoint: 'dead-404', p256dh: 'p', auth: 'a' },
      { endpoint: 'live', p256dh: 'p', auth: 'a' },
    ]);
    const sender = {
      sendNotification: async (sub: any) => {
        if (sub.endpoint === 'dead-410') throw { statusCode: 410 };
        if (sub.endpoint === 'dead-404') throw { statusCode: 404 };
      },
    };
    const res = await deliverPush({ runQuery, sender, enabled: true }, 'user-1', payload);
    assert.strictEqual(res.sent, 1, 'one live delivery');
    assert.strictEqual(res.pruned, 2, 'two dead subscriptions pruned');
    const deletes = calls.filter((c) => /DELETE/i.test(c.text));
    assert.strictEqual(deletes.length, 2, 'two DELETE statements issued');
  }

  // 4. Transient errors (e.g. 500) do NOT prune the subscription.
  {
    const { runQuery, calls } = makeQuery([{ endpoint: 'flaky', p256dh: 'p', auth: 'a' }]);
    const sender = {
      sendNotification: async () => {
        throw { statusCode: 500 };
      },
    };
    const res = await deliverPush({ runQuery, sender, enabled: true }, 'user-1', payload);
    assert.strictEqual(res.sent, 0, 'nothing sent');
    assert.strictEqual(res.pruned, 0, 'transient failure does not prune');
    assert.strictEqual(calls.filter((c) => /DELETE/i.test(c.text)).length, 0, 'no DELETE on 500');
  }

  console.log('push.service tests passed ✓');
}

run().catch((err) => {
  console.error('push.service tests FAILED');
  console.error(err);
  process.exit(1);
});
