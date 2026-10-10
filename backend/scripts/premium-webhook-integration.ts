/**
 * Real PG: Verotel postbacks through the real route change Premium only when
 * correctly signed. Skips without DATABASE_URL.
 *   DATABASE_URL=postgresql://localhost:5432/menrush_test npx ts-node scripts/premium-webhook-integration.ts
 */
import assert from 'assert';
import http from 'http';
import { createHash, randomUUID } from 'crypto';
import express from 'express';

if (!process.env.DATABASE_URL) {
  console.log('premium-webhook-integration: SKIPPED (no DATABASE_URL)');
  process.exit(0);
}

const KEY = 'test-verotel-signature-key-integration';
process.env.VEROTEL_SIGNATURE_KEY = KEY;
delete process.env.VEROTEL_SHOP_ID;

function sign(params: Record<string, string>): string {
  const keys = Object.keys(params).sort();
  return createHash('sha256').update([KEY, ...keys.map((k) => `${k}=${params[k]}`)].join(':'), 'utf8').digest('hex');
}

function get(port: number, qs: string): Promise<number> {
  return new Promise((resolve, reject) => {
    http
      .get({ hostname: '127.0.0.1', port, path: `/api/premium/webhook?${qs}` }, (res) => {
        res.resume();
        res.on('end', () => resolve(res.statusCode ?? 0));
      })
      .on('error', reject);
  });
}

let passed = 0;
const ok = (n: string) => {
  passed += 1;
  console.log(`ok - ${n}`);
};

