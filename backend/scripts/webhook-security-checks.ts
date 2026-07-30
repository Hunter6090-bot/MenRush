import assert from 'assert';
import { ccbillService } from '../src/services/ccbill.service';
import {
  classifyEventCategory,
  createWebhookEventStore,
  extractOccurredAt,
  extractProviderEventId,
} from '../src/services/ccbill-webhook.service';

type Test = { name: string; run: () => void | Promise<void> };
const tests: Test[] = [];

function test(name: string, run: Test['run']) {
  tests.push({ name, run });
}

async function withEnv(
  vars: Record<string, string | undefined>,
  run: () => void | Promise<void>,
  ): Promise<void> {
  const prev: Record<string, string | undefined> = {};
  for (const key of Object.keys(vars)) {
    prev[key] = process.env[key];
    const next = vars[key];
    if (next === undefined) delete process.env[key];
    else process.env[key] = next;
  }
  try {
    await run();
  } finally {
    for (const key of Object.keys(prev)) {
      const value = prev[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

type MockRow = Record<string, any>;

function createMockDb() {
  const rows: MockRow[] = [];
  let idCounter = 0;

const runQuery = async (text: string, values: unknown[] = []) => {
  const sql = text.trim();

  if (sql.startsWith('INSERT INTO processed_webhook_events')) {
    const [providerEventId, eventType, eventCategory, userId, subscriptionId, occurredAt] =
      values as any[];
    const clash = rows.find(
      (r) => r.provider === 'ccbill' && r.provider_event_id === providerEventId,
      );
    if (clash) {
      return { rows: [], rowCount: 0 };
    }
    idCounter += 1;
    const row: MockRow = {
      id: String(idCounter),
      provider: 'ccbill',
      provider_event_id: providerEventId,
      event_type: eventType,
      event_category: eventCategory,
      user_id: userId,
      subscription_id: subscriptionId,
      occurred_at: occurredAt,
      status: 'processing',
    };
    rows.push(row);
    return { rows: [{ id: row.id }], rowCount: 1 };
  }

  if (sql.startsWith('SELECT id FROM processed_webhook_events')) {
    const [providerEventId] = values as any[];
    const row = rows.find((r) => r.provider_event_id === providerEventId);
    return { rows: row ? [{ id: row.id }] : [], rowCount: row ? 1 : 0 };
  }

  if (sql.startsWith('SELECT occurred_at FROM processed_webhook_events')) {
    const [subscriptionId] = values as any[];
    const processed = rows
    .filter(
      (r) => r.subscription_id === subscriptionId && r.status === 'processed' && r.occurred_at,
      )
    .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());
    return {
      rows: processed[0] ? [{ occurred_at: processed[0].occurred_at }] : [],
      rowCount: processed[0] ? 1 : 0,
    };
  }

  if (sql.startsWith('UPDATE processed_webhook_events')) {
    const id = (values as any[])[(values as any[]).length - 1];
    const row = rows.find((r) => r.id === id);
    if (row) {
      if (sql.includes("status = 'processed'")) row.status = 'processed';
      else if (sql.includes("status = 'ignored_out_of_order'")) row.status = 'ignored_out_of_order';
      else if (sql.includes("status = 'failed'")) row.status = 'failed';
    }
    return { rows: [], rowCount: row ? 1 : 0 };
  }

  throw new Error(`Unhandled mock query: ${sql}`);
};

return { runQuery, rows };
}


// ---------------------------------------------------------------------------
// classifyEventCategory: refunds and chargebacks must be distinguishable.
// ---------------------------------------------------------------------------

test('classifyEventCategory distinguishes refund from chargeback and other events', () => {
  assert.equal(classifyEventCategory('RefundPayment'), 'refund');
  assert.equal(classifyEventCategory('Chargeback'), 'chargeback');
  assert.equal(classifyEventCategory('Cancellation'), 'cancellation');
  assert.equal(classifyEventCategory('Expiration'), 'expiry');
  assert.equal(classifyEventCategory('RenewalSuccess'), 'renewal');
  assert.equal(classifyEventCategory('NewSaleSuccess'), 'activation');
  assert.equal(classifyEventCategory('SomethingElse'), 'other');
});

// ---------------------------------------------------------------------------
// extractProviderEventId / extractOccurredAt
// ---------------------------------------------------------------------------

test('extractProviderEventId prefers an explicit id field over the derived fallback', () => {
  const withId = extractProviderEventId('RefundPayment', {
    denialId: 'den-1',
    subscriptionId: 'sub-1',
    timestamp: '2026-01-01T00:00:00Z',
  });
  assert.equal(withId, 'denialId:den-1');

     const derived = extractProviderEventId('RefundPayment', {
       subscriptionId: 'sub-1',
       timestamp: '2026-01-01T00:00:00Z',
     });
  assert.equal(derived, 'derived:RefundPayment:sub-1:2026-01-01T00:00:00Z');

     const none = extractProviderEventId('RefundPayment', {});
  assert.equal(none, null);
});

test('extractOccurredAt parses a valid timestamp and rejects an invalid one', () => {
  const valid = extractOccurredAt({ timestamp: '2026-01-01T00:00:00Z' });
  assert.ok(valid instanceof Date && !Number.isNaN(valid.getTime()));

     const invalid = extractOccurredAt({ timestamp: 'not-a-date' });
  assert.equal(invalid, null);

     const missing = extractOccurredAt({});
  assert.equal(missing, null);
});

// ---------------------------------------------------------------------------
// verifyWebhook: fails closed, constant-time comparison.
// ---------------------------------------------------------------------------

test('verifyWebhook rejects when the secret is missing in production (fail closed)', async () => {
  await withEnv(
    {
      NODE_ENV: 'production',
      CCBILL_WEBHOOK_SECRET: undefined,
      CCBILL_ALLOW_UNVERIFIED_WEBHOOKS_DEV: 'true',
    },
    () => {
      const result = ccbillService.verifyWebhook({});
      assert.equal(result.ok, false);
      assert.equal(result.reason, 'webhook_secret_not_configured');
    },
    );
});

test('verifyWebhook rejects when the secret is missing outside production with no explicit bypass', async () => {
  await withEnv(
    {
      NODE_ENV: 'development',
      CCBILL_WEBHOOK_SECRET: undefined,
      CCBILL_ALLOW_UNVERIFIED_WEBHOOKS_DEV: undefined,
    },
    () => {
      const result = ccbillService.verifyWebhook({});
      assert.equal(result.ok, false);
      assert.equal(result.reason, 'webhook_secret_not_configured');
    },
    );
});

test('verifyWebhook only allows the explicit dev bypass outside production', async () => {
  await withEnv(
    {
      NODE_ENV: 'development',
      CCBILL_WEBHOOK_SECRET: undefined,
      CCBILL_ALLOW_UNVERIFIED_WEBHOOKS_DEV: 'true',
    },
    () => {
      const result = ccbillService.verifyWebhook({});
      assert.equal(result.ok, true);
      assert.equal(result.reason, 'insecure_dev_bypass');
    },
    );
});

test('verifyWebhook accepts a matching secret and rejects an invalid one (valid vs invalid events)', async () => {
  await withEnv({ NODE_ENV: 'test', CCBILL_WEBHOOK_SECRET: 'correct-secret' }, () => {
    const valid = ccbillService.verifyWebhook({ webhookSecret: 'correct-secret' });
    assert.equal(valid.ok, true);

                const invalid = ccbillService.verifyWebhook({ webhookSecret: 'wrong-secret' });
    assert.equal(invalid.ok, false);
    assert.equal(invalid.reason, 'signature_mismatch');

                const missingField = ccbillService.verifyWebhook({});
    assert.equal(missingField.ok, false);
    assert.equal(missingField.reason, 'signature_mismatch');
  });
});

// ---------------------------------------------------------------------------
// Idempotency: duplicate and replayed events must not be double-processed.
// ---------------------------------------------------------------------------

test('recordAttempt is idempotent for a duplicate or replayed event id', async () => {
  const { runQuery } = createMockDb();
  const store = createWebhookEventStore(runQuery);

     const event = {
       eventId: 'evt-123',
       eventType: 'NewSaleSuccess',
       category: 'activation' as const,
       userId: 'user-1',
       subscriptionId: 'sub-1',
       occurredAt: new Date('2026-01-01T00:00:00Z'),
     };

     const first = await store.recordAttempt(event);
  assert.equal(first.status, 'new');

     const duplicateDelivery = await store.recordAttempt(event);
  assert.equal(duplicateDelivery.status, 'duplicate');

     // A byte-for-byte replay of the same event must resolve the same way.
     const replayedDelivery = await store.recordAttempt({ ...event });
  assert.equal(replayedDelivery.status, 'duplicate');
});

// ---------------------------------------------------------------------------
// Out-of-order protection: entitlement state must not move backwards.
// ---------------------------------------------------------------------------

test('isOutOfOrder flags an event older than the last processed event for the same subscription', async () => {
  const { runQuery } = createMockDb();
  const store = createWebhookEventStore(runQuery);

     const newerEvent = {
       eventId: 'evt-newer',
       eventType: 'RenewalSuccess',
       category: 'renewal' as const,
       userId: 'user-1',
       subscriptionId: 'sub-1',
       occurredAt: new Date('2026-02-01T00:00:00Z'),
     };
  const attempt = await store.recordAttempt(newerEvent);
  await store.markProcessed(attempt.id);

     const outOfOrder = await store.isOutOfOrder('sub-1', new Date('2026-01-01T00:00:00Z'));
  assert.equal(outOfOrder, true);

     const inOrder = await store.isOutOfOrder('sub-1', new Date('2026-03-01T00:00:00Z'));
  assert.equal(inOrder, false);
});

test('isOutOfOrder is false for a subscription with no processed history', async () => {
  const { runQuery } = createMockDb();
  const store = createWebhookEventStore(runQuery);
  const result = await store.isOutOfOrder('sub-never-seen', new Date());
  assert.equal(result, false);
});

async function main() {
  let failures = 0;
  for (const current of tests) {
    try {
      await current.run();
      console.log(`PASS ${current.name}`);
    } catch (error) {
      failures += 1;
      console.error(`FAIL ${current.name}`);
      console.error(error);
    }
  }
  if (failures > 0) process.exit(1);
  console.log(`Webhook security checks passed (${tests.length}).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
