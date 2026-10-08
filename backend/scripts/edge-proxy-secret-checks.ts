/**
 * Vercel edge shared-secret checks for the rate-limit client IP.
 * No network beyond loopback. No DB.
 *
 * The first X-Vercel-Forwarded-For entry is used ONLY when EDGE_PROXY_SECRET
 * is set (16+ chars) and X-MenRush-Edge-Secret matches it. In every other
 * case the key is exactly what the X-Real-IP rule gives (PR #330).
 *
 * - secret unset (or too short): a forged X-Vercel-Forwarded-For is ignored,
 *   even when the request also sends a secret header
 * - secret mismatch (wrong value, wrong length, empty, missing): ignored
 * - secret match: visitor IP from the first X-Vercel-Forwarded-For entry;
 *   invalid entry falls back to the X-Real-IP rule
 * - clientIp.ts never logs
 * - frontend/middleware.ts and src/lib/edgeProxySecret.ts agree with the
 *   backend on header, env name and minimum length, only match /api, and
 *   never use a VITE_ (browser-bundled) env name
 */
import assert from 'assert';
import fs from 'fs';
import http from 'http';
import path from 'path';
import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  EDGE_SECRET_ENV,
  EDGE_SECRET_HEADER,
  clientIp,
  edgeSecretFromEnv,
  edgeSecretMatches,
  rateLimitKey,
} from '../src/lib/clientIp';
import * as backendEdge from '../src/lib/clientIp';
import ts from 'typescript';

const FRONTEND = path.join(__dirname, '../../frontend');

/**
 * frontend/ is an ES module package, so load its import-free helper by
 * transpiling it to CommonJS here. Only the exports below are used.
 */
type FrontendEdge = {
  EDGE_SECRET_HEADER: string;
  EDGE_SECRET_ENV: string;
  EDGE_SECRET_MIN_LENGTH: number;
  edgeSecretFromEnv: (value: string | undefined | null) => string | null;
  withEdgeSecret: (headers: Headers, secret: string | null) => Headers | null;
};
function loadFrontendEdge(): FrontendEdge {
  const src = fs.readFileSync(path.join(FRONTEND, 'src/lib/edgeProxySecret.ts'), 'utf8');
  assert.doesNotMatch(src, /^\s*import\s/m, 'edgeProxySecret.ts must stay import-free');
  const { outputText } = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
  const mod: { exports: Record<string, unknown> } = { exports: {} };
  new Function('exports', 'module', outputText)(mod.exports, mod);
  return mod.exports as unknown as FrontendEdge;
}
const frontendEdge = loadFrontendEdge();

const SECRET = 'test-edge-secret-0123456789abcdef';
const VERCEL_EGRESS = '76.76.21.9'; // what X-Real-IP holds behind the Vercel rewrite
const RAILWAY_HOP = '100.64.0.2';

const erlMessages: string[] = [];
for (const level of ['error', 'warn'] as const) {
  const orig = console[level].bind(console);
  console[level] = (...args: unknown[]) => {
    const text = args.map((a) => String(a)).join(' ');
    if (/ERR_ERL_/.test(text)) erlMessages.push(text);
    orig(...args);
  };
}

function fakeReq(headers: Record<string, string | string[]>, ip = RAILWAY_HOP): express.Request {
  return { headers, ip, socket: { remoteAddress: ip } } as unknown as express.Request;
}

const viaVercel = (visitor: string, secret?: string): Record<string, string> => ({
  'x-real-ip': VERCEL_EGRESS,
  'x-forwarded-for': `${VERCEL_EGRESS}, ${RAILWAY_HOP}`,
  'x-vercel-forwarded-for': visitor,
  ...(secret === undefined ? {} : { [EDGE_SECRET_HEADER]: secret }),
});

