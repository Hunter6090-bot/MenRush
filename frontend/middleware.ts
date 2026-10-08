/**
 * Vercel Routing Middleware (runs before the vercel.json rewrites).
 *
 * On /api requests, which vercel.json rewrites to the Railway backend:
 * - drop any client-sent X-MenRush-Edge-Secret, X-MenRush-Client-IP and
 *   X-Vercel-Forwarded-For (a client can forge them, and Vercel can pass a
 *   forged X-Vercel-Forwarded-For through);
 * - set X-MenRush-Edge-Secret;
 * - set X-MenRush-Client-IP from ipAddress(request), which in
 *   @vercel/functions reads the X-Real-IP header Vercel's proxy sets and
 *   overwrites. No IP means no client-ip header.
 * The backend trusts X-MenRush-Client-IP only with a matching secret.
 *
 * The modified headers go upstream through next({ request: { headers } }),
 * which encodes them as x-middleware-request-* plus
 * x-middleware-override-headers; Vercel applies them to the request that the
 * vercel.json rewrite then proxies to Railway.
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
import { EDGE_SECRET_ENV, edgeSecretFromEnv, withEdgeSecret } from './src/lib/edgeProxySecret';

// Provided by the Vercel runtime; typed here because the frontend has no @types/node.
declare const process: { env: Record<string, string | undefined> };

// '/api/:path*' matches /api itself and every path below it (zero or more
// segments), the same paths the vercel.json /api rewrite sends to Railway.
// runtime 'nodejs' is Vercel's current recommendation (the default "edge"
// runtime is deprecated). next() uses the same x-middleware-request-* header
// protocol on both runtimes, and this file only uses Web APIs.
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
  return next({ request: { headers } });
}
