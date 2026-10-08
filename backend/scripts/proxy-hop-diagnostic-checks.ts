/**
 * Proxy-hop diagnostic checks. No network. No DB.
 *
 * Proves the TEMPORARY diagnostic:
 * - is off by default (flag unset / empty / "0" / "false" => null middleware);
 * - never logs an IP, a header value, a path or a token (known markers fed in,
 *   absent from every line);
 * - dedupes identical shapes and caps at maxLines, with one "cap reached" line;
 * - server.ts only mounts when proxyHopDiagnosticFromEnv() returns non-null;
 * - the helpers classify CGNAT / private correctly.
 */
import assert from 'assert';
import fs from 'fs';
import http from 'http';
import path from 'path';
import type { AddressInfo } from 'net';
import express from 'express';
import {
  PROXY_HOP_DIAG_DEFAULT_MAX_LINES,
  PROXY_HOP_DIAG_TAG,
  createProxyHopDiagnostic,
  isCgnat,
  isPrivateIp,
  isProxyHopDiagnosticEnabled,
  proxyHopDiagnosticFromEnv,
  proxyHopShape,
} from '../src/middleware/proxyHopDiagnostic';

const SERVER = path.join(__dirname, '../src/server.ts');
const MW = path.join(__dirname, '../src/middleware/proxyHopDiagnostic.ts');

const MARKERS = {
  clientIp: '203.0.113.77',
  vercelEgress: '76.76.21.21',
  railwayHop: '100.64.12.34',
  spoof: '198.51.100.9',
  ipv6Client: '2001:db8:85a3::8a2e:370:7334',
  vercelId: 'iad1::abc-vercel-id-xyz',
  vercelXff: '203.0.113.77, 76.76.21.21',
  path: '/api/users/u_real_user_id_abc',
  token: 'Bearer eyJhbGciOiJIUzI1NiJ9.payload.signature',
};

function allMarkers(): string[] {
  return Object.values(MARKERS);
}

function assertNoLeak(lines: string[], where: string) {
  const blob = lines.join('\n');
  for (const m of allMarkers()) {
    assert.ok(
      !blob.includes(m),
      `${where}: log must not contain marker ${JSON.stringify(m)}\n---\n${blob}\n---`,
    );
  }
  assert.doesNotMatch(blob, /\b\d{1,3}(?:\.\d{1,3}){3}\b/, `${where}: no IPv4 must appear`);
  assert.doesNotMatch(blob, /2001:db8/i, `${where}: no IPv6 marker must appear`);
  assert.doesNotMatch(blob, /Bearer\s+\S+/i, `${where}: no Authorization token must appear`);
  assert.doesNotMatch(blob, /\/api\/users\//, `${where}: no request path must appear`);
  for (const line of lines) {
    assert.ok(line.startsWith(PROXY_HOP_DIAG_TAG), `${where}: every line tagged: ${line}`);
  }
}

async function withServer(
  setup: (app: express.Express) => void,
  run: (port: number) => Promise<void>,
): Promise<void> {
  const app = express();
  setup(app);
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  try {
    await run(port);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
  }
}

function get(
  port: number,
  pathName: string,
  headers: Record<string, string> = {},
): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, path: pathName, method: 'GET', headers },
      (res) => {
        res.resume();
        resolve(res.statusCode || 0);
      },
    );
    req.on('error', reject);
    req.end();
  });
}

function flagOffByDefault() {
  assert.equal(isProxyHopDiagnosticEnabled({}), false);
  assert.equal(isProxyHopDiagnosticEnabled({ PROXY_HOP_DIAGNOSTIC: '' }), false);
  assert.equal(isProxyHopDiagnosticEnabled({ PROXY_HOP_DIAGNOSTIC: '0' }), false);
  assert.equal(isProxyHopDiagnosticEnabled({ PROXY_HOP_DIAGNOSTIC: 'false' }), false);
  assert.equal(isProxyHopDiagnosticEnabled({ PROXY_HOP_DIAGNOSTIC: 'no' }), false);
  assert.equal(isProxyHopDiagnosticEnabled({ PROXY_HOP_DIAGNOSTIC: '1' }), true);
  assert.equal(isProxyHopDiagnosticEnabled({ PROXY_HOP_DIAGNOSTIC: 'true' }), true);
  assert.equal(isProxyHopDiagnosticEnabled({ PROXY_HOP_DIAGNOSTIC: 'TRUE' }), true);

  const lines: string[] = [];
  assert.equal(
    proxyHopDiagnosticFromEnv({}),
    null,
    'unset flag must return null (nothing mounted)',
  );
  assert.equal(proxyHopDiagnosticFromEnv({ PROXY_HOP_DIAGNOSTIC: '0' }), null);
  const mw = proxyHopDiagnosticFromEnv(
    { PROXY_HOP_DIAGNOSTIC: '1' },
    { log: (l) => lines.push(l), maxLines: 3 },
  );
  assert.ok(mw, 'flag=1 must return a middleware');
  assert.ok(lines.some((l) => l.includes('enabled')));
  assertNoLeak(lines, 'enable banner');
}

