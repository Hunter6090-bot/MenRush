/**
 * Integration: 2FA login flow against real Postgres.
 * Pending tokens are refused on protected routes; a completed login is accepted.
 * Needs a migrated DATABASE_URL. Skips without one.
 * Does not print member ids, emails, tokens, or secrets.
 *
 *   DATABASE_URL=postgresql://menrush:menrush@localhost:5432/menrush_ci \
 *   npm run test:auth-token-hardening-integration
 */
import assert from 'assert';
import http from 'http';
import { randomUUID } from 'crypto';
import bcryptjs from 'bcryptjs';
import { authenticator } from 'otplib';

if (!process.env.DATABASE_URL) {
  console.log('auth-token-hardening-integration: SKIPPED (no DATABASE_URL)');
  process.exit(0);
}

process.env.JWT_SECRET ||= 'auth-token-hardening-integration-secret';
process.env.ADULT_ASSURANCE_SIGNUP_REQUIRED = 'false';

async function main() {
  const { default: express } = await import('express');
  const { default: pool, query } = await import('../src/db');
  const { authService } = await import('../src/services/auth.service');
  const { encryptTotpSecret } = await import('../src/security/totp-crypto');
  const { default: authRoutes } = await import('../src/routes/auth');
  const { default: userRoutes } = await import('../src/routes/users');

  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('no port');
  const port = addr.port;

  const userId = randomUUID();
  const password = 'TokenHardening9!';
  const totpSecret = authenticator.generateSecret();
  const email = `ath-${userId.slice(0, 8)}@test.invalid`;

  async function call(
    method: string,
    pathName: string,
    opts: { token?: string; body?: unknown } = {},
  ): Promise<{ status: number; json: Record<string, unknown> }> {
    const res = await fetch(`http://127.0.0.1:${port}${pathName}`, {
      method,
      headers: {
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
        ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { status: res.status, json };
  }

  try {
    const passwordHash = await bcryptjs.hash(password, 10);
    await query(
      `INSERT INTO users (
         id, email, password_hash, name, age, email_confirmed,
         totp_enabled, totp_secret_encrypted, totp_enabled_at,
         is_verified, verification_status, verification_provider
       ) VALUES (
         $1, $2, $3, 'Token Check', 30, TRUE,
         TRUE, $4, NOW(),
         TRUE, 'verified', 'veriff'
       )`,
      [userId, email, passwordHash, encryptTotpSecret(totpSecret)],
    );

    const login = await call('POST', '/api/auth/login', {
      body: { email, password },
    });
    assert.equal(login.status, 200, 'password step');
    assert.equal(login.json.requires2fa, true, '2FA required');
    assert.equal(typeof login.json.pendingToken, 'string');
    assert.ok(!login.json.token, 'no session token before 2FA');
    const pendingToken = login.json.pendingToken as string;

    const mePending = await call('GET', '/api/users/me', { token: pendingToken });
    assert.equal(mePending.status, 401, 'pending token refused on /users/me');
    const accountPending = await call('GET', '/api/auth/account', { token: pendingToken });
    assert.equal(accountPending.status, 401, 'pending token refused on /auth/account');

    const code = authenticator.generate(totpSecret);
    const verify = await call('POST', '/api/auth/2fa/verify', {
      body: { pendingToken, code },
    });
    assert.equal(verify.status, 200, '2FA completion');
    assert.equal(typeof verify.json.token, 'string', 'session token after 2FA');
    const sessionToken = verify.json.token as string;

    const replay = await call('POST', '/api/auth/2fa/verify', {
      body: { pendingToken, code },
    });
    assert.equal(replay.status, 401, 'pending token is single-use');
    assert.ok(!replay.json.token, 'replay does not issue a second session');

    const meSession = await call('GET', '/api/users/me', { token: sessionToken });
    assert.equal(meSession.status, 200, 'session token accepted on /users/me');
    const accountSession = await call('GET', '/api/auth/account', { token: sessionToken });
    assert.equal(accountSession.status, 200, 'session token accepted on /auth/account');

    const issued = authService.issueAccessToken(userId);
    assert.equal((await call('GET', '/api/users/me', { token: issued })).status, 200);

    const legacyPayload = {
      userId,
      exp: Math.floor(Date.now() / 1000) + 60 * 60,
    };
    const payloadJson = JSON.stringify(legacyPayload);
    const b64 = (value: Buffer | string) =>
      (Buffer.isBuffer(value) ? value : Buffer.from(value, 'utf8'))
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
    const { default: crypto } = await import('crypto');
    const legacy = `${b64(payloadJson)}.${b64(
      crypto.createHmac('sha256', process.env.JWT_SECRET as string).update(payloadJson).digest(),
    )}`;
    assert.equal((await call('GET', '/api/users/me', { token: legacy })).status, 200);
    assert.equal((await call('GET', '/api/auth/account', { token: legacy })).status, 200);

    console.log('auth-token-hardening-integration: ok');
  } finally {
    await query(`DELETE FROM users WHERE id = $1`, [userId]).catch(() => undefined);
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
    await pool.end().catch(() => undefined);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : 'integration failed');
  process.exit(1);
});
