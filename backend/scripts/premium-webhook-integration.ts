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
  await query(
    `INSERT INTO users (id, email, password_hash, name, age, is_premium, premium_tier)
     VALUES ($1, $2, 'x', 'PW Member', 30, FALSE, 'free')`,
    [id, `pw-${id.slice(0, 8)}@test.menrush.local`],
  );
  const premium = async () =>
    (await query(`SELECT is_premium, premium_until FROM users WHERE id = $1`, [id])).rows[0];
  const send = async (p: Record<string, string>, signed = true) => {
    const sp = new URLSearchParams(p);
    if (signed) sp.set('signature', sign(p));
    return get(port, sp.toString());
  };

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

    assert.strictEqual(await send({ ...base, event: 'expiry' }), 200);
    assert.strictEqual((await premium()).is_premium, false);
    ok('signed expiry ends Premium');

    console.log(`premium-webhook-integration: ${passed} passed`);
  } finally {
    await query(`DELETE FROM referral_commissions WHERE referee_id = $1`, [id]).catch(() => undefined);
    await query(`DELETE FROM subscriptions WHERE user_id = $1`, [id]).catch(() => undefined);
    await query(`DELETE FROM users WHERE id = $1`, [id]).catch(() => undefined);
    await new Promise<void>((r) => server.close(() => r()));
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
