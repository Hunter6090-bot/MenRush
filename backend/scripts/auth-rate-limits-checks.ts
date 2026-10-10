/**
 * Auth and signup rate limits. No network beyond loopback. No DB.
 *
 * Until the Vercel edge secret is set, web users share one bucket per Vercel
 * egress IP, so the per-IP ceilings must not lock a busy region out, while
 * account-keyed limiters keep brute-force protection meaningful.
 *
 * - ceilings: login / register / 2FA per IP >= 100 per 15 min, and every
 *   auth or signup IP ceiling is at least what it was before
 * - account limiters: failed sign-ins per email, wrong 2FA codes per verified
 *   account, reset / confirmation emails per address, account changes and
 *   Veriff sessions per user, poll per age-check session
 * - wiring in routes/auth.ts and routes/veriff.ts
 * - behaviour over loopback: the account limit holds across IPs, successes
 *   don't count, other accounts are unaffected, requests with no account
 *   key are skipped, forged 2FA tokens can't fill a user's bucket
 * - keys are hashed (no raw email or id)
 */
import assert from 'assert';
import fs from 'fs';
import http from 'http';
import path from 'path';
import express from 'express';
import {
  AUTH_LIMITS,
  AUTH_WINDOW_MS,
  NON_PRODUCTION_FLOOR,
  accountLimiter,
  authLimit,
  emailAccountKey,
  sessionParamKey,
  twoFactorAccountKey,
  userAccountKey,
} from '../src/lib/authRateLimits';

const AUTH_ROUTE = path.join(__dirname, '../src/routes/auth.ts');
const VERIFF_ROUTE = path.join(__dirname, '../src/routes/veriff.ts');

const erlMessages: string[] = [];
for (const level of ['error', 'warn'] as const) {
  const orig = console[level].bind(console);
  console[level] = (...args: unknown[]) => {
    const text = args.map((a) => String(a)).join(' ');
    if (/ERR_ERL_/.test(text)) erlMessages.push(text);
    orig(...args);
  };
}

// Production ceilings per 15 minutes before this change (main 9bedb2b).
const BEFORE: Record<string, number> = {
  login: 10,
  register: 10,
  twoFactorVerify: 10,
  refresh: 10,
  resetPassword: 10,
  forgotPassword: 5,
  confirmEmail: 20,
  resendConfirm: 5,
  adultAssurance: 12,
  adultAssurancePoll: 120,
};

function ceilingChecks() {
  assert.equal(AUTH_WINDOW_MS, 15 * 60 * 1000);
  for (const name of ['login', 'register', 'twoFactorVerify'] as const) {
    assert.ok(AUTH_LIMITS[name] >= 100, `${name} per-IP ceiling must be >= 100 / 15 min`);
  }
  for (const [name, before] of Object.entries(BEFORE)) {
    const now = AUTH_LIMITS[name as keyof typeof AUTH_LIMITS];
    assert.ok(now >= before, `${name}: never tighter than before (${before} -> ${now})`);
  }
  // Brute-force protection stays meaningful per account.
  assert.ok(AUTH_LIMITS.loginAccountFailures <= 20, 'failed sign-ins per email stay capped');
  assert.ok(AUTH_LIMITS.twoFactorAccountFailures <= 10, 'wrong 2FA codes per account stay capped');
  assert.ok(AUTH_LIMITS.forgotPasswordAccount <= 5, 'reset emails per address stay capped');
  assert.ok(AUTH_LIMITS.resendConfirmAccount <= 5, 'confirmation emails per address stay capped');
  assert.equal(AUTH_LIMITS.accountChange, 10, 'account changes per user unchanged at 10');
  assert.equal(AUTH_LIMITS.veriffSession, 8, 'Veriff sessions unchanged at 8, now per user');
  assert.ok(AUTH_LIMITS.adultAssurancePollSession >= 60, 'one full Register poll loop (60) fits a session');
  // Environment switch.
  assert.equal(authLimit('loginAccountFailures', { NODE_ENV: 'production' }), AUTH_LIMITS.loginAccountFailures);
  assert.equal(authLimit('loginAccountFailures', { NODE_ENV: 'development' }), NON_PRODUCTION_FLOOR);
  assert.equal(authLimit('refresh', {}), AUTH_LIMITS.refresh);
}

