/**
 * Auth and signup rate-limit ceilings plus account-keyed limiters.
 *
 * Why the IP ceilings are loose: until the Vercel edge secret is configured,
 * every web user coming through the menrush.com /api rewrite shares one
 * bucket per Vercel egress IP (X-Real-IP is Vercel's outbound address). One
 * busy region must not lock people out of login, signup or 2FA, so the
 * per-IP limits are sized for many users behind one address.
 *
 * Brute-force protection comes from the account-keyed limiters below. They
 * are keyed on the account (hashed email, user id, 2FA pending token's
 * verified user, age-check session), not the IP, so sharing an egress IP
 * neither helps an attacker nor hurts other users. Login and 2FA count
 * failed attempts only, so a person who signs in fine never uses them up.
 *
 * Keys are SHA-256 hashed; raw emails and ids are never stored as keys or
 * logged.
 */
import { createHash } from 'crypto';
import type { Request, RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';

export const AUTH_WINDOW_MS = 15 * 60 * 1000;

/**
 * Production ceilings per 15 minutes. Non-production uses at least
 * NON_PRODUCTION_FLOOR so pre-deploy and local suites don't trip the gates.
 */
export const AUTH_LIMITS = {
  // Per IP (rateLimitKey).
  login: 300,
  register: 150,
  twoFactorVerify: 300,
  refresh: 1000,
  resetPassword: 100,
  forgotPassword: 50,
  confirmEmail: 100,
  resendConfirm: 50,
  adultAssurance: 60,
  adultAssurancePoll: 2000,
  // Per account.
  loginAccountFailures: 20,
  twoFactorAccountFailures: 10,
  forgotPasswordAccount: 5,
  resendConfirmAccount: 5,
  accountChange: 10,
  adultAssurancePollSession: 120,
  veriffSession: 8,
} as const;

export type AuthLimitName = keyof typeof AUTH_LIMITS;

export const NON_PRODUCTION_FLOOR = 200;

/** Ceiling for this process: the production value, or the floor outside production. */
export function authLimit(name: AuthLimitName, env: NodeJS.ProcessEnv = process.env): number {
  const prod = AUTH_LIMITS[name];
  return env.NODE_ENV === 'production' ? prod : Math.max(prod, NON_PRODUCTION_FLOOR);
}

function hashKey(prefix: string, value: string): string {
  return `${prefix}:${createHash('sha256').update(value, 'utf8').digest('hex').slice(0, 40)}`;
}

/** Account key from body.email (trimmed, lower-cased, as the schema does). Null when absent. */
export function emailAccountKey(req: Request): string | null {
  const raw = (req.body as { email?: unknown } | undefined)?.email;
  if (typeof raw !== 'string') return null;
  const email = raw.trim().toLowerCase();
  if (!email || email.length > 320 || !email.includes('@')) return null;
  return hashKey('email', email);
}

/** Account key from req.userId (set by authMiddleware). Null when not signed in. */
export function userAccountKey(req: Request): string | null {
  const id = (req as Request & { userId?: unknown }).userId;
  return typeof id === 'string' && id ? hashKey('user', id) : null;
}

/** Key from the :sessionId route param (adult-assurance status poll). */
export function sessionParamKey(req: Request): string | null {
  const id = req.params?.sessionId;
  return typeof id === 'string' && id && id.length <= 128 ? hashKey('aa-session', id) : null;
}

/**
 * Account key for POST /2fa/verify: the user id inside a pending token whose
 * signature verifies. A forged or expired token gets no account key (it
 * fails anyway and stays under the IP limit), so nobody can fill another
 * user's bucket without that user's password.
 */
export function twoFactorAccountKey(verify: (token: string) => { userId: string }) {
  return (req: Request): string | null => {
    const token = (req.body as { pendingToken?: unknown } | undefined)?.pendingToken;
    if (typeof token !== 'string' || !token || token.length > 2048) return null;
    try {
      return hashKey('user', verify(token).userId);
    } catch {
      return null;
    }
  };
}

/**
 * A limiter keyed on an account. Requests without an account key are skipped
 * here (the IP limiter on the same route still applies).
 */
export function accountLimiter(opts: {
  max: number;
  key: (req: Request) => string | null;
  message: string;
  failedOnly?: boolean;
}): RequestHandler {
  return rateLimit({
    windowMs: AUTH_WINDOW_MS,
    max: opts.max,
    keyGenerator: (req) => opts.key(req) ?? 'none',
    skip: (req) => opts.key(req) === null,
    skipSuccessfulRequests: !!opts.failedOnly,
    message: { error: opts.message },
    standardHeaders: true,
    legacyHeaders: false,
  });
}
