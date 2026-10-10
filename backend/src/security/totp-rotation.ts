/**
 * TOTP wrap-key rotation over users.totp_secret_encrypted. Used by scripts/rotate-totp-key.ts.
 * Reports counts only: never returns or logs a secret, a ciphertext, a key or a user id.
 *
 * Modes
 * - dry-run (default): read every stored secret, try to decrypt in memory, count. No writes.
 * - apply:   one transaction, rows locked FOR UPDATE. Each secret is decrypted (current or
 *            previous key), re-encrypted to v2 under the current key, and the new value is
 *            decrypted with the current key alone and compared before the UPDATE. Any failure
 *            rolls the whole transaction back.
 * - verify:  every row must be in the write format (v2, or v1 during a code rollback) and
 *            decrypt with the CURRENT key alone (previous ignored).
 * - reverse: code rollback only. Refuses unless TOTP_WRITE_FORMAT=v1 is set, so the running
 *            app cannot write v2 again behind it. One transaction, FOR UPDATE: every row is
 *            rewritten as v1 under the CURRENT key (the key the pre-v2 code will use), checked
 *            before commit.
 *
 * A key rollback (back to the old key, same code) is not "reverse": swap the two variables
 * (TOTP_ENCRYPTION_KEY=old, TOTP_ENCRYPTION_KEY_PREVIOUS=new) and run apply, then verify.
 */
import type { Pool, PoolClient } from 'pg';
import {
  currentTotpKeyRaw,
  decryptTotpSecretDetailed,
  decryptTotpSecretWith,
  encryptTotpSecretWith,
  totpKeyProblem,
  totpVersionOf,
  totpWriteFormat,
  type TotpKeyProblem,
  type TotpVersion,
} from './totp-crypto';

export type RotationMode = 'dry-run' | 'apply' | 'verify' | 'reverse';

export interface RotationReport {
  mode: RotationMode;
  total: number;
  enabled: number;
  pending: number;
  v1: number;
  v2: number;
  readableWithCurrent: number;
  readableOnlyWithPrevious: number;
  unreadable: number;
  written: number;
  committed: boolean;
  /** The format this run writes or verifies (TOTP_WRITE_FORMAT, default v2). */
  format: TotpVersion;
  /** Why a run refused before reading any row (counts are then zero). */
  refused?: 'reverse-needs-write-format-v1' | 'apply-needs-write-format-v2' | 'no-current-key' | 'current-key-not-strong';
  /**
   * The boot rule (totpKeyProblem) applied to the CURRENT key, the one production starts with.
   * During a rotation the current key is the new key. null = passes. Checked on dry run, verify
   * and apply, so no gate can pass with a key production would refuse. Not checked on reverse:
   * that is a code rollback to code without the rule (revert #400 first, see the runbook).
   */
  keyProblem: TotpKeyProblem | null;
  ok: boolean;
}

export interface RotationOptions {
  /** Tests only: restrict to these user ids so a shared test DB cannot interfere. */
  onlyUserIds?: string[];
}

interface Row {
  id: string;
  totp_secret_encrypted: string;
  totp_enabled: boolean;
}

const currentRaw = currentTotpKeyRaw;

async function loadRows(client: PoolClient, lock: boolean, opts: RotationOptions): Promise<Row[]> {
  const params: unknown[] = [];
  let where = 'totp_secret_encrypted IS NOT NULL';
  if (opts.onlyUserIds) {
    params.push(opts.onlyUserIds);
    where += ` AND id = ANY($1::uuid[])`;
  }
  const res = await client.query(
    `SELECT id, totp_secret_encrypted, COALESCE(totp_enabled, FALSE) AS totp_enabled
       FROM users WHERE ${where} ORDER BY id ${lock ? 'FOR UPDATE' : ''}`,
    params,
  );
  return res.rows as Row[];
}

function emptyReport(mode: RotationMode): RotationReport {
  return {
    mode, total: 0, enabled: 0, pending: 0, v1: 0, v2: 0,
    readableWithCurrent: 0, readableOnlyWithPrevious: 0, unreadable: 0,
    written: 0, committed: false, format: totpWriteFormat(), keyProblem: null, ok: false,
  };
}

function tally(report: RotationReport, row: Row) {
  report.total += 1;
  if (row.totp_enabled) report.enabled += 1;
  else report.pending += 1;
  if (totpVersionOf(row.totp_secret_encrypted) === 'v2') report.v2 += 1;
  else report.v1 += 1;
}

