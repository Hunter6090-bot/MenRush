/**
 * Vercel Routing Middleware (runs before the vercel.json rewrites).
 *
 * On /api requests, which vercel.json rewrites to the Railway backend:
 * - drop any client-sent X-MenRush-Edge-Secret, X-MenRush-Client-IP and
 *   X-Vercel-Forwarded-For (a client can forge them, and Vercel can pass a
 *   forged X-Vercel-Forwarded-For through);
 * - when ipAddress(request) is one valid IP, set X-MenRush-Edge-Secret and
 *   X-MenRush-Client-IP to it. ipAddress() in @vercel/functions reads the
 *   X-Real-IP header Vercel's proxy sets and overwrites. No IP, or an
 *   invalid or multi-value one, means no secret and no client-ip, so the
 *   backend keeps the X-Real-IP rule for that request.
 * The backend trusts X-MenRush-Client-IP only with a matching secret.
 *
 * The modified headers go upstream through next({ request: { headers } }),
 * which encodes them as x-middleware-request-* plus
 * x-middleware-override-headers; Vercel applies them to the request that the
 * vercel.json rewrite then proxies to Railway. next() lists only headers
 * that are present, so the override list is then rewritten to also name the
 * three stripped headers. A listed name with no x-middleware-request-* value
 * is deleted upstream, so a client copy cannot survive even on a platform
 * that keeps unlisted headers.
 *
 * If this middleware does not run for a request, no secret header is added,
 * so the backend ignores any X-MenRush-Client-IP on it and keeps the
 * X-Real-IP rule.
 *
 * Fail safe: when EDGE_PROXY_SECRET is unset (or shorter than 16 chars) in
 * Vercel, this returns nothing and the request continues untouched, exactly
 * as before this file existed. Never log the secret or any header.
 */
import { ipAddress } from '@vercel/functions/headers';
import { next } from '@vercel/functions/middleware';

// Everything this middleware needs lives in this one file on purpose. With
// runtime 'nodejs', Vercel transpiles each file on its own (no bundling) and
// runs the result as Node ESM ("type": "module"), where a relative import
// without a file extension fails with ERR_MODULE_NOT_FOUND and every /api
// request gets 500 MIDDLEWARE_INVOCATION_FAILED. So: no relative imports
// here. The only imports are the @vercel/functions package entry points,
// which Node resolves through the package exports map.
// scripts/check-middleware-artifact.mjs builds this file with `vercel build`
// and imports and calls the exact output under Node to keep it that way.

/**
 * Shared secret that tells the backend an /api request really came through
 * our Vercel rewrite, plus the visitor IP Vercel itself saw (see
 * backend/src/lib/clientIp.ts).
 *
 * Server-side only: read from EDGE_PROXY_SECRET here. Never give it a VITE_
 * prefix, or Vite would bundle it into the browser JS.
 */
export const EDGE_SECRET_HEADER = 'x-menrush-edge-secret';
/** Visitor IP set by the middleware from Vercel's own X-Real-IP. */
export const CLIENT_IP_HEADER = 'x-menrush-client-ip';
/**
 * Client-sent copies that must never reach the backend from /api. The
 * backend no longer reads X-Vercel-Forwarded-For, but it is dropped as well
 * because a client can forge it and Vercel can pass it through.
 */
export const STRIPPED_CLIENT_HEADERS = [EDGE_SECRET_HEADER, CLIENT_IP_HEADER, 'x-vercel-forwarded-for'] as const;
export const EDGE_SECRET_ENV = 'EDGE_PROXY_SECRET';
/** Same floor as the backend: anything shorter counts as unset. */
export const EDGE_SECRET_MIN_LENGTH = 16;

/** The configured secret, or null when unset or too short. */
export function edgeSecretFromEnv(value: string | undefined | null): string | null {
  const secret = String(value ?? '').trim();
  return secret.length >= EDGE_SECRET_MIN_LENGTH ? secret : null;
}

/** Response header that names every request header the upstream call gets. */
export const OVERRIDE_HEADERS_HEADER = 'x-middleware-override-headers';

const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

/**
 * One valid IPv4 or IPv6 address, else null. A list, a port, brackets, a
 * zone id, a short form like "1.2.3", spaces or anything else is rejected.
 * IPv6 is checked with the WHATWG URL parser (built in, no imports). The
 * backend still does its own validation and normalisation.
 */
export function singleIpOrNull(value: string | undefined | null): string | null {
  const ip = String(value ?? '').trim();
  if (ip.length < 2 || ip.length > 45) return null;
  if (IPV4.test(ip)) return ip;
  if (!ip.includes(':') || !/^[0-9A-Fa-f.:]+$/.test(ip)) return null;
  try {
    new URL(`http://[${ip}]/`);
    return ip;
  } catch {
    return null;
  }
}

/**
 * Request headers for the upstream /api call, or null when there is no
 * secret, meaning "leave the request exactly as it was".
 *
 * With a secret: client-sent X-MenRush-Edge-Secret, X-MenRush-Client-IP and
 * X-Vercel-Forwarded-For are always removed. The secret and
 * X-MenRush-Client-IP are set together, and only when `visitorIp` (Vercel's
 * own X-Real-IP via ipAddress()) is one valid IP. No IP, or an invalid or
 * multi-value one, means no secret and no client-ip: the backend then keys
 * on X-Real-IP exactly as it did before the secret existed.
 */
export function withEdgeSecret(headers: Headers, secret: string | null, visitorIp?: string | null): Headers | null {
  if (!secret) return null;
  const out = new Headers(headers);
  for (const name of STRIPPED_CLIENT_HEADERS) out.delete(name);
  const ip = singleIpOrNull(visitorIp);
  if (ip) {
    out.set(EDGE_SECRET_HEADER, secret);
    out.set(CLIENT_IP_HEADER, ip);
  }
  return out;
}

/**
 * Value for x-middleware-override-headers: every header in `headers` plus
 * the three stripped names, even when they are not set.
 *
 * In the override protocol a name that is listed with no matching
 * x-middleware-request-<name> value is deleted from the upstream request.
 * next() from @vercel/functions lists only the headers present in the
 * Headers object, so a stripped header would be absent from the list, and a
 * platform that keeps unlisted headers would pass the client's copy through.
 * Listing them here makes the deletion explicit.
 */
export function overrideHeaderList(headers: Headers): string {
  const names: string[] = [];
  headers.forEach((_value, name) => {
    if (!names.includes(name)) names.push(name);
  });
  for (const name of STRIPPED_CLIENT_HEADERS) if (!names.includes(name)) names.push(name);
  return names.join(',');
}

// Provided by the Vercel runtime; typed here because the frontend has no @types/node.
declare const process: { env: Record<string, string | undefined> };

// '/api/:path*' matches /api itself and every path below it (zero or more
// segments), the same paths the vercel.json /api rewrite sends to Railway.
// runtime 'nodejs': next() uses the same x-middleware-request-* header
// protocol on both runtimes, and this file only uses Web APIs. Node runs the
// per-file transpiled output unbundled, hence the single-file rule above.
export const config = {
  matcher: '/api/:path*',
  runtime: 'nodejs',
};

export default function middleware(request: Request): Response | undefined {
  const headers = withEdgeSecret(
    request.headers,
    edgeSecretFromEnv(process.env[EDGE_SECRET_ENV]),
    ipAddress(request),
  );
  if (!headers) return undefined;
  const res = next({ request: { headers } });
  res.headers.set(OVERRIDE_HEADERS_HEADER, overrideHeaderList(headers));
  return res;
}
