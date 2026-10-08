/**
 * TEMPORARY proxy-hop diagnostic. Remove this file, its mount in server.ts,
 * its check script and its CI step once we have the answer.
 *
 * Question: behind Railway's edge (and Vercel's /api rewrite for menrush.com),
 * what does `trust proxy` 1 make req.ip, and which hop holds the client
 * address? The answer decides between trust proxy N, trusting Railway's
 * range, or a Vercel secret header for rate-limit keys.
 *
 * Off by default. Only mounted when PROXY_HOP_DIAGNOSTIC=1 (or "true"), so
 * with the flag unset there is no per-request work at all.
 *
 * Testers may send x-proxy-diag-expect: <their own public IP>. It is only
 * compared with req.ip / XFF / X-Real-IP, never logged.
 *
 * Privacy: logs only booleans and counts. Never an IP, a header value, a
 * path, a user ID or a token. One line per distinct shape per instance,
 * capped (default 50 lines), all tagged [proxy-hop-diag].
 */
import type { NextFunction, Request, RequestHandler, Response } from 'express';

export const PROXY_HOP_DIAG_TAG = '[proxy-hop-diag]';
export const PROXY_HOP_DIAG_DEFAULT_MAX_LINES = 50;
/** xff_count is clamped here so a long spoofed chain cannot mint many shapes. */
export const PROXY_HOP_DIAG_XFF_COUNT_CLAMP = 10;

export interface ProxyHopShape {
  xff_count: number;
  has_x_real_ip: boolean;
  req_ip_equals_x_real_ip: boolean;
  req_ip_equals_xff_leftmost: boolean;
  req_ip_equals_xff_rightmost: boolean;
  x_real_ip_equals_xff_leftmost: boolean;
  socket_peer_in_100_64: boolean;
  socket_peer_is_private: boolean;
  xff_leftmost_is_private: boolean;
  xff_rightmost_in_100_64: boolean;
  xff_rightmost_is_private: boolean;
  has_x_vercel_id: boolean;
  has_x_vercel_forwarded_for: boolean;
  /** Compared with the first x-vercel-forwarded-for entry (Vercel's visitor IP). */
  req_ip_equals_vercel_ff_first: boolean;
  xff_leftmost_equals_vercel_ff_first: boolean;
  x_real_ip_equals_vercel_ff_first: boolean;
  /**
   * Tester-supplied x-proxy-diag-expect header (the tester's own public IP).
   * Only compared, never logged, so a controlled curl shows which position
   * holds the real client.
   */
  has_expect: boolean;
  req_ip_equals_expect: boolean;
  xff_leftmost_equals_expect: boolean;
  xff_rightmost_equals_expect: boolean;
  x_real_ip_equals_expect: boolean;
  vercel_ff_first_equals_expect: boolean;
}

export const PROXY_HOP_DIAG_EXPECT_HEADER = 'x-proxy-diag-expect';

export function isProxyHopDiagnosticEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const v = String(env.PROXY_HOP_DIAGNOSTIC ?? '').trim().toLowerCase();
  return v === '1' || v === 'true';
}

function headerString(raw: string | string[] | undefined): string {
  if (raw === undefined) return '';
  return Array.isArray(raw) ? raw.join(',') : String(raw);
}

/** Lower-case, trim, drop IPv4-mapped IPv6 prefix and IPv6 zone. */
function normIp(raw: string | undefined | null): string {
  if (!raw) return '';
  let s = String(raw).trim().toLowerCase();
  if (s.startsWith('[') && s.includes(']')) s = s.slice(1, s.indexOf(']'));
  if (s.startsWith('::ffff:') && s.includes('.')) s = s.slice(7);
  const zone = s.indexOf('%');
  if (zone >= 0) s = s.slice(0, zone);
  return s;
}

function ipv4Octets(ip: string): number[] | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (!m) return null;
  const o = m.slice(1).map(Number);
  return o.every((n) => n >= 0 && n <= 255) ? o : null;
}

/** 100.64.0.0/10 (CGNAT range, Railway internal hops). */
export function isCgnat(ipRaw: string | undefined | null): boolean {
  const o = ipv4Octets(normIp(ipRaw));
  return !!o && o[0] === 100 && o[1] >= 64 && o[1] <= 127;
}

/**
 * RFC 1918, loopback, link-local and IPv6 ULA / link-local / loopback.
 * CGNAT 100.64/10 is reported separately and is NOT counted here.
 */
export function isPrivateIp(ipRaw: string | undefined | null): boolean {
  const ip = normIp(ipRaw);
  if (!ip) return false;
  const o = ipv4Octets(ip);
  if (o) {
    return (
      o[0] === 10 ||
      o[0] === 127 ||
      (o[0] === 172 && o[1] >= 16 && o[1] <= 31) ||
      (o[0] === 192 && o[1] === 168) ||
      (o[0] === 169 && o[1] === 254)
    );
  }
  if (!ip.includes(':')) return false;
  return ip === '::1' || /^f[cd]/.test(ip) || /^fe[89ab]/.test(ip);
}

