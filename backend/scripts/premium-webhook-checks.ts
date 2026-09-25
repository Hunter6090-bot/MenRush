/**
 * Unsigned POST /api/premium/webhook must not grant, renew, or revoke Premium.
 * The route is public and parses form bodies. Signature verification is not
 * wired, so every callback is rejected before any database write.
 */
import assert from 'assert';
import http from 'http';
import express from 'express';
import pool from '../src/db';
import premiumWebhookRoutes from '../src/routes/premium-webhook';

function listen(app: express.Express): Promise<{ server: http.Server; port: number }> {
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        throw new Error('expected a tcp port');
      }
      resolve({ server, port: address.port });
    });
  });
}

function post(
  port: number,
  contentType: string,
  body: string,
): Promise<{ status: number; json: { error?: string; ok?: boolean } }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: '/api/premium/webhook',
        method: 'POST',
        headers: {
          'Content-Type': contentType,
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          let json: { error?: string; ok?: boolean } = {};
          try {
            json = raw ? (JSON.parse(raw) as { error?: string; ok?: boolean }) : {};
          } catch {
            json = {};
          }
          resolve({ status: res.statusCode ?? 0, json });
        });
      },
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  const app = express();
  app.use('/api/premium/webhook', premiumWebhookRoutes);
  const { server, port } = await listen(app);

  try {
    const formCases = [
      'eventType=newsale&userId=00000000-0000-4000-8000-000000000001',
      'eventType=new_sale&userId=00000000-0000-4000-8000-000000000001&billedAmount=6.99',
      'eventType=renewal&userId=00000000-0000-4000-8000-000000000001',
      'eventType=cancel&userId=00000000-0000-4000-8000-000000000001',
      'eventType=expiration&userId=00000000-0000-4000-8000-000000000001',
      'eventType=chargeback&userId=00000000-0000-4000-8000-000000000001',
      'eventType=refund&custom1=00000000-0000-4000-8000-000000000001',
    ];

    for (const body of formCases) {
      const result = await post(port, 'application/x-www-form-urlencoded', body);
      assert.equal(result.status, 400, `form ${body} status`);
      assert.equal(result.json.error, 'invalid_signature', `form ${body} error`);
      assert.notEqual(result.json.ok, true, `form ${body} must not apply`);
    }

    const json = await post(
      port,
      'application/json',
      JSON.stringify({
        eventType: 'newsale',
        userId: '00000000-0000-4000-8000-000000000001',
      }),
    );
    assert.equal(json.status, 400);
    assert.equal(json.json.error, 'invalid_signature');
    assert.notEqual(json.json.ok, true);

    console.log(`premium webhook unsigned rejection checks passed (${formCases.length + 1}).`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
