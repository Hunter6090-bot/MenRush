// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { ipAddress } from '@vercel/functions/headers';
import middleware, { config } from '../../middleware';
import {
  CLIENT_IP_HEADER,
  EDGE_SECRET_HEADER,
  STRIPPED_CLIENT_HEADERS,
  edgeSecretFromEnv,
  overrideHeaderList,
  singleIpOrNull,
  withEdgeSecret,
} from './edgeProxySecret';

const SECRET = 'test-edge-secret-0123456789abcdef';
const VISITOR = '203.0.113.7';
/** What reaches the middleware: Vercel's own x-real-ip plus client forgeries. */
const apiRequest = (realIp: string | null = VISITOR) =>
  new Request('https://menrush.com/api/auth/me', {
    headers: {
      ...(realIp === null ? {} : { 'x-real-ip': realIp }),
      [EDGE_SECRET_HEADER]: 'client-forged',
      [CLIENT_IP_HEADER]: '198.18.0.1',
      'x-vercel-forwarded-for': '198.18.0.2',
      cookie: 'a=b',
    },
  });
const overridden = (res: Response | undefined) =>
  (res?.headers.get('x-middleware-override-headers') ?? '').split(',').filter(Boolean);
const forwarded = (res: Response | undefined, name: string) => res?.headers.get(`x-middleware-request-${name}`) ?? null;

describe('edgeProxySecret helpers', () => {
  it('treats unset, blank and short secrets as unset', () => {
    expect(edgeSecretFromEnv(undefined)).toBeNull();
    expect(edgeSecretFromEnv('')).toBeNull();
    expect(edgeSecretFromEnv('   ')).toBeNull();
    expect(edgeSecretFromEnv('short-secret')).toBeNull();
    expect(edgeSecretFromEnv(` ${SECRET} `)).toBe(SECRET);
  });

  it('accepts one valid IP only', () => {
    expect(singleIpOrNull(VISITOR)).toBe(VISITOR);
    expect(singleIpOrNull(' 203.0.113.7 ')).toBe(VISITOR);
    expect(singleIpOrNull(' 2001:db8::1 ')).toBe('2001:db8::1');
    expect(singleIpOrNull('2001:DB8:85A3:00ff::9')).toBe('2001:DB8:85A3:00ff::9');
    expect(singleIpOrNull('::ffff:203.0.113.7')).toBe('::ffff:203.0.113.7');
    expect(singleIpOrNull(undefined)).toBeNull();
    expect(singleIpOrNull(null)).toBeNull();
    expect(singleIpOrNull('')).toBeNull();
    expect(singleIpOrNull('203.0.113.7, 198.51.100.1')).toBeNull();
    expect(singleIpOrNull('203.0.113.7,198.51.100.1')).toBeNull();
    expect(singleIpOrNull('203.0.113.7 198.51.100.1')).toBeNull();
    expect(singleIpOrNull('unknown')).toBeNull();
    expect(singleIpOrNull('abcd')).toBeNull();
    expect(singleIpOrNull('1.2.3')).toBeNull();
    expect(singleIpOrNull('999.1.1.1')).toBeNull();
    expect(singleIpOrNull('01.2.3.4')).toBeNull();
    expect(singleIpOrNull('203.0.113.7:443')).toBeNull();
    expect(singleIpOrNull('[2001:db8::1]:443')).toBeNull();
    expect(singleIpOrNull('fe80::1%eth0')).toBeNull();
    expect(singleIpOrNull('1:2:3')).toBeNull();
    expect(singleIpOrNull('2001:db8::1::2')).toBeNull();
    expect(singleIpOrNull('1'.repeat(4000))).toBeNull();
  });

  it('always lists the three stripped names in the override list', () => {
    const list = overrideHeaderList(new Headers({ cookie: 'a=b', 'X-Other': '1' })).split(',');
    expect(list).toEqual(['cookie', 'x-other', EDGE_SECRET_HEADER, CLIENT_IP_HEADER, 'x-vercel-forwarded-for']);
    const withSet = overrideHeaderList(new Headers({ [EDGE_SECRET_HEADER]: 's', [CLIENT_IP_HEADER]: VISITOR })).split(',');
    expect(withSet).toEqual([CLIENT_IP_HEADER, EDGE_SECRET_HEADER, 'x-vercel-forwarded-for']);
    expect(overrideHeaderList(new Headers()).split(',')).toEqual([...STRIPPED_CLIENT_HEADERS]);
  });

  it('leaves the request alone without a secret and replaces client copies with one', () => {
    const h = new Headers({ [EDGE_SECRET_HEADER]: 'client-forged', [CLIENT_IP_HEADER]: '198.18.0.1', 'x-vercel-forwarded-for': '198.18.0.2' });
    expect(withEdgeSecret(h, null, VISITOR)).toBeNull();
    const out = withEdgeSecret(h, SECRET, VISITOR);
    expect(out?.get(EDGE_SECRET_HEADER)).toBe(SECRET);
    expect(out?.get(CLIENT_IP_HEADER)).toBe(VISITOR);
    expect(out?.has('x-vercel-forwarded-for')).toBe(false);
    expect(h.get(EDGE_SECRET_HEADER)).toBe('client-forged');
    for (const bad of [undefined, null, '', 'unknown', '198.18.0.3, 198.18.0.4', '1.2.3', '203.0.113.7:443', 'fe80::1%eth0']) {
      const noIp = withEdgeSecret(h, SECRET, bad);
      expect(noIp, String(bad)).toBeInstanceOf(Headers);
      expect(noIp?.has(EDGE_SECRET_HEADER), String(bad)).toBe(false);
      expect(noIp?.has(CLIENT_IP_HEADER), String(bad)).toBe(false);
      expect(noIp?.has('x-vercel-forwarded-for'), String(bad)).toBe(false);
    }
  });
});