function helperClassification() {
  assert.equal(isCgnat('100.64.0.1'), true);
  assert.equal(isCgnat('100.127.255.255'), true);
  assert.equal(isCgnat('100.63.255.255'), false);
  assert.equal(isCgnat('100.128.0.1'), false);
  assert.equal(isCgnat(MARKERS.clientIp), false);
  assert.equal(isPrivateIp('10.0.0.1'), true);
  assert.equal(isPrivateIp('192.168.1.1'), true);
  assert.equal(isPrivateIp('127.0.0.1'), true);
  assert.equal(isPrivateIp('172.16.0.1'), true);
  assert.equal(isPrivateIp('100.64.0.1'), false, 'CGNAT is not counted as private');
  assert.equal(isPrivateIp(MARKERS.clientIp), false);
  assert.equal(isPrivateIp('::1'), true);
  assert.equal(isPrivateIp('fd00::1'), true);
}

function pureShapeNoLeak() {
  const fakeReq = {
    ip: MARKERS.vercelEgress,
    headers: {
      'x-forwarded-for': `${MARKERS.spoof}, ${MARKERS.clientIp}, ${MARKERS.vercelEgress}`,
      'x-real-ip': MARKERS.clientIp,
      'x-vercel-id': MARKERS.vercelId,
      'x-vercel-forwarded-for': MARKERS.vercelXff,
      authorization: MARKERS.token,
      'x-proxy-diag-expect': MARKERS.clientIp,
    },
    socket: { remoteAddress: MARKERS.railwayHop },
    path: MARKERS.path,
    url: MARKERS.path,
    originalUrl: MARKERS.path,
  } as unknown as express.Request;

  const shape = proxyHopShape(fakeReq);
  assert.equal(shape.xff_count, 3);
  assert.equal(shape.has_x_real_ip, true);
  assert.equal(shape.req_ip_equals_x_real_ip, false);
  assert.equal(shape.req_ip_equals_xff_leftmost, false);
  assert.equal(shape.req_ip_equals_xff_rightmost, true);
  assert.equal(shape.x_real_ip_equals_xff_leftmost, false);
  assert.equal(shape.socket_peer_in_100_64, true);
  assert.equal(shape.socket_peer_is_private, false);
  assert.equal(shape.xff_leftmost_is_private, false);
  assert.equal(shape.xff_rightmost_in_100_64, false);
  assert.equal(shape.has_x_vercel_id, true);
  assert.equal(shape.has_x_vercel_forwarded_for, true);
  assert.equal(shape.req_ip_equals_vercel_ff_first, false);
  assert.equal(shape.xff_leftmost_equals_vercel_ff_first, false);
  assert.equal(shape.x_real_ip_equals_vercel_ff_first, true);
  assert.equal(shape.has_expect, true);
  assert.equal(shape.req_ip_equals_expect, false);
  assert.equal(shape.xff_leftmost_equals_expect, false);
  assert.equal(shape.xff_rightmost_equals_expect, false);
  assert.equal(shape.x_real_ip_equals_expect, true);
  assert.equal(shape.vercel_ff_first_equals_expect, true);

  const serial = JSON.stringify(shape);
  for (const m of allMarkers()) {
    assert.ok(!serial.includes(m), `shape JSON must not contain ${m}: ${serial}`);
  }
}

async function liveNoLeakAndDedupe() {
  const lines: string[] = [];
  const mw = createProxyHopDiagnostic({ log: (l) => lines.push(l), maxLines: 3 });

  await withServer(
    (app) => {
      app.set('trust proxy', 1);
      app.use(mw);
      app.get('/api/ping', (_req, res) => res.sendStatus(204));
      app.get(MARKERS.path, (_req, res) => res.sendStatus(204));
    },
    async (port) => {
      // Same shape three times: one line.
      for (let i = 0; i < 3; i += 1) {
        assert.equal(
          await get(port, '/api/ping', {
            'X-Forwarded-For': `${MARKERS.clientIp}, ${MARKERS.vercelEgress}`,
            'X-Real-IP': MARKERS.clientIp,
            'X-Vercel-Id': MARKERS.vercelId,
            'X-Vercel-Forwarded-For': MARKERS.vercelXff,
            Authorization: MARKERS.token,
            'X-Proxy-Diag-Expect': MARKERS.clientIp,
          }),
          204,
        );
      }
      assert.equal(lines.length, 1, `one shape => one line, got ${lines.length}`);
      assert.match(lines[0], /shape 1\/3/);
      assert.match(lines[0], /"has_x_vercel_id":true/);
      assert.match(lines[0], /"req_ip_equals_xff_rightmost":true/);
      assert.match(lines[0], /"xff_leftmost_equals_expect":true/);
      assert.match(lines[0], /"req_ip_equals_expect":false/);

      // Different XFF count: second shape.
      assert.equal(
        await get(port, MARKERS.path, {
          'X-Forwarded-For': `${MARKERS.spoof}, ${MARKERS.clientIp}, ${MARKERS.vercelEgress}`,
          'X-Real-IP': MARKERS.clientIp,
        }),
        204,
      );
      assert.equal(lines.length, 2);

      // No Vercel headers, no XFF: third shape (direct-ish).
      assert.equal(await get(port, '/api/ping'), 204);
      assert.equal(lines.length, 3);

      // Cap: a fourth distinct shape logs "cap reached" once and then silence.
      assert.equal(
        await get(port, '/api/ping', {
          'X-Forwarded-For': MARKERS.ipv6Client,
          'X-Real-IP': MARKERS.ipv6Client,
        }),
        204,
      );
      assert.equal(lines.length, 4);
      assert.match(lines[3], /cap reached \(3 shapes\)/);

      assert.equal(
        await get(port, '/api/ping', {
          'X-Forwarded-For': `${MARKERS.spoof}, ${MARKERS.ipv6Client}`,
        }),
        204,
      );
      assert.equal(lines.length, 4, 'after cap, no more lines');
    },
  );

  assertNoLeak(lines, 'live middleware');
  assert.ok(lines.every((l) => !/"ip"\s*:/.test(l)), 'no raw IP field keys');
}

