/**
 * Rate-limit client IP key checks. No network beyond loopback. No DB.
 *
 * 1. Unit: normaliseIp / clientIp (X-Real-IP first value, trimmed, IPv6 and
 *    ::ffff: handling, fallback to req.ip when missing or invalid).
 * 2. Source: every rateLimit({...}) in src/routes uses keyGenerator:
 *    rateLimitKey, no route reads X-Forwarded-For for a key, and server.ts
 *    keeps `trust proxy` 1. Exception: email-unsubscribe success limiter
 *    (skipFailedRequests) keys by user+type so a shared Vercel egress IP
 *    cannot lock everyone out; its invalid-token fallback still uses
 *    rateLimitKey. The fail limiter on that route stays rateLimitKey.
 * 3. Behaviour over loopback with `trust proxy` 1 (as server.ts):
 *    - a rotated, spoofed client X-Forwarded-For does not change the key
 *    - users behind the same Railway hop get their own buckets
 *    - missing or invalid X-Real-IP falls back to req.ip and is still limited
 *    - no ERR_ERL_* validation errors are logged
 */
import assert from 'assert';
import fs from 'fs';
import http from 'http';
import path from 'path';
import express from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { clientIp, firstHeaderValue, normaliseIp, rateLimitKey } from '../src/lib/clientIp';

const ROUTES_DIR = path.join(__dirname, '../src/routes');
const SERVER = path.join(__dirname, '../src/server.ts');

// Capture express-rate-limit validation output (ERR_ERL_*).
const erlMessages: string[] = [];
for (const level of ['error', 'warn'] as const) {
  const orig = console[level].bind(console);
  console[level] = (...args: unknown[]) => {
    const text = args
      .map((a) => (a instanceof Error ? `${a.name} ${(a as any).code ?? ''} ${a.message}` : String(a)))
      .join(' ');
    if (/ERR_ERL_/.test(text)) erlMessages.push(text);
    orig(...args);
  };
}

function fakeReq(headers: Record<string, string | string[]>, ip?: string, remote?: string): express.Request {
  return { headers, ip, socket: { remoteAddress: remote } } as unknown as express.Request;
}