describe('Vercel middleware', () => {
  const prev = process.env.EDGE_PROXY_SECRET;
  afterEach(() => {
    if (prev === undefined) delete process.env.EDGE_PROXY_SECRET;
    else process.env.EDGE_PROXY_SECRET = prev;
  });

  it('matches /api and everything below it, on the Node.js runtime', () => {
    expect(config.matcher).toBe('/api/:path*');
    expect(config.runtime).toBe('nodejs');
  });

  it('ipAddress() reads the x-real-ip header Vercel sets', () => {
    expect(ipAddress(apiRequest())).toBe(VISITOR);
    expect(ipAddress(apiRequest(null))).toBeUndefined();
  });

  it('does nothing when EDGE_PROXY_SECRET is unset or too short', () => {
    delete process.env.EDGE_PROXY_SECRET;
    expect(middleware(apiRequest())).toBeUndefined();
    process.env.EDGE_PROXY_SECRET = 'short';
    expect(middleware(apiRequest())).toBeUndefined();
  });

  it('forwards the secret and the ipAddress() IP, and drops client-sent copies', () => {
    process.env.EDGE_PROXY_SECRET = SECRET;
    const res = middleware(apiRequest());
    expect(res).toBeInstanceOf(Response);
    expect(res?.headers.get('x-middleware-next')).toBe('1');
    expect(forwarded(res, EDGE_SECRET_HEADER)).toBe(SECRET);
    expect(forwarded(res, CLIENT_IP_HEADER)).toBe(VISITOR);
    expect(forwarded(res, 'cookie')).toBe('a=b');
    // Forged X-Vercel-Forwarded-For is listed with no value, which deletes it upstream.
    expect(forwarded(res, 'x-vercel-forwarded-for')).toBeNull();
    expect(overridden(res)).toEqual(expect.arrayContaining([EDGE_SECRET_HEADER, CLIENT_IP_HEADER, 'x-vercel-forwarded-for', 'cookie']));
    expect(new Set(overridden(res)).size).toBe(overridden(res).length);
  });

  it('with no ipAddress() IP sends no secret and lists the client copies as deleted', () => {
    process.env.EDGE_PROXY_SECRET = SECRET;
    const res = middleware(apiRequest(null));
    expect(res).toBeInstanceOf(Response);
    expect(res?.headers.get('x-middleware-next')).toBe('1');
    // Nothing forged is forwarded: no value for any of the three names...
    expect(forwarded(res, EDGE_SECRET_HEADER)).toBeNull();
    expect(forwarded(res, CLIENT_IP_HEADER)).toBeNull();
    expect(forwarded(res, 'x-vercel-forwarded-for')).toBeNull();
    // ...and all three are listed, so the client copies are deleted upstream.
    expect(overridden(res)).toEqual(expect.arrayContaining([...STRIPPED_CLIENT_HEADERS, 'cookie']));
    expect(forwarded(res, 'cookie')).toBe('a=b');
  });

  it('with an invalid or multi-value IP sends no secret and no client-ip', () => {
    process.env.EDGE_PROXY_SECRET = SECRET;
    for (const bad of ['', 'unknown', '203.0.113.7, 198.51.100.1', '203.0.113.7:443', '1.2.3']) {
      const res = middleware(apiRequest(bad));
      expect(forwarded(res, EDGE_SECRET_HEADER), bad).toBeNull();
      expect(forwarded(res, CLIENT_IP_HEADER), bad).toBeNull();
      expect(overridden(res), bad).toEqual(expect.arrayContaining([...STRIPPED_CLIENT_HEADERS]));
    }
  });

  it('20 rotating forged client-ips with no IP never forward a client-ip or the secret', () => {
    process.env.EDGE_PROXY_SECRET = SECRET;
    const seen = new Set<string | null>();
    for (let i = 0; i < 20; i += 1) {
      const req = new Request('https://menrush.com/api/auth/me', { headers: { [CLIENT_IP_HEADER]: `198.18.1.${i}`, [EDGE_SECRET_HEADER]: `guess-${i}` } });
      const res = middleware(req);
      seen.add(forwarded(res, CLIENT_IP_HEADER));
      expect(forwarded(res, EDGE_SECRET_HEADER)).toBeNull();
      expect(overridden(res)).toContain(CLIENT_IP_HEADER);
    }
    expect([...seen]).toEqual([null]);
  });
});