function keyChecks() {
  const req = (body: unknown, extra: Record<string, unknown> = {}) =>
    ({ body, params: {}, headers: {}, ...extra }) as unknown as express.Request;
  const a = emailAccountKey(req({ email: ' Pete@Example.com ' }));
  assert.ok(a && a.startsWith('email:'));
  assert.equal(a, emailAccountKey(req({ email: 'pete@example.com' })), 'email key is normalised');
  assert.notEqual(a, emailAccountKey(req({ email: 'other@example.com' })));
  assert.ok(!a!.includes('pete'), 'email key is hashed');
  assert.equal(emailAccountKey(req({})), null);
  assert.equal(emailAccountKey(req({ email: 42 })), null);
  assert.equal(emailAccountKey(req(undefined)), null);

  assert.equal(userAccountKey(req({})), null);
  const u = userAccountKey(req({}, { userId: 'user-123' }));
  assert.ok(u && u.startsWith('user:') && !u.includes('user-123'));

  assert.equal(sessionParamKey(req({}, { params: {} })), null);
  assert.ok(sessionParamKey(req({}, { params: { sessionId: 'abc' } }))?.startsWith('aa-session:'));

  const verify = (t: string) => {
    if (t === 'valid-token') return { userId: 'user-123' };
    throw new Error('Invalid token');
  };
  const k2 = twoFactorAccountKey(verify);
  assert.equal(k2(req({ pendingToken: 'valid-token' })), u, '2FA key is the verified user');
  assert.equal(k2(req({ pendingToken: 'forged' })), null, 'forged token gets no account key');
  assert.equal(k2(req({})), null);
}

function wiringChecks() {
  const src = fs.readFileSync(AUTH_ROUTE, 'utf8');
  const routes: Array<[string, string, string[]]> = [
    ['post', '/register', ['registerLimiter']],
    ['post', '/login', ['loginLimiter', 'loginAccountLimiter']],
    ['post', '/2fa/verify', ['twoFactorLimiter', 'twoFactorAccountLimiter']],
    ['post', '/refresh', ['refreshLimiter']],
    ['post', '/reset-password', ['resetPasswordLimiter']],
    ['post', '/forgot-password', ['forgotPasswordLimiter', 'forgotPasswordAccountLimiter']],
    ['post', '/confirm-email', ['confirmEmailLimiter']],
    ['post', '/resend-confirm', ['resendConfirmLimiter', 'resendConfirmAccountLimiter']],
    ['post', '/change-password', ['sessionAuthMiddleware', 'accountChangeLimiter']],
    ['post', '/change-email', ['authMiddleware', 'accountChangeLimiter']],
    ['post', '/delete-account', ['sessionAuthMiddleware', 'accountChangeLimiter']],
    ['get', '/adult-assurance/:sessionId', ['adultAssuranceStatusPollLimiter', 'adultAssurancePollSessionLimiter']],
  ];
  for (const [method, route, chain] of routes) {
    const re = new RegExp(
      `router\\.${method}\\(\\s*'${route.replace(/[/:]/g, (c) => `\\${c}`)}'\\s*,\\s*${chain.join('\\s*,\\s*')}\\s*,\\s*async`,
    );
    assert.match(src, re, `${method.toUpperCase()} ${route} uses ${chain.join(', ')}`);
  }
  assert.doesNotMatch(src, /\bauthLimiter\b/, 'the shared 10 / 15 min authLimiter is gone');
  assert.match(src, /key: emailAccountKey,[\s\S]*?failedOnly: true/, 'login account limiter counts failures only');
  assert.match(src, /twoFactorAccountKey\(\(token\) => authService\.verifyTwoFactorPendingToken\(token\)\)/);

  const veriff = fs.readFileSync(VERIFF_ROUTE, 'utf8');
  assert.match(veriff, /accountLimiter\(\{\s*max: authLimit\('veriffSession'\),\s*key: userAccountKey,/);
  assert.match(veriff, /'\/session',\s*authMiddleware,\s*sessionLimiter,/, 'Veriff session limiter runs after authMiddleware');
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

function postJson(port: number, pathName: string, body: unknown, realIp: string): Promise<number> {
  const data = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path: pathName,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), 'X-Real-IP': realIp },
      },
      (res) => {
        res.resume();
        resolve(res.statusCode || 0);
      },
    );
    req.on('error', reject);
    req.end(data);
  });
}

