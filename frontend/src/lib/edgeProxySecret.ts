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
