/**
 * Auth token hardening: session verification rejects purpose tokens.
 * No database. No member emails or secrets in output.
 *
 *   npx ts-node --transpile-only scripts/auth-token-hardening-checks.ts
 */
import assert from 'assert';
import { spawnSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import http from 'http';
import path from 'path';
import express from 'express';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'auth-token-hardening-checks-secret';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

import { resolveJwtSecret, isInsecureJwtSecretPlaceholder } from '../src/lib/jwtSecret';
import { authService } from '../src/services/auth.service';
import { authMiddleware } from '../src/middleware/auth';
import { authSessionService } from '../src/services/auth-session.service';

const MEMBER_ID = '00000000-0000-4000-8000-000000000001';
const AUTH_SRC = path.join(__dirname, '../src/services/auth.service.ts');
const JWT_SRC = path.join(__dirname, '../src/lib/jwtSecret.ts');
const SERVER_SRC = path.join(__dirname, '../src/server.ts');
const BOOT_SRC = path.join(__dirname, '../src/boot.ts');

function base64UrlEncode(input: Buffer | string): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf8');
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function signPayload(payload: Record<string, unknown>, secret = process.env.JWT_SECRET as string): string {
  const payloadJson = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', secret).update(payloadJson).digest();
  return `${base64UrlEncode(payloadJson)}.${base64UrlEncode(signature)}`;
}

function legacySessionToken(userId: string): string {
  return signPayload({
    userId,
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
  });
}

function purposeToken(userId: string, extra: Record<string, unknown>): string {
  return signPayload({
    userId,
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
    ...extra,
  });
}

function throwsInvalid(fn: () => unknown, label: string) {
  try {
    fn();
    assert.fail(`expected throw: ${label}`);
  } catch (err) {
    assert.ok(err instanceof Error, label);
    assert.notEqual(err.message, `expected throw: ${label}`, label);
  }
}

async function listen(app: express.Express): Promise<{ port: number; close: () => Promise<void> }> {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('no port');
  return {
    port: addr.port,
    close: () => new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  };
}

async function request(
  port: number,
  pathName: string,
  opts: { method?: string; token?: string; body?: unknown } = {},
): Promise<{ status: number }> {
  const method = opts.method || 'GET';
  const data = opts.body === undefined ? undefined : JSON.stringify(opts.body);
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path: pathName,
        method,
        headers: {
          ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
          ...(data
            ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
            : {}),
        },
      },
      (res) => {
        res.resume();
        resolve({ status: res.statusCode || 0 });
      },
    );
    req.on('error', reject);
    if (data) req.end(data);
    else req.end();
  });
}

