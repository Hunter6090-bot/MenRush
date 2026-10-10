/**
 * Integration (real Postgres, real HTTP): what a member sees when their stored 2FA secret
 * cannot be read. Mounts the real /api/auth routes on a throwaway Express server.
 * - POST /api/auth/login never opens the secret: it still returns 200 with a pending token.
 * - POST /api/auth/2fa/verify returns 503 with the fixed support copy (never OpenSSL text,
 *   never a session token), for a wrong key and for a damaged stored value, whatever the code.
 * - The pending token is not used up by a 503: once the key is back, the same token and a
 *   fresh code sign the member in.
 * Keys are random per run; no member id, email, secret or key is printed.
 * Needs a migrated DATABASE_URL; skips without one.
 *   DATABASE_URL=postgresql://menrush:menrush@localhost:5432/menrush_ci npm run test:totp-verify-http-integration
 */
import assert from 'assert';
import http from 'http';
import crypto, { randomUUID } from 'crypto';
import bcryptjs from 'bcryptjs';
import { authenticator } from 'otplib';

if (!process.env.DATABASE_URL) {
  console.log('totp-verify-http-integration: SKIPPED (no DATABASE_URL)');
  process.exit(0);
}

process.env.JWT_SECRET ||= `test-jwt-${crypto.randomBytes(16).toString('hex')}`;
process.env.ADULT_ASSURANCE_SIGNUP_REQUIRED = 'false';
const ENROL_KEY = crypto.randomBytes(32).toString('base64');
const OTHER_KEY = crypto.randomBytes(32).toString('base64');
delete process.env.TOTP_ENCRYPTION_KEY_PREVIOUS;
delete process.env.TOTP_WRITE_FORMAT;

async function main() {
  const { default: express } = await import('express');
  const { default: pool, query } = await import('../src/db');
  const crypt = await import('../src/security/totp-crypto');
  const { default: authRoutes } = await import('../src/routes/auth');

  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('no port');

  async function post(pathName: string, body: unknown): Promise<{ status: number; json: Record<string, unknown> }> {
    const res = await fetch(`http://127.0.0.1:${addr && typeof addr !== 'string' ? addr.port : 0}${pathName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: res.status, json: (await res.json().catch(() => ({}))) as Record<string, unknown> };
  }

  function assertSupportCopy(res: { status: number; json: Record<string, unknown> }, label: string) {
    assert.equal(res.status, 503, `${label}: 503, not a wrong-code 401`);
    const text = String(res.json.error ?? '');
    assert.equal(text, crypt.TOTP_DECRYPT_FAILED_MESSAGE, `${label}: the fixed support copy`);
    assert.deepEqual(Object.keys(res.json), ['error'], `${label}: nothing but the copy`);
    assert.ok(text.includes('support@menrush.com'), `${label}: names the support inbox`);
    assert.ok(/problem on our side/.test(text), `${label}: says the fault is ours`);
    assert.ok(!/[\u2013\u2014]/.test(text), `${label}: no en or em dashes`);
    assert.ok(!/turn (2fa|two.factor) off|trusted device|beta/i.test(text), `${label}: no impossible steps`);
    assert.ok(!/unsupported state|unable to authenticate|openssl|bad decrypt|auth tag/i.test(text), `${label}: no crypto text`);
  }

  const password = `Totp-Http-${crypto.randomBytes(4).toString('hex')}9!`;
  const passwordHash = await bcryptjs.hash(password, 10);
  const members = { keyed: randomUUID(), damaged: randomUUID() };
  const secrets: Record<string, string> = {};
  const emails: Record<string, string> = {};

  try {
    process.env.TOTP_ENCRYPTION_KEY = ENROL_KEY;
    for (const [name, id] of Object.entries(members)) {
      secrets[id] = authenticator.generateSecret();
      emails[id] = `totp-http-${id.slice(0, 8)}@test.menrush.local`;
      await query(
        `INSERT INTO users (id, email, password_hash, name, age, email_confirmed,
                            totp_enabled, totp_secret_encrypted, totp_enabled_at,
                            is_verified, verification_status, verification_provider)
         VALUES ($1, $2, $3, $4, 30, TRUE, TRUE, $5, NOW(), TRUE, 'verified', 'veriff')`,
        [id, emails[id], passwordHash, `TOTP HTTP ${name}`, crypt.encryptTotpSecret(secrets[id])],
      );
    }
    // A damaged stored value (IV and tag the wrong length): rejected as format before any key.
    await query(`UPDATE users SET totp_secret_encrypted = 'v2:AAAA.BBBB.CCCC' WHERE id = $1`, [members.damaged]);

    // The key changes under the stored secret (as after a bad variable change): it no longer decrypts.
    process.env.TOTP_ENCRYPTION_KEY = OTHER_KEY;

    // 1. Login: password step only, the secret is not opened, so no 503 here.
    const login = await post('/api/auth/login', { email: emails[members.keyed], password });
    assert.equal(login.status, 200, 'login password step still works');
    assert.equal(login.json.requires2fa, true, '2FA still required');
    assert.ok(!login.json.token, 'no session before 2FA');
    const pendingToken = String(login.json.pendingToken);

    // 2. Verify: a right code and a wrong code both get the support copy (we cannot tell which).
    const right = await post('/api/auth/2fa/verify', { pendingToken, code: authenticator.generate(secrets[members.keyed]) });
    assertSupportCopy(right, 'wrong key, right code');
    const wrongCode = authenticator.generate(secrets[members.keyed]) === '000000' ? '111111' : '000000';
    assertSupportCopy(await post('/api/auth/2fa/verify', { pendingToken, code: wrongCode }), 'wrong key, wrong code');

    // 3. Damaged stored value through the same two routes.
    const loginDamaged = await post('/api/auth/login', { email: emails[members.damaged], password });
    assert.equal(loginDamaged.status, 200);
    assertSupportCopy(
      await post('/api/auth/2fa/verify', { pendingToken: String(loginDamaged.json.pendingToken), code: '123456' }),
      'damaged value',
    );

    // 4. Other failures keep the generic 401 (no change from #409).
    const junk = await post('/api/auth/2fa/verify', { pendingToken: 'not-a-token', code: '123456' });
    assert.equal(junk.status, 401);
    assert.equal(junk.json.error, 'Invalid code or token');

    // 5. Key back (as the previous key, the rotation-window state): the same pending token was
    //    not used up by the 503s, so "try again" really works.
    process.env.TOTP_ENCRYPTION_KEY_PREVIOUS = ENROL_KEY;
    const retry = await post('/api/auth/2fa/verify', { pendingToken, code: authenticator.generate(secrets[members.keyed]) });
    assert.equal(retry.status, 200, 'retry after the key is back signs in');
    assert.equal(typeof retry.json.token, 'string', 'session issued on retry');

    console.log('totp-verify-http-integration: PASS (login 200, verify 503 with support copy, retry 200)');
  } finally {
    await query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [Object.values(members)]).catch(() => undefined);
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.end();
  }
}

main().catch((err) => {
  console.error('totp-verify-http-integration: FAIL', err instanceof assert.AssertionError ? err.message : err);
  process.exit(1);
});