function unitChecks() {
  assert.equal(firstHeaderValue(undefined), '');
  assert.equal(firstHeaderValue(' 203.0.113.7 , 10.0.0.1'), '203.0.113.7');
  assert.equal(firstHeaderValue(['198.51.100.1, 10.0.0.1', '10.0.0.2']), '198.51.100.1');

  const cases: Array<[string | undefined, string]> = [
    ['203.0.113.7', '203.0.113.7'],
    ['  203.0.113.7  ', '203.0.113.7'],
    ['203.0.113.7:8080', '203.0.113.7'],
    ['::ffff:203.0.113.7', '203.0.113.7'],
    ['::FFFF:203.0.113.7', '203.0.113.7'],
    ['::ffff:cb00:7107', '203.0.113.7'],
    ['0:0:0:0:0:ffff:cb00:7107', '203.0.113.7'],
    ['[::ffff:203.0.113.7]:443', '203.0.113.7'],
    ['2001:DB8:0:0:0:0:0:1', '2001:db8::1'],
    ['[2001:db8::1]:443', '2001:db8::1'],
    ['[2001:db8::1]', '2001:db8::1'],
    ['fe80::1%eth0', 'fe80::1'],
    ['', ''],
    ['unknown', ''],
    ['999.1.1.1', ''],
    ['203.0.113', ''],
    ['1.2.3.4, 5.6.7.8', ''],
    [undefined, ''],
  ];
  for (const [input, want] of cases) {
    assert.equal(normaliseIp(input), want, `normaliseIp(${JSON.stringify(input)})`);
  }

  // X-Real-IP wins; X-Forwarded-For is never read.
  assert.equal(
    clientIp(fakeReq({ 'x-real-ip': '203.0.113.7', 'x-forwarded-for': '1.1.1.1, 100.64.0.2' }, '100.64.0.2')),
    '203.0.113.7',
  );
  assert.equal(clientIp(fakeReq({ 'x-real-ip': ' 203.0.113.7, 10.0.0.9' }, '100.64.0.2')), '203.0.113.7');
  assert.equal(clientIp(fakeReq({ 'x-real-ip': '::ffff:203.0.113.7' }, '100.64.0.2')), '203.0.113.7');
  // Fallbacks: missing, empty, invalid -> req.ip; then socket; then constant.
  assert.equal(clientIp(fakeReq({ 'x-forwarded-for': '1.1.1.1' }, '198.51.100.20')), '198.51.100.20');
  assert.equal(clientIp(fakeReq({ 'x-real-ip': '' }, '198.51.100.20')), '198.51.100.20');
  assert.equal(clientIp(fakeReq({ 'x-real-ip': 'not-an-ip' }, '198.51.100.20')), '198.51.100.20');
  assert.equal(clientIp(fakeReq({}, '::ffff:127.0.0.1')), '127.0.0.1');
  assert.equal(clientIp(fakeReq({}, undefined, '::1')), '::1');
  assert.equal(clientIp(fakeReq({})), '0.0.0.0');

  // Key: a spoofed XFF never changes it; IPv6 is bucketed by /56; mapped v4
  // does not collapse into the "::/56" bucket.
  const a = rateLimitKey(fakeReq({ 'x-real-ip': '203.0.113.7', 'x-forwarded-for': '10.0.0.1, 100.64.0.2' }, '100.64.0.2'));
  const b = rateLimitKey(fakeReq({ 'x-real-ip': '203.0.113.7', 'x-forwarded-for': '10.9.9.9, 100.64.0.2' }, '100.64.0.2'));
  assert.equal(a, b, 'spoofed X-Forwarded-For must not change the key');
  assert.equal(a, '203.0.113.7');
  assert.equal(
    rateLimitKey(fakeReq({ 'x-real-ip': '2001:db8:abcd:1200::1' })),
    rateLimitKey(fakeReq({ 'x-real-ip': '2001:db8:abcd:12ff::99' })),
    'same /56 shares a key',
  );
  assert.notEqual(
    rateLimitKey(fakeReq({ 'x-real-ip': '::ffff:203.0.113.7' })),
    rateLimitKey(fakeReq({ 'x-real-ip': '::ffff:198.51.100.1' })),
    'distinct IPv4-mapped clients must not share a bucket',
  );
  assert.equal(ipKeyGenerator('1.2.3.4'), '1.2.3.4');
}

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function sourceChecks() {
  const files = fs.readdirSync(ROUTES_DIR).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));
  let limiters = 0;
  for (const file of files) {
    const code = stripComments(fs.readFileSync(path.join(ROUTES_DIR, file), 'utf8'));
    const blocks = code.match(/rateLimit\(\{[\s\S]*?\}\);/g) || [];
    for (const block of blocks) {
      limiters += 1;
      const unsubSuccess =
        file === 'email-unsubscribe.ts' && /skipFailedRequests\s*:\s*true/.test(block);
      if (unsubSuccess) {
        assert.match(
          block,
          /email-unsub:\$\{payload\.userId\}:\$\{payload\.type\}/,
          `${file}: success limiter keys by user+type`,
        );
        assert.match(block, /rateLimitKey\(req\)/, `${file}: invalid-token fallback uses rateLimitKey`);
        assert.doesNotMatch(block, /x-forwarded-for/i, `${file}: success limiter must not read X-Forwarded-For`);
      } else {
        assert.match(block, /keyGenerator:\s*rateLimitKey\s*,/, `${file}: every limiter must use keyGenerator: rateLimitKey`);
      }
    }
    if (blocks.length) {
      assert.match(code, /import \{ rateLimitKey \} from '\.\.\/lib\/clientIp';/, `${file}: imports rateLimitKey`);
      assert.doesNotMatch(code, /x-forwarded-for/i, `${file}: must not read X-Forwarded-For`);
    }
  }
  assert.ok(limiters >= 19, `expected at least 19 route limiters, found ${limiters}`);
  const serverSrc = fs.readFileSync(SERVER, 'utf8');
  assert.match(serverSrc, /app\.set\('trust proxy',\s*1\)/, "server.ts must keep app.set('trust proxy', 1)");
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

function post(port: number, headers: Record<string, string>): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, path: '/hit', method: 'POST', headers: { 'Content-Length': 0, ...headers } },
      (res) => {
        res.resume();
        resolve(res.statusCode || 0);
      },
    );
    req.on('error', reject);
    req.end();
  });
}

/** Fresh app + limiter (max 5) per scenario so buckets never leak between them. */
async function withLimiter(fn: (port: number) => Promise<void>) {
  const app = express();
  app.set('trust proxy', 1); // same as server.ts
  const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    keyGenerator: rateLimitKey,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.post('/hit', limiter, (_req, res) => {
    res.sendStatus(200);
  });
  const srv = await listen(app);
  try {
    await fn(srv.port);
  } finally {
    await srv.close();
  }
}

