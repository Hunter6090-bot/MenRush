/**
 * Rotate the TOTP (2FA) wrap key. Prints counts only: never a secret, ciphertext, key or user id.
 *
 *   npm run totp:rotate                # dry run (default): counts, no writes
 *   npm run totp:rotate -- --apply     # one transaction, FOR UPDATE, check before commit
 *   npm run totp:rotate -- --verify    # every row v2 and readable with TOTP_ENCRYPTION_KEY alone
 *   npm run totp:rotate -- --reverse   # back to v1 under TOTP_ENCRYPTION_KEY_PREVIOUS (or current)
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

async function main() {
  const injected = new Set(ENV_ONLY.filter((k) => process.env[k] !== undefined));
  const args = new Set(process.argv.slice(2));
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
          'with the Postgres public URL (see "Preferred: run with railway" in PR #398), or run inside the service.',
      );
    }
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void main();