async function behaviourChecks() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  const loginAccount = accountLimiter({ max: 3, key: emailAccountKey, message: 'x', failedOnly: true });
  // Fake login: password "right" succeeds, anything else is a 401.
  app.post('/login', loginAccount, (req, res) => {
    res.sendStatus(req.body?.password === 'right' ? 200 : 401);
  });
  const k2 = twoFactorAccountKey((t) => {
    if (t.startsWith('valid:')) return { userId: t.slice(6) };
    throw new Error('Invalid token');
  });
  const twoFactorAccount = accountLimiter({ max: 3, key: k2, message: 'x', failedOnly: true });
  app.post('/2fa', twoFactorAccount, (req, res) => {
    res.sendStatus(req.body?.code === '123456' ? 200 : 401);
  });
  const srv = await listen(app);
  try {
    const p = srv.port;
    // Successes never use up the account budget.
    for (let i = 0; i < 6; i += 1) {
      assert.equal(await postJson(p, '/login', { email: 'pete@example.com', password: 'right' }, `203.0.113.${i + 1}`), 200);
    }
    // Failures from rotating IPs share the account bucket: 3 x 401, then 429.
    const codes: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      codes.push(await postJson(p, '/login', { email: 'Pete@Example.com', password: 'wrong' }, `198.51.100.${i + 1}`));
    }
    assert.deepEqual(codes, [401, 401, 401, 429, 429], `failed sign-ins per email hold across IPs: ${codes}`);
    // Another account behind the same IPs is unaffected.
    assert.equal(await postJson(p, '/login', { email: 'other@example.com', password: 'wrong' }, '198.51.100.1'), 401);
    // No email in the body: account limiter skipped (route still answers).
    for (let i = 0; i < 5; i += 1) assert.equal(await postJson(p, '/login', { password: 'wrong' }, '198.51.100.9'), 401);

    // 2FA: wrong codes per verified account hold across IPs.
    const tf: number[] = [];
    for (let i = 0; i < 5; i += 1) tf.push(await postJson(p, '/2fa', { pendingToken: 'valid:victim', code: '000000' }, `192.0.2.${i + 1}`));
    assert.deepEqual(tf, [401, 401, 401, 429, 429], `wrong 2FA codes per account hold across IPs: ${tf}`);
    // Forged tokens naming another user never fill that user's bucket.
    for (let i = 0; i < 6; i += 1) assert.equal(await postJson(p, '/2fa', { pendingToken: 'forged:bob', code: '000000' }, '192.0.2.50'), 401);
    assert.equal(await postJson(p, '/2fa', { pendingToken: 'valid:bob', code: '123456' }, '192.0.2.51'), 200, 'bob unaffected');
  } finally {
    await srv.close();
  }
}

async function main() {
  ceilingChecks();
  keyChecks();
  wiringChecks();
  await behaviourChecks();
  assert.deepEqual(erlMessages, [], `express-rate-limit validation errors logged: ${erlMessages.join(' | ')}`);
  console.log('auth-rate-limits-checks: ok (loose per-IP ceilings, account limits hold across IPs)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
