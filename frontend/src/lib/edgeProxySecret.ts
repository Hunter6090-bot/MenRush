/**
 * Shared secret that tells the backend an /api request really came through
 * our Vercel rewrite, plus the visitor IP Vercel itself saw (see middleware.ts
 * and backend/src/lib/clientIp.ts).
 *
 * Server-side only: read from EDGE_PROXY_SECRET in the Vercel Routing
 * Middleware. Never give it a VITE_ prefix, or Vite would bundle it into the
 * browser JS. No imports, so the backend checks can load this file too.
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

/**
 * One plain IPv4 or IPv6 address (hex digits, dots, colons), else null. A
 * list, a port, spaces or anything else is rejected; the backend does the
 * full validation and normalisation.
 */
export function singleIpOrNull(value: string | undefined | null): string | null {
  const ip = String(value ?? '').trim();
  if (ip.length < 2 || ip.length > 45) return null;
  if (!/^[0-9A-Fa-f.:]+$/.test(ip)) return null;
  if (!ip.includes('.') && !ip.includes(':')) return null;
  return ip;
}

/**
 * Request headers for the upstream /api call, or null when there is no
 * secret, meaning "leave the request exactly as it was".
 *
 * With a secret: client-sent X-MenRush-Edge-Secret, X-MenRush-Client-IP and
 * X-Vercel-Forwarded-For are removed, the secret is set, and
 * X-MenRush-Client-IP is set from `visitorIp` (Vercel's own X-Real-IP via
 * ipAddress()) only when it is one plain IP. No IP means no client-ip header.
 */
export function withEdgeSecret(headers: Headers, secret: string | null, visitorIp?: string | null): Headers | null {
  if (!secret) return null;
  const out = new Headers(headers);
  for (const name of STRIPPED_CLIENT_HEADERS) out.delete(name);
  out.set(EDGE_SECRET_HEADER, secret);
  const ip = singleIpOrNull(visitorIp);
  if (ip) out.set(CLIENT_IP_HEADER, ip);
  return out;
}
