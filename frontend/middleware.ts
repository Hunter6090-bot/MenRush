/**
 * Vercel Routing Middleware (runs before the vercel.json rewrites).
 *
 * On /api requests, which vercel.json rewrites to the Railway backend, add
 * the X-MenRush-Edge-Secret request header so the backend can trust the
 * first X-Vercel-Forwarded-For entry (the real visitor) for rate-limit keys.
 *
 * Fail safe: when EDGE_PROXY_SECRET is unset (or shorter than 16 chars) in
 * Vercel, this returns nothing and the request continues untouched, exactly
 * as before this file existed. Never log the secret or any header.
 */
import { next } from '@vercel/functions/middleware';
import { EDGE_SECRET_ENV, edgeSecretFromEnv, withEdgeSecret } from './src/lib/edgeProxySecret';

// Provided by the Vercel runtime; typed here because the frontend has no @types/node.
declare const process: { env: Record<string, string | undefined> };

export const config = {
  matcher: '/api/:path*',
};

export default function middleware(request: Request): Response | undefined {
  const headers = withEdgeSecret(request.headers, edgeSecretFromEnv(process.env[EDGE_SECRET_ENV]));
  if (!headers) return undefined;
  return next({ request: { headers } });
}