/** Pure: compute the yes/no shape of one request. */
export function proxyHopShape(req: Request): ProxyHopShape {
  const xff = headerString(req.headers['x-forwarded-for'])
    .split(',')
    .map((s) => normIp(s))
    .filter(Boolean);
  const leftmost = xff[0] ?? '';
  const rightmost = xff[xff.length - 1] ?? '';
  const realIp = normIp(headerString(req.headers['x-real-ip']).split(',')[0]);
  const reqIp = normIp(req.ip);
  const peer = normIp(req.socket?.remoteAddress);
  const vercelFf = normIp(headerString(req.headers['x-vercel-forwarded-for']).split(',')[0]);
  const expect = normIp(headerString(req.headers[PROXY_HOP_DIAG_EXPECT_HEADER]).split(',')[0]);
  const eq = (a: string, b: string) => a !== '' && a === b;

  return {
    xff_count: Math.min(xff.length, PROXY_HOP_DIAG_XFF_COUNT_CLAMP),
    has_x_real_ip: realIp !== '',
    req_ip_equals_x_real_ip: reqIp !== '' && reqIp === realIp,
    req_ip_equals_xff_leftmost: reqIp !== '' && reqIp === leftmost,
    req_ip_equals_xff_rightmost: reqIp !== '' && reqIp === rightmost,
    x_real_ip_equals_xff_leftmost: realIp !== '' && realIp === leftmost,
    socket_peer_in_100_64: isCgnat(peer),
    socket_peer_is_private: isPrivateIp(peer),
    xff_leftmost_is_private: isPrivateIp(leftmost),
    xff_rightmost_in_100_64: isCgnat(rightmost),
    xff_rightmost_is_private: isPrivateIp(rightmost),
    has_x_vercel_id: headerString(req.headers['x-vercel-id']).trim() !== '',
    has_x_vercel_forwarded_for: headerString(req.headers['x-vercel-forwarded-for']).trim() !== '',
    req_ip_equals_vercel_ff_first: eq(reqIp, vercelFf),
    xff_leftmost_equals_vercel_ff_first: eq(leftmost, vercelFf),
    x_real_ip_equals_vercel_ff_first: eq(realIp, vercelFf),
    has_expect: expect !== '',
    req_ip_equals_expect: eq(reqIp, expect),
    xff_leftmost_equals_expect: eq(leftmost, expect),
    xff_rightmost_equals_expect: eq(rightmost, expect),
    x_real_ip_equals_expect: eq(realIp, expect),
    vercel_ff_first_equals_expect: eq(vercelFf, expect),
  };
}

export interface ProxyHopDiagnosticOptions {
  /** Where lines go. Default console.log (Railway deploy logs). */
  log?: (line: string) => void;
  /** Max shape lines per instance. Default 50. */
  maxLines?: number;
}

/**
 * Middleware that logs each distinct shape once, up to maxLines, then one
 * "cap reached" line, then nothing. Never throws into the request path.
 */
export function createProxyHopDiagnostic(opts: ProxyHopDiagnosticOptions = {}): RequestHandler {
  const log = opts.log ?? ((line: string) => console.log(line));
  const maxLines = Math.max(0, opts.maxLines ?? PROXY_HOP_DIAG_DEFAULT_MAX_LINES);
  const seen = new Set<string>();
  let done = false;

  return (req: Request, _res: Response, next: NextFunction) => {
    if (!done) {
      try {
        const shape = proxyHopShape(req);
        const key = JSON.stringify(shape);
        if (!seen.has(key)) {
          if (seen.size >= maxLines) {
            done = true;
            log(`${PROXY_HOP_DIAG_TAG} cap reached (${maxLines} shapes), no more lines from this instance`);
          } else {
            seen.add(key);
            log(`${PROXY_HOP_DIAG_TAG} shape ${seen.size}/${maxLines} ${key}`);
          }
        }
      } catch {
        // Diagnostic only: never affect the request.
      }
    }
    next();
  };
}

/** Returns the middleware when the flag is on, otherwise null (nothing mounted). */
export function proxyHopDiagnosticFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  opts: ProxyHopDiagnosticOptions = {},
): RequestHandler | null {
  if (!isProxyHopDiagnosticEnabled(env)) return null;
  const log = opts.log ?? ((line: string) => console.log(line));
  const maxLines = opts.maxLines ?? PROXY_HOP_DIAG_DEFAULT_MAX_LINES;
  log(`${PROXY_HOP_DIAG_TAG} enabled, max ${maxLines} shapes per instance (temporary, remove after answer)`);
  return createProxyHopDiagnostic({ ...opts, log, maxLines });
}