export async function runTotpRotation(
  pool: Pool,
  mode: RotationMode,
  opts: RotationOptions = {},
): Promise<RotationReport> {
  const report = emptyReport(mode);
  const current = currentRaw();
  const format = report.format;
  // Refuse before touching the DB when the run would fight the running app.
  if (mode === 'reverse' && format !== 'v1') {
    report.refused = 'reverse-needs-write-format-v1';
    return report;
  }
  if (mode === 'apply' && format !== 'v2') {
    report.refused = 'apply-needs-write-format-v2';
    return report;
  }
  if ((mode === 'apply' || mode === 'reverse' || mode === 'verify') && !current) {
    report.refused = 'no-current-key';
    report.keyProblem = 'unset';
    return report;
  }
  if (mode !== 'reverse') report.keyProblem = totpKeyProblem(current);
  // Never write rows under a key production would refuse to start with.
  if (mode === 'apply' && report.keyProblem) {
    report.refused = 'current-key-not-strong';
    return report;
  }
  const client = await pool.connect();
  const writes = mode === 'apply' || mode === 'reverse';
  try {
    if (writes) await client.query('BEGIN');
    else await client.query('BEGIN READ ONLY');
    const rows = await loadRows(client, writes, opts);

    for (const row of rows) {
      tally(report, row);
      const stored = row.totp_secret_encrypted;

      if (mode === 'verify') {
        try {
          decryptTotpSecretWith(stored, current as string);
          report.readableWithCurrent += 1;
        } catch {
          report.unreadable += 1;
        }
        continue;
      }

      let secret: string;
      try {
        const opened = decryptTotpSecretDetailed(stored);
        secret = opened.secret;
        if (opened.keySlot === 'current') report.readableWithCurrent += 1;
        else report.readableOnlyWithPrevious += 1;
      } catch {
        report.unreadable += 1;
        continue;
      }
      if (!writes) continue;

      // apply writes v2, reverse writes v1; both under the current key, checked with it alone.
      const next = encryptTotpSecretWith(secret, current as string, mode === 'apply' ? 'v2' : 'v1');
      if (decryptTotpSecretWith(next, current as string) !== secret) throw new Error('Re-encrypt check failed');
      const upd = await client.query(
        `UPDATE users SET totp_secret_encrypted = $1 WHERE id = $2 AND totp_secret_encrypted = $3`,
        [next, row.id, stored],
      );
      report.written += upd.rowCount ?? 0;
    }

    if (mode === 'verify') {
      const wrongFormat = format === 'v2' ? report.v1 : report.v2;
      report.ok = report.unreadable === 0 && wrongFormat === 0 && !report.keyProblem;
      await client.query('ROLLBACK');
      return report;
    }
    if (!writes) {
      report.ok = report.unreadable === 0 && !report.keyProblem;
      await client.query('ROLLBACK');
      return report;
    }
    // Writes: all-or-nothing.
    if (report.unreadable > 0 || report.written !== report.total) {
      await client.query('ROLLBACK');
      report.ok = false;
      return report;
    }
    await client.query('COMMIT');
    report.committed = true;
    report.ok = true;
    return report;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    report.committed = false;
    report.ok = false;
    // Crypto failures are TotpCryptoError, whose message is fixed and friendly; pg errors
    // never include parameter values. So the message is safe to print.
    throw new Error(`TOTP rotation ${mode} failed: ${err instanceof Error ? err.message : 'unknown error'}`);
  } finally {
    client.release();
  }
}

/** Counts only, one line per field, for the CLI. */
export function formatRotationReport(r: RotationReport): string {
  const lines = [
    `mode=${r.mode} format=${r.format}`,
    `rows=${r.total} enabled=${r.enabled} pending=${r.pending}`,
    `format v1=${r.v1} v2=${r.v2}`,
    r.mode === 'verify'
      ? `readable_with_new_key_alone=${r.readableWithCurrent} unreadable=${r.unreadable}`
      : `readable current=${r.readableWithCurrent} previous_only=${r.readableOnlyWithPrevious} unreadable=${r.unreadable}`,
  ];
  if (r.mode !== 'reverse') {
    // Same rule as the production boot check. Names the problem only, never the key.
    lines.push(r.keyProblem ? `key_check=FAIL problem=${r.keyProblem}` : 'key_check=OK');
  }
  if (r.refused) lines.push(`refused=${r.refused}`);
  if (r.mode === 'apply' || r.mode === 'reverse') {
    lines.push(`written=${r.written} committed=${r.committed}`);
  }
  lines.push(`result=${r.ok ? 'OK' : 'NOT OK'}`);
  return lines.join('\n');
}
