/**
 * Client IP for rate-limit keys.
 *
 * Production path: browser -> (Vercel /api rewrite) -> Railway edge -> backend.
 * Every request reaches us with two X-Forwarded-For entries and a socket peer
 * in 100.64/10. With `trust proxy` 1, req.ip is the RIGHTMOST entry, which is
 * a Railway edge hop, so every user shared one bucket.
 *
 * Railway's edge sets X-Real-IP to the address that connected to it and
 * overwrites anything the client sent, so it cannot be spoofed by adding
 * headers. It equals the leftmost X-Forwarded-For entry Railway writes (the
 * same address `trust proxy` 2 would give). Through the Vercel rewrite it is
 * Vercel's outbound IP rather than the visitor; that is still never worse
 * than the old shared bucket.
 *
 * We never read the client-supplied X-Forwarded-For here. If X-Real-IP is
 * missing or not a valid IP we fall back to req.ip.
 *
 * Vercel shared secret (optional, off until configured):
 * frontend/middleware.ts runs on /api requests before the vercel.json
 * rewrite to Railway. When EDGE_PROXY_SECRET is set in Vercel it strips any
 * client-sent X-MenRush-Edge-Secret, X-MenRush-Client-IP and
 * X-Vercel-Forwarded-For, then sets X-MenRush-Edge-Secret and
 * X-MenRush-Client-IP (the visitor address Vercel itself puts in its own
 * X-Real-IP, read with ipAddress() from @vercel/functions). When
 * EDGE_PROXY_SECRET is also set here AND the secret header matches
 * (constant-time compare), X-MenRush-Client-IP is used, but only when it is
 * one valid IP (a list or anything invalid is ignored).
 *
 * X-Vercel-Forwarded-For is NEVER read: a client can send its own copy to
 * menrush.com/api and Vercel can pass it through, which let forged addresses
 * get their own buckets. Without a matching secret, X-MenRush-Client-IP is
 * ignored too, since anyone can send it straight to Railway. In every
 * fallback case the X-Real-IP rule above applies unchanged. A secret shorter
 * than EDGE_SECRET_MIN_LENGTH counts as unset.
 *
 * Never log the secret, the header, or the values this module returns.
 */
import { createHash, timingSafeEqual } from 'crypto';
import { isIP } from 'net';
import type { Request } from 'express';
import { ipKeyGenerator } from 'express-rate-limit';

export const REAL_IP_HEADER = 'x-real-ip';
export const EDGE_SECRET_HEADER = 'x-menrush-edge-secret';
export const CLIENT_IP_HEADER = 'x-menrush-client-ip';
export const EDGE_SECRET_ENV = 'EDGE_PROXY_SECRET';
export const EDGE_SECRET_MIN_LENGTH = 16;

/** Last resort so the limiter always gets a string. */
const UNKNOWN_IP = '0.0.0.0';

const IPV4_WITH_PORT = /^(\d{1,3}(?:\.\d{1,3}){3}):\d{1,5}$/;
const BRACKETED_V6 = /^\[([^\]]+)\](?::\d{1,5})?$/;
const MAPPED_V4_HEX = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/;

/** First comma-separated value of a header, trimmed. '' when absent. */
export function firstHeaderValue(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string') return '';
  return raw.split(',')[0].trim();
}

/**
 * Normalise one IP string. Returns '' when it is not a valid IP.
 * - trims, strips a port ("1.2.3.4:5", "[v6]:5") and an IPv6 zone id
 * - IPv6 is lower-cased and compressed to canonical form
 * - IPv4-mapped IPv6 (::ffff:1.2.3.4 in any spelling) becomes plain IPv4, so
 *   it does not land in the shared "::/56" bucket ipKeyGenerator would give it
 */
export function normaliseIp(input: string | undefined | null): string {
  if (typeof input !== 'string') return '';
  let s = input.trim();
  if (!s || s.length > 64) return '';

  const bracketed = BRACKETED_V6.exec(s);
  if (bracketed) {
    s = bracketed[1];
  } else {
    const v4Port = IPV4_WITH_PORT.exec(s);
    if (v4Port) s = v4Port[1];
  }
  const zone = s.indexOf('%');
  if (zone !== -1) s = s.slice(0, zone);

  const family = isIP(s);
  if (family === 4) return s;
  if (family !== 6) return '';

  let canonical: string;
  try {
    canonical = new URL(`http://[${s}]/`).hostname.slice(1, -1).toLowerCase();
  } catch {
    return '';
  }
  const mapped = MAPPED_V4_HEX.exec(canonical);
  if (mapped) {
    const hi = parseInt(mapped[1], 16);
    const lo = parseInt(mapped[2], 16);
    return `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
  }
  return canonical;
}

/** The configured edge secret, or null when unset or too short. */
export function edgeSecretFromEnv(env: NodeJS.ProcessEnv = process.env): string | null {
  const secret = String(env[EDGE_SECRET_ENV] ?? '').trim();
  return secret.length >= EDGE_SECRET_MIN_LENGTH ? secret : null;
}

/**
 * Constant-time secret check. Both sides are hashed to fixed-length SHA-256
 * digests first, so timingSafeEqual never throws on a length mismatch and the
 * compare time does not depend on where the strings differ or on length.
 */
export function edgeSecretMatches(provided: string | string[] | undefined, expected: string | null): boolean {
  if (!expected) return false;
  const value = Array.isArray(provided) ? provided[0] : provided;
  if (typeof value !== 'string' || value.length === 0) return false;
  const a = createHash('sha256').update(value.trim(), 'utf8').digest();
  const b = createHash('sha256').update(expected, 'utf8').digest();
  return timingSafeEqual(a, b);
}

/**
 * The edge-set visitor IP: exactly one header value holding exactly one valid
 * IP, normalised. '' for a missing header, a repeated header, a list or an
 * invalid value. Never splits a list and picks an entry.
 */
export function singleHeaderIp(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    if (value.length !== 1) return '';
    value = value[0];
  }
  if (typeof value !== 'string' || value.includes(',')) return '';
  return normaliseIp(value);
}

/**
 * The address a rate limit should count against:
 * 1. X-MenRush-Client-IP, ONLY when EDGE_PROXY_SECRET is set, the request
 *    carries the matching X-MenRush-Edge-Secret, and the value is one valid IP;
 * 2. otherwise X-Real-IP (first value, normalised) when valid;
 * 3. otherwise req.ip, otherwise the socket address.
 * X-Vercel-Forwarded-For and X-Forwarded-For are never read.
 */
export function clientIp(req: Request, env: NodeJS.ProcessEnv = process.env): string {
  if (edgeSecretMatches(req.headers[EDGE_SECRET_HEADER], edgeSecretFromEnv(env))) {
    const visitor = singleHeaderIp(req.headers[CLIENT_IP_HEADER]);
    if (visitor) return visitor;
  }
  const real = normaliseIp(firstHeaderValue(req.headers[REAL_IP_HEADER]));
  if (real) return real;
  return normaliseIp(req.ip) || normaliseIp(req.socket?.remoteAddress) || UNKNOWN_IP;
}

/**
 * keyGenerator for every express-rate-limit limiter. ipKeyGenerator buckets
 * IPv6 by /56 so one client cannot rotate addresses inside its own prefix
 * (and keeps ERR_ERL_KEY_GEN_IPV6 quiet).
 */
export function rateLimitKey(req: Request): string {
  return ipKeyGenerator(clientIp(req));
}
