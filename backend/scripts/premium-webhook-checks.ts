/**
 * POST/GET /api/premium/webhook (Verotel FlexPay postback) only acts on a
 * correctly signed call. Runs the real route; the event apply step is stubbed,
 * so no database is needed. Real-PG coverage: premium-webhook-integration.ts.
 *   npx ts-node scripts/premium-webhook-checks.ts
 */
import assert from 'assert';
import http from 'http';
import { createHash } from 'crypto';
import express from 'express';

const KEY = 'test-verotel-signature-key';
const USER = '00000000-0000-4000-8000-000000000001';

function listen(app: express.Express): Promise<{ server: http.Server; port: number }> {
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('expected a tcp port');
      resolve({ server, port: address.port });
    });
  });
}

function call(
  port: number,
  method: 'GET' | 'POST',
  qs: string,
  body?: string,
  contentType = 'application/x-www-form-urlencoded',
): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: `/api/premium/webhook${qs ? `?${qs}` : ''}`,
        method,
        headers: body != null ? { 'Content-Type': contentType, 'Content-Length': Buffer.byteLength(body) } : {},
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(Buffer.from(c)));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, text: Buffer.concat(chunks).toString('utf8') }));
      },
    );
    req.on('error', reject);
    if (body != null) req.write(body);
    req.end();
  });
}

function sign(params: Record<string, string>, key = KEY, alg = 'sha256'): string {
  const keys = Object.keys(params).sort();
  return createHash(alg).update([key, ...keys.map((k) => `${k}=${params[k]}`)].join(':'), 'utf8').digest('hex');
}
function qsOf(params: Record<string, string>, signature?: string): string {
  const sp = new URLSearchParams(params);
  if (signature) sp.set('signature', signature);
  return sp.toString();
}

let passed = 0;
function ok(name: string) {
  passed += 1;
  console.log(`ok - ${name}`);
}

async function main() {
  delete process.env.VEROTEL_SIGNATURE_KEY;
  delete process.env.VEROTEL_SHOP_ID;
  const { verotelSignature } = await import('../src/lib/verotelSignature');
  const { premiumService } = await import('../src/services/premium.service');
  const { default: pool } = await import('../src/db');
  const { default: premiumWebhookRoutes } = await import('../src/routes/premium-webhook');

  // Verotel's published example (FlexPay docs).
  assert.strictEqual(
    verotelSignature('BddJxtUBkDgFB9kj7Zwguxde4gAqha', {
      custom1: 'xxyyzz',
      description: 'Super video download',
      priceAmount: '9.99',
      priceCurrency: 'USD',
      shopID: '64233',
      type: 'purchase',
      version: '4',
    }),
    'ccaf2357fe330654322a1b0f3f92984b3fe2a1462d6fc5082650a00c5ada2f2a',
  );
  ok("signature matches Verotel's published example");

  const applied: Record<string, string>[] = [];
  (premiumService as any).applyVerotelEvent = async (p: Record<string, string>) => {
    applied.push(p);
    return { ok: true };
  };

  const app = express();
  app.use('/api/premium/webhook', premiumWebhookRoutes);
  // Same position as server.ts: a later JSON parser must not matter.
  app.use(express.json());
  const { server, port } = await listen(app);

  const initial = { event: 'initial', shopID: '123', saleID: '456', custom1: USER, priceAmount: '6.99', priceCurrency: 'GBP', type: 'subscription' };
  try {
    // Fail closed when the key is not configured, even with a "valid" signature.
    let r = await call(port, 'GET', qsOf(initial, sign(initial)));
    assert.strictEqual(r.status, 400);
    assert.match(r.text, /invalid_signature/);
    assert.strictEqual(applied.length, 0);
    ok('no VEROTEL_SIGNATURE_KEY: every call is rejected (400), nothing applied');

    process.env.VEROTEL_SIGNATURE_KEY = KEY;

    const unsigned: Record<string, string>[] = [
      { event: 'initial', custom1: USER },
      { event: 'rebill', custom1: USER },
      { event: 'expiry', custom1: USER },
      { event: 'credit', custom1: USER },
      { event: 'chargeback', custom1: USER },
      { eventType: 'newsale', userId: USER },
      { eventType: 'cancel', userId: USER },
    ];
    for (const p of unsigned) {
      for (const m of ['GET', 'POST'] as const) {
        r = m === 'GET' ? await call(port, 'GET', qsOf(p)) : await call(port, 'POST', '', qsOf(p));
        assert.strictEqual(r.status, 400, `${m} ${qsOf(p)}`);
        assert.match(r.text, /invalid_signature/);
      }
    }
    assert.strictEqual(applied.length, 0);
    ok('unsigned GET and POST postbacks are rejected (400), nothing applied');

    r = await call(port, 'GET', qsOf(initial, 'f'.repeat(64)));
    assert.strictEqual(r.status, 400);
    r = await call(port, 'GET', qsOf(initial, sign(initial, 'wrong-key')));
    assert.strictEqual(r.status, 400);
    r = await call(port, 'GET', qsOf({ ...initial, custom1: '00000000-0000-4000-8000-000000000002' }, sign(initial)));
    assert.strictEqual(r.status, 400, 'tampered user id');
    r = await call(port, 'GET', qsOf(initial, sign(initial, KEY, 'sha1')));
    assert.strictEqual(r.status, 400, 'old SHA-1 signatures are not accepted');
    r = await call(port, 'GET', `${qsOf(initial, sign(initial))}&custom1=${USER.replace(/1$/, '2')}`);
    assert.strictEqual(r.status, 400, 'duplicate keys are refused');
    assert.strictEqual(applied.length, 0);
    ok('bad, wrong-key, tampered, SHA-1 and duplicate-key signatures are rejected');

    r = await call(port, 'POST', '', JSON.stringify({ ...initial, signature: sign(initial) }), 'application/json');
    assert.strictEqual(r.status, 400);
    assert.strictEqual(applied.length, 0);
    ok('JSON bodies are never trusted');

    // Correctly signed: GET (how Verotel calls) and form POST both apply.
    r = await call(port, 'GET', qsOf(initial, sign(initial)));
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.text, 'OK');
    assert.strictEqual(applied.length, 1);
    assert.deepStrictEqual({ ...applied[0] }, initial, 'params passed on without the signature');
    const rebill = { event: 'rebill', shopID: '123', saleID: '456', custom1: USER, amount: '6.99', currency: 'GBP', nextChargeOn: '2026-11-10' };
    r = await call(port, 'POST', '', qsOf(rebill, sign(rebill)));
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.text, 'OK');
    assert.strictEqual(applied.length, 2);
    assert.strictEqual(applied[1].event, 'rebill');
    // Spaces / UTF-8 survive the raw-body check.
    const odd = { ...initial, description: 'MenRush Premium £6.99 & more' };
    r = await call(port, 'POST', '', qsOf(odd, sign(odd)));
    assert.strictEqual(r.status, 200);
    ok('correctly signed GET and form POST postbacks apply and answer "OK"');

    process.env.VEROTEL_SHOP_ID = '999';
    r = await call(port, 'GET', qsOf(initial, sign(initial)));
    assert.strictEqual(r.status, 400, 'other shop');
    process.env.VEROTEL_SHOP_ID = '123';
    r = await call(port, 'GET', qsOf(initial, sign(initial)));
    assert.strictEqual(r.status, 200);
    delete process.env.VEROTEL_SHOP_ID;
    ok('VEROTEL_SHOP_ID, when set, must match shopID');

    console.log(`premium-webhook: ${passed} passed`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
