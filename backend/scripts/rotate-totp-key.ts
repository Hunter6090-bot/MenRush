/**
 * Rotate the TOTP (2FA) wrap key. Prints counts only: never a secret, ciphertext, key or user id.
 *
 * Runbook (deploy, rotate, verify, key rollback, code rollback): docs/totp-key-rotation.md
 *
 *   npm run totp:rotate                                    # dry run (default): counts, no writes
 *   npm run totp:rotate -- --apply --confirm-production    # pre-check, then batches of 100 rows, each locked
 *                                                          # only for its own short transaction
 *   npm run totp:rotate -- --verify                        # every row in the write format, readable with
 *                                                          # TOTP_ENCRYPTION_KEY alone
 *   npm run totp:rotate -- --reverse --confirm-production  # code rollback only: v1 under the current key
 *                                                          # (refuses unless TOTP_WRITE_FORMAT=v1 is set)
 * (--confirm-production is required for --apply and --reverse when NODE_ENV=production.)
 *
 * Safety: NODE_ENV must be set explicitly for the run. NODE_ENV=production is the only way to
 * reach a Railway database, and on production --apply and --reverse also need
 * --confirm-production. Dry run and --verify are read-only. Unknown flags are refused.
 *
 * Keys and DATABASE_URL come from the process environment only (in production:
 * `railway run --service backend -- npm run totp:rotate`). A local .env file is never used for
 * them: src/db loads dotenv, so anything it adds for these names is removed again below.
 * Nothing from the environment is ever printed. Exit code 0 only when result=OK.
 */
const ENV_ONLY = ['TOTP_ENCRYPTION_KEY', 'TOTP_ENCRYPTION_KEY_PREVIOUS', 'JWT_SECRET', 'DATABASE_URL'] as const;

/** Host of DATABASE_URL, for the hint only (never the credentials). */
function dbHost(url: string | undefined): string {
  try {
    return url ? new URL(url).hostname : '';
  } catch {
    return '';
  }
}

const KNOWN_FLAGS = new Set(['--apply', '--verify', '--reverse', '--confirm-production']);

/** Railway Postgres hosts (internal and public proxy). */
function isRailwayHost(host: string): boolean {
  return /(^|\.)(railway\.internal|rlwy\.net|railway\.app)$/i.test(host);
}

async function main() {
  const injected = new Set(ENV_ONLY.filter((k) => process.env[k] !== undefined));
  // Captured before src/db runs dotenv, so a local .env can never decide this.
  const nodeEnv = (process.env.NODE_ENV || '').trim();
  const args = new Set(process.argv.slice(2));
  const unknown = [...args].filter((a) => !KNOWN_FLAGS.has(a));
  if (unknown.length) {
    console.error(`Unknown option(s): ${unknown.length}. Use --apply, --verify, --reverse, --confirm-production.`);
    process.exit(2);
  }
  const chosen = ['--apply', '--verify', '--reverse'].filter((f) => args.has(f));
  if (chosen.length > 1) {
    console.error('Pick one of --apply, --verify, --reverse (or none for a dry run).');
    process.exit(2);
  }
  const mode = chosen[0] === '--apply' ? 'apply' : chosen[0] === '--verify' ? 'verify' : chosen[0] === '--reverse' ? 'reverse' : 'dry-run';
  // src/db runs dotenv.config(); undo anything it filled in from a local .env for these names.
  const { default: pool } = await import('../src/db');
  for (const k of ENV_ONLY) if (!injected.has(k)) delete process.env[k];
  if (!injected.has('DATABASE_URL')) {
    console.error('DATABASE_URL is not set in the environment. Run via: railway run --service backend -- npm run totp:rotate');
    await pool.end();
    process.exit(2);
  }
  const writes = mode === 'apply' || mode === 'reverse';
  if (!nodeEnv) {
    console.error(
      'Refusing to run: set NODE_ENV explicitly. NODE_ENV=production for the live database ' +
        '(plus --confirm-production for --apply or --reverse), or NODE_ENV=development / test for a local one.',
    );
    await pool.end();
    process.exit(2);
  }
  if (nodeEnv !== 'production' && isRailwayHost(dbHost(process.env.DATABASE_URL))) {
    console.error('Refusing to run: DATABASE_URL is a Railway database but NODE_ENV is not production.');
    await pool.end();
    process.exit(2);
  }
  if (nodeEnv === 'production' && writes && !args.has('--confirm-production')) {
    console.error(`Refusing to run --${mode} on production without --confirm-production. Run the dry run first.`);
    await pool.end();
    process.exit(2);
  }
  const { runTotpRotation, formatRotationReport } = await import('../src/security/totp-rotation');
  try {
    const report = await runTotpRotation(pool, mode);
    console.log(formatRotationReport(report));
    process.exitCode = report.ok ? 0 : 1;
  } catch (err) {
    console.error(err instanceof Error ? err.message : 'TOTP rotation failed');
    if (dbHost(process.env.DATABASE_URL).endsWith('.railway.internal')) {
      console.error(
        'DATABASE_URL is a Railway internal host, which only resolves inside Railway. Override it for this run ' +
          'with the Postgres public URL (see "Run with railway" in PR #398), or run inside the service.',
      );
    }
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void main();