function unitChecks() {
  // Env parsing: unset, blank, short all count as unset.
  assert.equal(edgeSecretFromEnv({}), null);
  assert.equal(edgeSecretFromEnv({ [EDGE_SECRET_ENV]: '' }), null);
  assert.equal(edgeSecretFromEnv({ [EDGE_SECRET_ENV]: '   ' }), null);
  assert.equal(edgeSecretFromEnv({ [EDGE_SECRET_ENV]: 'short-secret' }), null);
  assert.equal(edgeSecretFromEnv({ [EDGE_SECRET_ENV]: ` ${SECRET} ` }), SECRET);

  // Compare: length-safe, never throws.
  assert.equal(edgeSecretMatches(SECRET, SECRET), true);
  assert.equal(edgeSecretMatches([SECRET], SECRET), true);
  assert.equal(edgeSecretMatches(SECRET, null), false);
  assert.equal(edgeSecretMatches(undefined, SECRET), false);
  assert.equal(edgeSecretMatches('', SECRET), false);
  assert.equal(edgeSecretMatches('x', SECRET), false);
  assert.equal(edgeSecretMatches(`${SECRET}x`, SECRET), false);
  assert.equal(edgeSecretMatches(SECRET.slice(0, -1) + 'X', SECRET), false);

  const unset: NodeJS.ProcessEnv = {};
  const short: NodeJS.ProcessEnv = { [EDGE_SECRET_ENV]: 'short' };
  const set: NodeJS.ProcessEnv = { [EDGE_SECRET_ENV]: SECRET };

  // Secret unset: identical to the X-Real-IP rule, forged visitor ignored.
  assert.equal(clientIp(fakeReq(viaVercel('203.0.113.7')), unset), VERCEL_EGRESS);
  assert.equal(clientIp(fakeReq(viaVercel('203.0.113.7', SECRET)), unset), VERCEL_EGRESS);
  assert.equal(clientIp(fakeReq(viaVercel('203.0.113.7', 'short')), short), VERCEL_EGRESS);
  assert.equal(clientIp(fakeReq({ 'x-vercel-forwarded-for': '203.0.113.7' }), unset), RAILWAY_HOP);

  // Secret set but mismatched or missing: forged visitor ignored.
  assert.equal(clientIp(fakeReq(viaVercel('203.0.113.7')), set), VERCEL_EGRESS);
  assert.equal(clientIp(fakeReq(viaVercel('203.0.113.7', 'wrong')), set), VERCEL_EGRESS);
  assert.equal(clientIp(fakeReq(viaVercel('203.0.113.7', SECRET.toUpperCase())), set), VERCEL_EGRESS);
  assert.equal(clientIp(fakeReq(viaVercel('203.0.113.7', '')), set), VERCEL_EGRESS);

  // Secret match: first X-Vercel-Forwarded-For entry, normalised.
  assert.equal(clientIp(fakeReq(viaVercel('203.0.113.7', SECRET)), set), '203.0.113.7');
  assert.equal(clientIp(fakeReq(viaVercel(' 203.0.113.7 , 198.51.100.1', SECRET)), set), '203.0.113.7');
  assert.equal(clientIp(fakeReq(viaVercel('::ffff:203.0.113.7', SECRET)), set), '203.0.113.7');
  assert.equal(clientIp(fakeReq(viaVercel('2001:DB8::1', SECRET)), set), '2001:db8::1');
  // Match but missing or invalid visitor: X-Real-IP rule.
  assert.equal(clientIp(fakeReq(viaVercel('not-an-ip', SECRET)), set), VERCEL_EGRESS);
  assert.equal(clientIp(fakeReq({ 'x-real-ip': VERCEL_EGRESS, [EDGE_SECRET_HEADER]: SECRET }), set), VERCEL_EGRESS);

  // Source: clientIp.ts never logs anything.
  const src = fs.readFileSync(path.join(__dirname, '../src/lib/clientIp.ts'), 'utf8');
  assert.doesNotMatch(src, /console\.|process\.stdout|process\.stderr/, 'clientIp.ts must not log');
  assert.match(src, /timingSafeEqual/, 'secret compare must be constant-time');
}