async function main() {
  const { default: pool, query } = await import('../src/db');
  const { premiumService } = await import('../src/services/premium.service');
  const { default: routes } = await import('../src/routes/premium-webhook');
  premiumService.isBetaPremiumFree = () => false;

  const app = express();
  app.use('/api/premium/webhook', routes);
  const server = await new Promise<http.Server>((r) => {
    const s = app.listen(0, '127.0.0.1', () => r(s));
  });
  const port = (server.address() as { port: number }).port;

  const id = randomUUID();
  const extraUsers: string[] = [];
  await query(
    `INSERT INTO users (id, email, password_hash, name, age, is_premium, premium_tier)
     VALUES ($1, $2, 'x', 'PW Member', 30, FALSE, 'free')`,
    [id, `pw-${id.slice(0, 8)}@test.menrush.local`],
  );
  const premium = async () =>
    (await query(`SELECT is_premium, premium_until FROM users WHERE id = $1`, [id])).rows[0];
  const sent: Record<string, string> = {};
  const send = async (p: Record<string, string>, signed = true) => {
    const sp = new URLSearchParams(p);
    if (signed) sp.set('signature', sign(p));
    const qs = sp.toString();
    if (signed) sent[`${p.event}:${p.transactionID || p.nextChargeOn || p.expiresOn || ''}`] = qs;
    return get(port, qs);
  };
  const replay = (key: string) => get(port, sent[key]);
  const subRows = async () =>
    Number((await query(`SELECT COUNT(*)::int AS n FROM subscriptions WHERE user_id = $1`, [id])).rows[0].n);

  try {
    const base = { shopID: '123', saleID: '777', custom1: id, type: 'subscription' };
    assert.strictEqual(await send({ ...base, event: 'initial', priceAmount: '6.99', priceCurrency: 'GBP' }, false), 400);
    assert.strictEqual((await premium()).is_premium, false);
    ok('unsigned initial does not grant Premium');

    assert.strictEqual(
      await send({ ...base, event: 'initial', priceAmount: '6.99', priceCurrency: 'GBP', nextChargeOn: '2026-11-10' }),
      200,
    );
    let row = await premium();
    assert.strictEqual(row.is_premium, true);
    assert.strictEqual(new Date(row.premium_until).toISOString(), '2026-11-10T23:59:59.000Z');
    const sub = await query(`SELECT processor, processor_subscription_id, status FROM subscriptions WHERE user_id = $1`, [id]);
    assert.deepStrictEqual(
      { ...sub.rows[0] },
      { processor: 'verotel', processor_subscription_id: '777', status: 'active' },
    );
    ok('signed initial grants Premium to nextChargeOn, subscription recorded as verotel');

    // Replay: the exact same signed URL again does nothing.
    assert.strictEqual(await replay('initial:2026-11-10'), 200, 'replay still answers OK');
    assert.strictEqual(await subRows(), 1, 'replayed initial adds no subscription row');
    ok('replayed initial is ignored (one subscription row)');

    assert.strictEqual(await send({ ...base, event: 'expiry' }, false), 400);
    assert.strictEqual((await premium()).is_premium, true);
    ok('unsigned expiry does not remove Premium');

    assert.strictEqual(await send({ ...base, event: 'cancel', expiresOn: '2026-11-10', cancelledBy: 'user' }), 200);
    assert.strictEqual((await premium()).is_premium, true);
    ok('signed cancel keeps Premium until the period ends');

    assert.strictEqual(await send({ ...base, event: 'rebill', amount: '6.99', currency: 'GBP', nextChargeOn: '2026-12-10' }), 200);
    row = await premium();
    assert.strictEqual(new Date(row.premium_until).toISOString(), '2026-12-10T23:59:59.000Z');
    ok('signed rebill extends Premium');

    // Replayed rebill does not move the period or record another payment.
    await query(`UPDATE users SET premium_until = '2026-12-01T00:00:00Z' WHERE id = $1`, [id]);
    assert.strictEqual(await replay('rebill:2026-12-10'), 200);
    assert.strictEqual(new Date((await premium()).premium_until).toISOString(), '2026-12-01T00:00:00.000Z');
    await query(`UPDATE users SET premium_until = '2026-12-10T23:59:59Z' WHERE id = $1`, [id]);
    // A real next rebill (new transaction) still applies.
    assert.strictEqual(
      await send({ ...base, event: 'rebill', transactionID: 't-2', amount: '6.99', currency: 'GBP', nextChargeOn: '2027-01-10' }),
      200,
    );
    assert.strictEqual(new Date((await premium()).premium_until).toISOString(), '2027-01-10T23:59:59.000Z');
    ok('replayed rebill is ignored; a new rebill transaction applies');

    assert.strictEqual(await send({ ...base, event: 'expiry' }), 200);
    assert.strictEqual((await premium()).is_premium, false);
    ok('signed expiry ends Premium');

    // A captured initial or rebill URL replayed after expiry cannot re-grant Premium.
    assert.strictEqual(await replay('initial:2026-11-10'), 200);
    assert.strictEqual(await replay('rebill:t-2'), 200);
    assert.strictEqual((await premium()).is_premium, false);
    assert.strictEqual(await subRows(), 1);
    ok('replayed initial / rebill after expiry do not bring Premium back');

    // Two copies of the same postback at once: applied exactly once.
    const sale2 = { shopID: '123', saleID: '778', custom1: id, type: 'subscription', event: 'initial', priceAmount: '6.99', priceCurrency: 'GBP', nextChargeOn: '2026-11-11' };
    const qs2 = new URLSearchParams({ ...sale2, signature: sign(sale2) }).toString();
    const codes = await Promise.all([get(port, qs2), get(port, qs2), get(port, qs2)]);
    assert.deepStrictEqual(codes, [200, 200, 200]);
    const claimed = await query(`SELECT COUNT(*)::int AS n FROM billing_postback_events WHERE sale_id = '778'`);
    assert.strictEqual(claimed.rows[0].n, 1);
    assert.strictEqual(await subRows(), 2, 'one new subscription for sale 778');
    ok('concurrent duplicate postbacks apply once');

    // ── Atomic replay guard: a failure after the claim leaves nothing behind ──
    const id2 = randomUUID();
    extraUsers.push(id2);
    await query(
      `INSERT INTO users (id, email, password_hash, name, age, is_premium, premium_tier)
       VALUES ($1, $2, 'x', 'PW Crash', 30, FALSE, 'free')`,
      [id2, `pw-${id2.slice(0, 8)}@test.menrush.local`],
    );
    const p2 = async () => (await query(`SELECT is_premium FROM users WHERE id = $1`, [id2])).rows[0].is_premium;
    const claims = async (sale: string) =>
      Number((await query(`SELECT COUNT(*)::int AS n FROM billing_postback_events WHERE sale_id = $1`, [sale])).rows[0].n);
    const subs2 = async () =>
      Number((await query(`SELECT COUNT(*)::int AS n FROM subscriptions WHERE user_id = $1`, [id2])).rows[0].n);
    const signedQs = (p: Record<string, string>) => new URLSearchParams({ ...p, signature: sign(p) }).toString();
    const realApply = premiumService.applyVerotelEventOnce;

    // (a) Premium writes run, then the apply throws before COMMIT.
    const crashSale = { shopID: '123', saleID: '779', custom1: id2, type: 'subscription', event: 'initial', priceAmount: '6.99', priceCurrency: 'GBP', nextChargeOn: '2026-11-12' };
    premiumService.applyVerotelEventOnce = async function (this: any, ...args: any[]) {
      await (realApply as any).apply(this, args); // claim + Premium writes done inside the transaction
      throw new Error('simulated crash after the Premium writes');
    } as any;
    assert.strictEqual(await get(port, signedQs(crashSale)), 500, 'failed apply answers 500 so Verotel retries');
    assert.strictEqual(await claims('779'), 0, 'no claim row left behind');
    assert.strictEqual(await p2(), false, 'no Premium written');
    assert.strictEqual(await subs2(), 0, 'no subscription written');
    premiumService.applyVerotelEventOnce = realApply;
    assert.strictEqual(await get(port, signedQs(crashSale)), 200, 'Verotel retry');
    assert.strictEqual(await p2(), true, 'retry grants Premium');
    assert.strictEqual(await claims('779'), 1);
    assert.strictEqual(await subs2(), 1, 'applied once');
    assert.strictEqual(await get(port, signedQs(crashSale)), 200);
    assert.strictEqual(await subs2(), 1, 'a later replay is still a duplicate');
    ok('apply fails after the claim: nothing persists, the retry applies once');

    // (b) The DB session dies mid-transaction (process-death case on the server side).
    const deathSale = { shopID: '123', saleID: '780', custom1: id2, type: 'subscription', event: 'rebill', transactionID: 't-780', amount: '6.99', currency: 'GBP', nextChargeOn: '2026-12-12' };
    premiumService.applyVerotelEventOnce = async function (this: any, ...args: any[]) {
      await (realApply as any).apply(this, args);
      const tx = args[2] as { db: { query: (sql: string) => Promise<unknown> } };
      await tx.db.query('SELECT pg_terminate_backend(pg_backend_pid())'); // connection killed before COMMIT
      return { ok: true };
    } as any;
    const before = (await query(`SELECT premium_until FROM users WHERE id = $1`, [id2])).rows[0].premium_until;
    assert.strictEqual(await get(port, signedQs(deathSale)), 500);
    assert.strictEqual(await claims('780'), 0, 'no claim row after the session died');
    const mid = (await query(`SELECT premium_until FROM users WHERE id = $1`, [id2])).rows[0].premium_until;
    assert.strictEqual(new Date(mid).getTime(), new Date(before).getTime(), 'rebill not half-applied');
    premiumService.applyVerotelEventOnce = realApply;
    assert.strictEqual(await get(port, signedQs(deathSale)), 200, 'Verotel retry');
    const after = (await query(`SELECT premium_until FROM users WHERE id = $1`, [id2])).rows[0].premium_until;
    assert.strictEqual(new Date(after).toISOString(), '2026-12-12T23:59:59.000Z', 'retry applies the rebill');
    assert.strictEqual(await claims('780'), 1);
    ok('session dies before COMMIT: nothing persists, the retry applies once');

    console.log(`premium-webhook-integration: ${passed} passed`);
  } finally {
    await query(`DELETE FROM referral_commissions WHERE referee_id = $1`, [id]).catch(() => undefined);
    await query(`DELETE FROM subscriptions WHERE user_id = $1`, [id]).catch(() => undefined);
    await query(`DELETE FROM billing_postback_events WHERE sale_id IN ('777', '778', '779', '780')`).catch(() => undefined);
    for (const u of extraUsers) {
      await query(`DELETE FROM referral_commissions WHERE referee_id = $1`, [u]).catch(() => undefined);
      await query(`DELETE FROM subscriptions WHERE user_id = $1`, [u]).catch(() => undefined);
      await query(`DELETE FROM users WHERE id = $1`, [u]).catch(() => undefined);
    }
    await query(`DELETE FROM users WHERE id = $1`, [id]).catch(() => undefined);
    await new Promise<void>((r) => server.close(() => r()));
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