function sourceGuards() {
  const serverSrc = fs.readFileSync(SERVER, 'utf8');
  assert.match(serverSrc, /proxyHopDiagnosticFromEnv/);
  assert.match(
    serverSrc,
    /const proxyHopDiagnostic = proxyHopDiagnosticFromEnv\(\);\s*\n\s*if \(proxyHopDiagnostic\) app\.use\(proxyHopDiagnostic\);/,
    'server.ts must only mount when the factory returns non-null',
  );
  assert.match(serverSrc, /TEMPORARY/, 'server.ts mount must be marked TEMPORARY');

  const mwSrc = fs.readFileSync(MW, 'utf8');
  assert.match(mwSrc, /TEMPORARY/);
  assert.match(mwSrc, /PROXY_HOP_DIAGNOSTIC/);
  assert.match(mwSrc, /Never an IP/);
  // The middleware itself must not console.log outside the injectable logger path
  // used by the factory banner / createProxyHopDiagnostic.
  assert.doesNotMatch(
    mwSrc.replace(/\/\/[^\n]*/g, ''),
    /console\.(log|info|warn|error)\([^)]*req\.(ip|headers|path)/,
    'must not log req.ip / headers / path directly',
  );
}

function defaultCapWithFakeRequests() {
  const lines: string[] = [];
  const mw = createProxyHopDiagnostic({ log: (l) => lines.push(l) });
  let nextCalls = 0;
  const next = () => {
    nextCalls += 1;
  };
  let sent = 0;
  // 11 xff counts x 8 header combos = 88 distinct shapes, each sent twice.
  for (let n = 0; n <= 10; n += 1) {
    for (let combo = 0; combo < 8; combo += 1) {
      const headers: Record<string, string> = {};
      if (n > 0) {
        headers['x-forwarded-for'] = Array.from({ length: n }, (_, i) => `203.0.113.${i + 1}`).join(', ');
      }
      if (combo & 1) headers['x-real-ip'] = MARKERS.clientIp;
      if (combo & 2) headers['x-vercel-id'] = MARKERS.vercelId;
      if (combo & 4) headers['x-vercel-forwarded-for'] = MARKERS.vercelXff;
      const fake = {
        ip: n > 0 ? `203.0.113.${n}` : MARKERS.railwayHop,
        headers,
        socket: { remoteAddress: MARKERS.railwayHop },
      } as unknown as express.Request;
      mw(fake, {} as express.Response, next);
      mw(fake, {} as express.Response, next);
      sent += 2;
    }
  }
  assert.equal(nextCalls, sent, 'next() must be called for every request');
  const shapeLines = lines.filter((l) => / shape \d+\/50 /.test(l));
  assert.equal(shapeLines.length, PROXY_HOP_DIAG_DEFAULT_MAX_LINES, `default cap 50, got ${shapeLines.length}`);
  assert.equal(lines.filter((l) => /cap reached \(50 shapes\)/.test(l)).length, 1);
  assert.equal(lines.length, 51, 'exactly 50 shapes + 1 cap line');
  assertNoLeak(lines, 'default cap');

  // A throwing request object still calls next() and logs nothing.
  const before = lines.length;
  const bad = { get headers(): never { throw new Error('boom'); } } as unknown as express.Request;
  const mw2 = createProxyHopDiagnostic({ log: (l) => lines.push(l) });
  let called = false;
  mw2(bad, {} as express.Response, () => {
    called = true;
  });
  assert.equal(called, true, 'diagnostic errors must not block the request');
  assert.equal(lines.length, before);
}

async function main() {
  assert.equal(PROXY_HOP_DIAG_DEFAULT_MAX_LINES, 50);
  flagOffByDefault();
  helperClassification();
  pureShapeNoLeak();
  sourceGuards();
  await liveNoLeakAndDedupe();
  defaultCapWithFakeRequests();
  console.log('proxy-hop-diagnostic-checks: ok (off by default, no IP leak, dedupe + cap)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