function frontendChecks() {
  assert.equal(frontendEdge.EDGE_SECRET_HEADER, backendEdge.EDGE_SECRET_HEADER, 'header name matches');
  assert.equal(frontendEdge.EDGE_SECRET_ENV, backendEdge.EDGE_SECRET_ENV, 'env name matches');
  assert.equal(frontendEdge.EDGE_SECRET_MIN_LENGTH, backendEdge.EDGE_SECRET_MIN_LENGTH, 'min length matches');
  assert.equal(frontendEdge.edgeSecretFromEnv(undefined), null);
  assert.equal(frontendEdge.edgeSecretFromEnv('short'), null);
  assert.equal(frontendEdge.withEdgeSecret(new Headers({ a: 'b' }), null), null, 'no secret: request untouched');
  const out = frontendEdge.withEdgeSecret(new Headers({ [EDGE_SECRET_HEADER]: 'client-forged' }), SECRET);
  assert.equal(out?.get(EDGE_SECRET_HEADER), SECRET, 'client copy overwritten');
  // What the middleware sends is accepted by the backend.
  assert.equal(edgeSecretMatches(out?.get(EDGE_SECRET_HEADER) ?? undefined, edgeSecretFromEnv({ [EDGE_SECRET_ENV]: SECRET })), true);

  const mw = fs.readFileSync(path.join(FRONTEND, 'middleware.ts'), 'utf8');
  assert.match(mw, /matcher:\s*'\/api\/:path\*'/, 'middleware only matches /api');
  assert.match(mw, /from '@vercel\/functions\/middleware'/, 'uses @vercel/functions next()');
  assert.match(mw, /if \(!headers\) return undefined;/, 'no secret: middleware returns nothing');
  assert.match(mw, /next\(\{ request: \{ headers \} \}\)/, 'forwards modified request headers');
  for (const f of [mw, fs.readFileSync(path.join(FRONTEND, 'src/lib/edgeProxySecret.ts'), 'utf8')]) {
    assert.doesNotMatch(f, /console\./, 'frontend edge code must not log');
    assert.doesNotMatch(f, /VITE_EDGE|import\.meta\.env/, 'secret must never be a VITE_ / browser env');
  }
  const vercel = JSON.parse(fs.readFileSync(path.join(FRONTEND, 'vercel.json'), 'utf8'));
  const apiRewrite = (vercel.rewrites || []).find((r: { source: string }) => r.source === '/api/:path*');
  assert.ok(apiRewrite && /^https:\/\/.+\.up\.railway\.app\/api\/:path\*$/.test(apiRewrite.destination), 'vercel.json still rewrites /api to Railway');
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

async function withLimiter(envSecret: string | undefined, fn: (port: number) => Promise<void>) {
  const prev = process.env[EDGE_SECRET_ENV];
  if (envSecret === undefined) delete process.env[EDGE_SECRET_ENV];
  else process.env[EDGE_SECRET_ENV] = envSecret;
  const app = express();
  app.set('trust proxy', 1);
  app.post('/hit', rateLimit({ windowMs: 60_000, max: 5, keyGenerator: rateLimitKey, standardHeaders: true, legacyHeaders: false }), (_req, res) => {
    res.sendStatus(200);
  });
  const srv = await listen(app);
  try {
    await fn(srv.port);
  } finally {
    await srv.close();
    if (prev === undefined) delete process.env[EDGE_SECRET_ENV];
    else process.env[EDGE_SECRET_ENV] = prev;
  }
}

const forged = (i: number) => `198.18.${(i >> 8) & 255}.${i & 255}`;
const firstLimited = (codes: number[]) => codes.indexOf(429) + 1;

async function behaviourChecks() {
  // Secret unset: rotating a forged X-Vercel-Forwarded-For (even with a
  // guessed secret header) never escapes the X-Real-IP bucket.
  await withLimiter(undefined, async (port) => {
    const codes: number[] = [];
    for (let i = 0; i < 7; i += 1) codes.push(await post(port, viaVercel(forged(i), SECRET)));
    assert.equal(firstLimited(codes), 6, `secret unset: forged visitor ignored: ${codes}`);
  });

  // Secret set, wrong header: same.
  await withLimiter(SECRET, async (port) => {
    const codes: number[] = [];
    for (let i = 0; i < 7; i += 1) codes.push(await post(port, viaVercel(forged(i), `wrong-${i}`)));
    assert.equal(firstLimited(codes), 6, `secret mismatch: forged visitor ignored: ${codes}`);
    const noHeader: number[] = [];
    for (let i = 0; i < 6; i += 1) noHeader.push(await post(port, { 'x-real-ip': '192.0.2.50', 'x-vercel-forwarded-for': forged(100 + i) }));
    assert.equal(firstLimited(noHeader), 6, `secret missing: forged visitor ignored: ${noHeader}`);
  });

  // Secret match: two visitors behind the same Vercel egress IP get separate
  // buckets, and one visitor is limited on request 6.
  await withLimiter(SECRET, async (port) => {
    const a: number[] = [];
    for (let i = 0; i < 6; i += 1) a.push(await post(port, viaVercel('203.0.113.7', SECRET)));
    assert.equal(firstLimited(a), 6, `secret match: visitor A limited on 6: ${a}`);
    assert.equal(await post(port, viaVercel('198.51.100.1', SECRET)), 200, 'visitor B behind same egress has own bucket');
  });
}

async function main() {
  unitChecks();
  frontendChecks();
  await behaviourChecks();
  assert.deepEqual(erlMessages, [], `express-rate-limit validation errors logged: ${erlMessages.join(' | ')}`);
  console.log('edge-proxy-secret-checks: ok (unset, mismatch, match, constant-time, no logs, frontend parity)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
