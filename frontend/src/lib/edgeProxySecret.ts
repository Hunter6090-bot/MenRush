/**
 * Shared secret that tells the backend an /api request really came through
 * our Vercel rewrite (see middleware.ts and backend/src/lib/clientIp.ts).
 *
 * Server-side only: read from EDGE_PROXY_SECRET in the Vercel Routing
 * Middleware. Never give it a VITE_ prefix, or Vite would bundle it into the
 * browser JS. No imports, so the backend checks can load this file too.
 */
export const EDGE_SECRET_HEADER = 'x-menrush-edge-secret';
export const EDGE_SECRET_ENV = 'EDGE_PROXY_SECRET';
/** Same floor as the backend: anything shorter counts as unset. */
export const EDGE_SECRET_MIN_LENGTH = 16;

/** The configured secret, or null when unset or too short. */
export function edgeSecretFromEnv(value: string | undefined | null): string | null {
  const secret = String(value ?? '').trim();
  return secret.length >= EDGE_SECRET_MIN_LENGTH ? secret : null;
}

/**
 * Request headers for the upstream /api call with the secret set (any client
 * copy is overwritten), or null when there is no secret, meaning "leave the
 * request exactly as it was".
 */
export function withEdgeSecret(headers: Headers, secret: string | null): Headers | null {
  if (!secret) return null;
  const out = new Headers(headers);
  out.set(EDGE_SECRET_HEADER, secret);
  return out;
}