function jwtSecretChecks() {
  const set = { JWT_SECRET: 'a-real-production-secret-value', NODE_ENV: 'production' };
  assert.equal(resolveJwtSecret(set), 'a-real-production-secret-value');
  assert.equal(
    resolveJwtSecret({ JWT_SECRET: 'dev-secret', NODE_ENV: 'development' }),
    'dev-secret',
  );
  assert.throws(() => resolveJwtSecret({ JWT_SECRET: '', NODE_ENV: 'production' }));
  assert.throws(() => resolveJwtSecret({ NODE_ENV: 'production' }));
  assert.throws(() => resolveJwtSecret({ JWT_SECRET: '', NODE_ENV: 'development' }));
  assert.throws(() => resolveJwtSecret({ JWT_SECRET: 'your-secret-key', NODE_ENV: 'production' }));
  assert.throws(() =>
    resolveJwtSecret({
      JWT_SECRET: 'your-secret-jwt-key-change-in-production',
      NODE_ENV: 'production',
    }),
  );
  assert.equal(
    resolveJwtSecret({ JWT_SECRET: 'your-secret-key', NODE_ENV: 'development' }),
    'your-secret-key',
    'placeholder still allowed outside production',
  );
  const withNewline = 'a-real-production-secret-value\n';
  assert.equal(
    resolveJwtSecret({ JWT_SECRET: withNewline, NODE_ENV: 'production' }),
    withNewline,
    'HMAC secret keeps a trailing newline',
  );
  assert.equal(
    resolveJwtSecret({ JWT_SECRET: '  kept-spaces  ', NODE_ENV: 'development' }),
    '  kept-spaces  ',
    'HMAC secret keeps surrounding spaces',
  );
  assert.throws(() =>
    resolveJwtSecret({ JWT_SECRET: 'your-secret-key\n', NODE_ENV: 'production' }),
  );
  assert.ok(isInsecureJwtSecretPlaceholder('your-secret-key'));
  assert.ok(!isInsecureJwtSecretPlaceholder('a-real-production-secret-value'));

  const src = [AUTH_SRC, JWT_SRC, SERVER_SRC, BOOT_SRC].map((file) => fs.readFileSync(file, 'utf8')).join('\n');
  assert.doesNotMatch(src, /JWT_SECRET\s*\|\|\s*['"]your-secret/);
  assert.doesNotMatch(src, /JWT_SECRET\s*\?\?\s*['"]your-secret/);
  assert.match(fs.readFileSync(BOOT_SRC, 'utf8'), /assertJwtSecret\(/);
  assert.match(fs.readFileSync(SERVER_SRC, 'utf8'), /assertJwtSecret\(/);
}

function verifyTokenChecks() {
  const session = authService.issueAccessToken(MEMBER_ID);
  assert.equal(authService.verifyToken(session).userId, MEMBER_ID, 'new session token');

  const legacy = legacySessionToken(MEMBER_ID);
  assert.equal(authService.verifyToken(legacy).userId, MEMBER_ID, 'legacy session token');

  const pending = authService.signTwoFactorPendingToken(MEMBER_ID);
  throwsInvalid(() => authService.verifyToken(pending), '2fa_pending as session');
  assert.equal(authService.verifyTwoFactorPendingToken(pending).userId, MEMBER_ID);

  throwsInvalid(
    () => authService.verifyTwoFactorPendingToken(session),
    'session as 2fa_pending',
  );
  throwsInvalid(
    () => authService.verifyTwoFactorPendingToken(legacy),
    'legacy session as 2fa_pending',
  );

  const handoff = authService.signHandoffToken('11111111-1111-4111-8111-111111111111', MEMBER_ID);
  throwsInvalid(() => authService.verifyToken(handoff), 'handoff as session');
  assert.equal(authService.verifyHandoffToken(handoff).userId, MEMBER_ID);

  throwsInvalid(
    () => authService.verifyToken(purposeToken(MEMBER_ID, { purpose: 'password_reset' })),
    'reset purpose as session',
  );
  throwsInvalid(
    () => authService.verifyToken(purposeToken(MEMBER_ID, { purpose: 'email_confirm' })),
    'confirm purpose as session',
  );
  throwsInvalid(
    () => authService.verifyToken(purposeToken(MEMBER_ID, { type: 'reset' })),
    'type reset as session',
  );
  throwsInvalid(
    () => authService.verifyToken(purposeToken(MEMBER_ID, { type: 'session', scope: '2fa_pending' })),
    'mixed session + pending',
  );
  throwsInvalid(
    () => authService.verifyToken(purposeToken(MEMBER_ID, { kind: 'reset' })),
    'kind reset as session',
  );
  throwsInvalid(
    () => authService.verifyToken(purposeToken(MEMBER_ID, { aud: 'menrush' })),
    'aud as session',
  );
  throwsInvalid(
    () => authService.verifyToken(purposeToken(MEMBER_ID, { scope: 'session' })),
    'scope session as session',
  );
  throwsInvalid(
    () => authService.verifyToken(purposeToken(MEMBER_ID, { typ: 'session' })),
    'typ session as session',
  );
  throwsInvalid(
    () => authService.verifyToken(purposeToken(MEMBER_ID, { extra: 'nope' })),
    'unknown claim as session',
  );

  const opaqueReset = crypto.randomBytes(32).toString('hex');
  const opaqueConfirm = crypto.randomBytes(32).toString('hex');
  throwsInvalid(() => authService.verifyToken(opaqueReset), 'opaque reset as session');
  throwsInvalid(() => authService.verifyToken(opaqueConfirm), 'opaque confirm as session');

  rawSecretNewlineRoundtrip();
}

function rawSecretNewlineRoundtrip() {
  const rawSecret = 'auth-token-hardening-newline-secret\n';
  assert.equal(
    resolveJwtSecret({ JWT_SECRET: rawSecret, NODE_ENV: 'production' }),
    rawSecret,
  );
  const token = signPayload(
    { userId: MEMBER_ID, exp: Math.floor(Date.now() / 1000) + 3600 },
    rawSecret,
  );
  const child = spawnSync(
    process.execPath,
    [
      '-r',
      'ts-node/register/transpile-only',
      '-e',
      `
        const { authService } = require(${JSON.stringify(path.join(__dirname, '../src/services/auth.service'))});
        const decoded = authService.verifyToken(process.env.CHECK_TOKEN);
        if (decoded.userId !== process.env.CHECK_USER) process.exit(2);
      `,
    ],
    {
      encoding: 'utf8',
      cwd: path.join(__dirname, '..'),
      env: {
        ...process.env,
        JWT_SECRET: rawSecret,
        CHECK_TOKEN: token,
        CHECK_USER: MEMBER_ID,
        TS_NODE_TRANSPILE_ONLY: '1',
      },
    },
  );
  assert.equal(child.status, 0, child.stderr || child.stdout || 'newline-secret verify');
}

async function httpAuthChecks() {
  const app = express();
  app.use(express.json());
  app.get('/api/users/me', authMiddleware, (req, res) => {
    res.json({ ok: true, id: (req as { userId?: string }).userId });
  });
  app.get('/api/auth/account', authMiddleware, (req, res) => {
    res.json({ ok: true, id: (req as { userId?: string }).userId });
  });

  const originalComplete = authService.completeTwoFactorLogin.bind(authService);
  const originalCreate = authSessionService.create.bind(authSessionService);
  authService.completeTwoFactorLogin = async (pendingToken, code) => {
    const { userId } = authService.verifyTwoFactorPendingToken(pendingToken);
    if (code !== '123456') throw new Error('Invalid authentication code');
    return {
      user: { id: userId },
      token: authService.issueAccessToken(userId),
    };
  };
  authSessionService.create = async () => 'r'.repeat(48);

  const { default: authRoutes } = await import('../src/routes/auth');
  app.use('/api/auth', authRoutes);

  const srv = await listen(app);
  try {
    const pending = authService.signTwoFactorPendingToken(MEMBER_ID);
    const session = authService.issueAccessToken(MEMBER_ID);
    const legacy = legacySessionToken(MEMBER_ID);
    const resetPurpose = purposeToken(MEMBER_ID, { purpose: 'password_reset' });
    const confirmPurpose = purposeToken(MEMBER_ID, { purpose: 'email_confirm' });
    const opaqueReset = crypto.randomBytes(32).toString('hex');
    const opaqueConfirm = crypto.randomBytes(32).toString('hex');

    assert.equal((await request(srv.port, '/api/users/me', { token: pending })).status, 401);
    assert.equal((await request(srv.port, '/api/auth/account', { token: pending })).status, 401);

    assert.equal((await request(srv.port, '/api/users/me', { token: resetPurpose })).status, 401);
    assert.equal((await request(srv.port, '/api/users/me', { token: confirmPurpose })).status, 401);
    assert.equal((await request(srv.port, '/api/users/me', { token: opaqueReset })).status, 401);
    assert.equal((await request(srv.port, '/api/users/me', { token: opaqueConfirm })).status, 401);

    assert.equal((await request(srv.port, '/api/users/me', { token: session })).status, 200);
    assert.equal((await request(srv.port, '/api/auth/account', { token: session })).status, 200);
    assert.equal((await request(srv.port, '/api/users/me', { token: legacy })).status, 200);
    assert.equal((await request(srv.port, '/api/auth/account', { token: legacy })).status, 200);

    assert.equal(
      (await request(srv.port, '/api/users/me', { token: purposeToken(MEMBER_ID, { kind: 'reset' }) }))
        .status,
      401,
    );
    assert.equal(
      (await request(srv.port, '/api/users/me', { token: purposeToken(MEMBER_ID, { aud: 'menrush' }) }))
        .status,
      401,
    );
    assert.equal(
      (await request(srv.port, '/api/users/me', { token: purposeToken(MEMBER_ID, { scope: 'session' }) }))
        .status,
      401,
    );
    assert.equal(
      (await request(srv.port, '/api/users/me', { token: purposeToken(MEMBER_ID, { typ: 'session' }) }))
        .status,
      401,
    );
    assert.equal(
      (await request(srv.port, '/api/users/me', { token: purposeToken(MEMBER_ID, { extra: 'nope' }) }))
        .status,
      401,
    );

    const verifyOk = await request(srv.port, '/api/auth/2fa/verify', {
      method: 'POST',
      body: { pendingToken: pending, code: '123456' },
    });
    assert.equal(verifyOk.status, 200, '2FA completion accepts pending token');

    const verifySession = await request(srv.port, '/api/auth/2fa/verify', {
      method: 'POST',
      body: { pendingToken: session, code: '123456' },
    });
    assert.equal(verifySession.status, 401, '2FA completion rejects session token');

    const verifyLegacy = await request(srv.port, '/api/auth/2fa/verify', {
      method: 'POST',
      body: { pendingToken: legacy, code: '123456' },
    });
    assert.equal(verifyLegacy.status, 401, '2FA completion rejects legacy session token');
  } finally {
    authService.completeTwoFactorLogin = originalComplete;
    authSessionService.create = originalCreate;
    await srv.close();
  }
}

function sourceGuards() {
  const auth = fs.readFileSync(AUTH_SRC, 'utf8');
  assert.match(auth, /type:\s*'session'/);
  assert.match(auth, /SESSION_TIME_KEYS/);
  assert.match(auth, /scope:\s*'2fa_pending'/);
  assert.match(auth, /verifyTwoFactorPendingToken/);
  assert.match(
    fs.readFileSync(path.join(__dirname, '../src/routes/auth.ts'), 'utf8'),
    /completeTwoFactorLogin\(data\.pendingToken/,
  );
}

async function main() {
  jwtSecretChecks();
  sourceGuards();
  verifyTokenChecks();
  await httpAuthChecks();
  console.log('auth-token-hardening-checks: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