const RAILWAY_HOP = '100.64.0.2';
const spoof = (i: number) => `10.${(i >> 8) & 255}.${i & 255}.${(i * 7) & 255}`;
const firstLimited = (codes: number[]) => codes.indexOf(429) + 1;

async function behaviourChecks() {
  // Spoofed client XFF rotated on every request: X-Real-IP is the key, so the
  // 6th request is limited.
  await withLimiter(async (port) => {
    const codes: number[] = [];
    for (let i = 0; i < 8; i += 1) {
      codes.push(await post(port, { 'X-Real-IP': '203.0.113.7', 'X-Forwarded-For': `${spoof(i)}, ${RAILWAY_HOP}` }));
    }
    assert.equal(firstLimited(codes), 6, `spoofed XFF must not reset the bucket: ${codes}`);
    assert.ok(codes.slice(5).every((c) => c === 429), `stays limited: ${codes}`);
  });

  // The #330 bug: two users behind the same Railway hop (same req.ip) must
  // not share a bucket.
  await withLimiter(async (port) => {
    const userA: number[] = [];
    for (let i = 0; i < 6; i += 1) {
      userA.push(await post(port, { 'X-Real-IP': '203.0.113.7', 'X-Forwarded-For': `203.0.113.7, ${RAILWAY_HOP}` }));
    }
    assert.equal(firstLimited(userA), 6, `user A limited on 6: ${userA}`);
    const userB = await post(port, { 'X-Real-IP': '198.51.100.1', 'X-Forwarded-For': `198.51.100.1, ${RAILWAY_HOP}` });
    assert.equal(userB, 200, 'user B behind the same hop gets its own bucket');
    const userAmapped = await post(port, { 'X-Real-IP': '::ffff:203.0.113.7', 'X-Forwarded-For': `x, ${RAILWAY_HOP}` });
    assert.equal(userAmapped, 429, 'IPv4-mapped spelling of user A shares A\'s bucket');
  });

  // Fallback: no X-Real-IP. req.ip (rightmost XFF with trust proxy 1) is the
  // key, so rotating the spoofed leftmost entry is still limited.
  await withLimiter(async (port) => {
    const codes: number[] = [];
    for (let i = 0; i < 7; i += 1) {
      codes.push(await post(port, { 'X-Forwarded-For': `${spoof(i)}, 198.51.100.20` }));
    }
    assert.equal(firstLimited(codes), 6, `missing X-Real-IP falls back to req.ip: ${codes}`);
    assert.equal(await post(port, { 'X-Forwarded-For': '1.1.1.1, 198.51.100.21' }), 200, 'other req.ip own bucket');
  });

  // Fallback: invalid X-Real-IP is ignored, req.ip is used.
  await withLimiter(async (port) => {
    const codes: number[] = [];
    for (let i = 0; i < 7; i += 1) {
      codes.push(await post(port, { 'X-Real-IP': `junk-${i}`, 'X-Forwarded-For': `${spoof(i)}, 198.51.100.30` }));
    }
    assert.equal(firstLimited(codes), 6, `invalid X-Real-IP falls back to req.ip: ${codes}`);
  });

  // No proxy headers at all: socket address (loopback) is the key.
  await withLimiter(async (port) => {
    const codes: number[] = [];
    for (let i = 0; i < 6; i += 1) codes.push(await post(port, {}));
    assert.equal(firstLimited(codes), 6, `direct request limited on 6: ${codes}`);
  });

  // IPv6 client rotating hosts inside one /56 shares a bucket.
  await withLimiter(async (port) => {
    const codes: number[] = [];
    for (let i = 1; i <= 7; i += 1) {
      codes.push(await post(port, { 'X-Real-IP': `2001:db8:abcd:12${i.toString(16).padStart(2, '0')}::${i}`, 'X-Forwarded-For': `x, ${RAILWAY_HOP}` }));
    }
    assert.equal(firstLimited(codes), 6, `IPv6 /56 shares a bucket: ${codes}`);
  });
}

async function main() {
  unitChecks();
  sourceChecks();
  await behaviourChecks();
  assert.deepEqual(erlMessages, [], `express-rate-limit validation errors logged: ${erlMessages.join(' | ')}`);
  console.log('rate-limit-client-ip-checks: ok (x-real-ip key, spoofed XFF ignored, req.ip fallback, ipv6)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
