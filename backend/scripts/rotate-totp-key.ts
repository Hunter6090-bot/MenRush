/**
 * Rotate the TOTP (2FA) wrap key. Prints counts only: never a secret, ciphertext, key or user id.
 *
 *   npm run totp:rotate                # dry run (default): counts, no writes
 *   npm run totp:rotate -- --apply     # one transaction, FOR UPDATE, check before commit
 *   npm run totp:rotate -- --verify    # every row v2 and readable with TOTP_ENCRYPTION_KEY alone
 *   npm run totp:rotate -- --reverse   # back to v1 under TOTP_ENCRYPTION_KEY_PREVIOUS (or current)
 *
 * Keys come from the environment only (in production: `railway run --service backend`).
 * Exit code 0 only when result=OK.
 */
async function main() {
  const args = new Set(process.argv.slice(2));
  const chosen = ['--apply', '--verify', '--reverse'].filter((f) => args.has(f));
  if (chosen.length > 1) {
    console.error('Pick one of --apply, --verify, --reverse (or none for a dry run).');
    process.exit(2);
  }
  const mode = chosen[0] === '--apply' ? 'apply' : chosen[0] === '--verify' ? 'verify' : chosen[0] === '--reverse' ? 'reverse' : 'dry-run';
  const { default: pool } = await import('../src/db');
  const { runTotpRotation, formatRotationReport } = await import('../src/security/totp-rotation');
  try {
    const report = await runTotpRotation(pool, mode);
    console.log(formatRotationReport(report));
    process.exitCode = report.ok ? 0 : 1;
  } catch (err) {
    console.error(err instanceof Error ? err.message : 'TOTP rotation failed');
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void main();
