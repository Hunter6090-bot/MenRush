// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { ipAddress } from '@vercel/functions/headers';
import middleware, { config } from '../../middleware';
import {
  CLIENT_IP_HEADER,
  EDGE_SECRET_HEADER,
  edgeSecretFromEnv,
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

  it('accepts one plain IP only', () => {
    expect(singleIpOrNull(VISITOR)).toBe(VISITOR);
    expect(singleIpOrNull(' 2001:db8::1 ')).toBe('2001:db8::1');
    expect(singleIpOrNull(undefined)).toBeNull();
    expect(singleIpOrNull('')).toBeNull();
    expect(singleIpOrNull('203.0.113.7, 198.51.100.1')).toBeNull();
    expect(singleIpOrNull('203.0.113.7 198.51.100.1')).toBeNull();
    expect(singleIpOrNull('unknown')).toBeNull();
    expect(singleIpOrNull('abcd')).toBeNull();
  });

  it('leaves the request alone without a secret and replaces client copies with one', () => {
    const h = new Headers({ [EDGE_SECRET_HEADER]: 'client-forged', [CLIENT_IP_HEADER]: '198.18.0.1', 'x-vercel-forwarded-for': '198.18.0.2' });
    expect(withEdgeSecret(h, null, VISITOR)).toBeNull();
    const out = withEdgeSecret(h, SECRET, VISITOR);
    expect(out?.get(EDGE_SECRET_HEADER)).toBe(SECRET);
    expect(out?.get(CLIENT_IP_HEADER)).toBe(VISITOR);
    expect(out?.has('x-vercel-forwarded-for')).toBe(false);
    expect(h.get(EDGE_SECRET_HEADER)).toBe('client-forged');
    const noIp = withEdgeSecret(h, SECRET, undefined);
    expect(noIp?.has(CLIENT_IP_HEADER)).toBe(false);
    expect(withEdgeSecret(h, SECRET, '198.18.0.3, 198.18.0.4')?.has(CLIENT_IP_HEADER)).toBe(false);
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
    // The override list is the full upstream header set: forged X-Vercel-Forwarded-For is not in it.
    expect(forwarded(res, 'x-vercel-forwarded-for')).toBeNull();
    expect(overridden(res)).not.toContain('x-vercel-forwarded-for');
    expect(overridden(res)).toEqual(expect.arrayContaining([EDGE_SECRET_HEADER, CLIENT_IP_HEADER, 'cookie']));
  });

  it('sends no client-ip header when ipAddress() has nothing', () => {
    process.env.EDGE_PROXY_SECRET = SECRET;
    const res = middleware(apiRequest(null));
    expect(forwarded(res, EDGE_SECRET_HEADER)).toBe(SECRET);
    expect(forwarded(res, CLIENT_IP_HEADER)).toBeNull();
    expect(overridden(res)).not.toContain(CLIENT_IP_HEADER);
    expect(overridden(res)).not.toContain('x-vercel-forwarded-for');
  });
});
