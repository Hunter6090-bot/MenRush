/**
 * Safety gate for scripts/seed-test-users.ts (and any other local seed).
 *
 * The seed creates accounts with a known password, so it must never reach a live database:
 * - NODE_ENV=production is refused.
 * - A Railway environment named production (railway run) is refused.
 * - A DATABASE_URL host that looks like Railway or like production is refused.
 * - The password comes only from SEED_TEST_PASSWORD; there is no default. Unset, blank or
 *   shorter than 12 characters is refused.
 * Pure functions, no I/O: tested by scripts/seed-test-users-checks.ts.
 */

export const SEED_PASSWORD_ENV = 'SEED_TEST_PASSWORD';
export const SEED_PASSWORD_MIN = 12;

export type SeedRefusal =
  | 'node-env-production'
  | 'railway-production'
  | 'no-database-url'
  | 'bad-database-url'
  | 'railway-host'
  | 'production-host'
  | 'no-password'
  | 'short-password';

/** Railway Postgres hosts: internal network and the public TCP proxy. */
export function isRailwayHost(host: string): boolean {
  return /(^|\.)(railway\.internal|rlwy\.net|railway\.app|up\.railway\.app)$/i.test(host);
}

/** A host name that says it is production (prod, production, live) in any label. */
export function looksLikeProductionHost(host: string): boolean {
  return host.split(/[.-]/).some((label) => /^(prod|production|live)$/i.test(label));
}

export function dbHostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** Why the seed must not run, or null when it may. Never echoes a value. */
export function seedRefusal(env: NodeJS.ProcessEnv): SeedRefusal | null {
  if ((env.NODE_ENV || '').trim().toLowerCase() === 'production') return 'node-env-production';
  const railwayEnv = (env.RAILWAY_ENVIRONMENT_NAME || env.RAILWAY_ENVIRONMENT || '').trim().toLowerCase();
  if (railwayEnv === 'production') return 'railway-production';
  const url = (env.DATABASE_URL || '').trim();
  if (!url) return 'no-database-url';
  const host = dbHostOf(url);
  if (!host) return 'bad-database-url';
  if (isRailwayHost(host)) return 'railway-host';
  if (looksLikeProductionHost(host)) return 'production-host';
  const password = env[SEED_PASSWORD_ENV] ?? '';
  if (!password.trim()) return 'no-password';
  if (password.length < SEED_PASSWORD_MIN) return 'short-password';
  return null;
}

export const SEED_REFUSAL_TEXT: Record<SeedRefusal, string> = {
  'node-env-production': 'NODE_ENV is production. The seed only runs against a local or CI database.',
  'railway-production': 'this is a Railway production environment. The seed only runs against a local or CI database.',
  'no-database-url': 'DATABASE_URL is not set.',
  'bad-database-url': 'DATABASE_URL is not a valid URL.',
  'railway-host': 'DATABASE_URL points at a Railway database. The seed only runs against a local or CI database.',
  'production-host': 'DATABASE_URL looks like a production host. The seed only runs against a local or CI database.',
  'no-password': `${SEED_PASSWORD_ENV} is not set. Choose a local test password and set it for this run (there is no default).`,
  'short-password': `${SEED_PASSWORD_ENV} must be at least ${SEED_PASSWORD_MIN} characters.`,
};
