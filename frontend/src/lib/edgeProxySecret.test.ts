// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import middleware, { config } from '../../middleware';
import { EDGE_SECRET_HEADER, edgeSecretFromEnv, withEdgeSecret } from './edgeProxySecret';

const SECRET = 'test-edge-secret-0123456789abcdef';
const apiRequest = () =>
  new Request('https://menrush.com/api/auth/me', {
    headers: { [EDGE_SECRET_HEADER]: 'client-forged', cookie: 'a=b' },
  });

describe('edgeProxySecret helpers', () => {
  it('treats unset, blank and short secrets as unset', () => {
    expect(edgeSecretFromEnv(undefined)).toBeNull();
    expect(edgeSecretFromEnv('')).toBeNull();
    expect(edgeSecretFromEnv('   ')).toBeNull();
    expect(edgeSecretFromEnv('short-secret')).toBeNull();
    expect(edgeSecretFromEnv(` ${SECRET} `)).toBe(SECRET);
  });

  it('leaves the request alone without a secret and overwrites client copies with one', () => {
    const h = new Headers({ [EDGE_SECRET_HEADER]: 'client-forged' });
    expect(withEdgeSecret(h, null)).toBeNull();
    const out = withEdgeSecret(h, SECRET);
    expect(out?.get(EDGE_SECRET_HEADER)).toBe(SECRET);
    expect(h.get(EDGE_SECRET_HEADER)).toBe('client-forged');
  });
});

describe('Vercel middleware', () => {
  const prev = process.env.EDGE_PROXY_SECRET;
  afterEach(() => {
    if (prev === undefined) delete process.env.EDGE_PROXY_SECRET;
    else process.env.EDGE_PROXY_SECRET = prev;
  });

  it('only matches /api', () => {
    expect(config.matcher).toBe('/api/:path*');
  });

  it('does nothing when EDGE_PROXY_SECRET is unset or too short', () => {
    delete process.env.EDGE_PROXY_SECRET;
    expect(middleware(apiRequest())).toBeUndefined();
    process.env.EDGE_PROXY_SECRET = 'short';
    expect(middleware(apiRequest())).toBeUndefined();
  });

  it('adds the secret request header and keeps the others when set', () => {
    process.env.EDGE_PROXY_SECRET = SECRET;
    const res = middleware(apiRequest());
    expect(res).toBeInstanceOf(Response);
    expect(res?.headers.get('x-middleware-next')).toBe('1');
    expect(res?.headers.get(`x-middleware-request-${EDGE_SECRET_HEADER}`)).toBe(SECRET);
    expect(res?.headers.get('x-middleware-request-cookie')).toBe('a=b');
  });
});
