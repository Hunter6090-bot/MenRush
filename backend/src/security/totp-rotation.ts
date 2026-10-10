/**
 * TOTP wrap-key rotation over users.totp_secret_encrypted. Used by scripts/rotate-totp-key.ts.
 * Reports counts only: never returns or logs a secret, a ciphertext, a key or a user id.
 *
 * Modes
 * - dry-run (default): read every stored secret, try to decrypt in memory, count. No writes.
 * - apply:   a lock-free pre-check (any unreadable row: nothing is written), then batches of
 *            rows, each its own transaction locking only that batch FOR UPDATE. Each secret is
 *            decrypted (current or previous key), re-encrypted to v2 under the current key, and
 *            checked with the current key alone before the guarded UPDATE.
 * - verify:  every row must be in the write format (v2, or v1 during a code rollback) and
 *            decrypt with the CURRENT key alone (previous ignored).
 * - reverse: code rollback only. Refuses unless TOTP_WRITE_FORMAT=v1 is set, so the running
 *            app cannot write v2 again behind it. Same pre-check and batches as apply: every
 *            row is rewritten as v1 under the CURRENT key (the key the pre-v2 code will use).
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
  /** Write batches committed (apply / reverse). */
  batches: number;
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
  /** Rows per write transaction for apply / reverse (default DEFAULT_ROTATION_BATCH_SIZE). */
  batchSize?: number;
}

interface Row {
  id: string;
  totp_secret_encrypted: string;
  totp_enabled: boolean;
}

const currentRaw = currentTotpKeyRaw;

async function loadRows(client: PoolClient, opts: RotationOptions, lock = false): Promise<Row[]> {
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
    written: 0, batches: 0, committed: false, format: totpWriteFormat(), keyProblem: null, ok: false,
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
  if (mode === 'apply' || mode === 'reverse') {
    return runBatchedWrite(pool, mode, report, current as string, opts);
  }
  // dry-run and verify: one read-only transaction, no locks.
  const client = await pool.connect();
  try {
    await client.query('BEGIN READ ONLY');
    const rows = await loadRows(client, opts);
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
      try {
        const opened = decryptTotpSecretDetailed(stored);
        if (opened.keySlot === 'current') report.readableWithCurrent += 1;
        else report.readableOnlyWithPrevious += 1;
      } catch {
        report.unreadable += 1;
      }
    }
    await client.query('ROLLBACK');
    if (mode === 'verify') {
      const wrongFormat = format === 'v2' ? report.v1 : report.v2;
      report.ok = report.unreadable === 0 && wrongFormat === 0 && !report.keyProblem;
    } else {
      report.ok = report.unreadable === 0 && !report.keyProblem;
    }
    return report;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    report.ok = false;
    throw new Error(`TOTP rotation ${mode} failed: ${err instanceof Error ? err.message : 'unknown error'}`);
  } finally {
    client.release();
  }
}

/** Rows per write transaction: only these are locked at a time. */
export const DEFAULT_ROTATION_BATCH_SIZE = 100;

/**
 * apply / reverse in batches, so no run locks every row for its whole length.
 * 1. Pre-check, read-only and lock-free: every row must decrypt (current or previous key). If
 *    any row is unreadable, nothing is written at all.
 * 2. Then, per batch of ids: BEGIN, lock just that batch FOR UPDATE, re-encrypt each row under
 *    the current key (v2 for apply, v1 for reverse), check it with the current key alone, write
 *    with a guarded UPDATE, COMMIT. A failure rolls back that batch and stops the run.
 * Stopping part-way is safe: every row, rewritten or not, still decrypts with the variables set
 * for the run (current + previous), and v1 rows are readable by both code versions. Re-running
 * finishes the job; --verify passes only when every row is done.
 */
async function runBatchedWrite(
  pool: Pool,
  mode: 'apply' | 'reverse',
  report: RotationReport,
  current: string,
  opts: RotationOptions,
): Promise<RotationReport> {
  const target: TotpVersion = mode === 'apply' ? 'v2' : 'v1';
  const batchSize = Math.max(1, opts.batchSize ?? DEFAULT_ROTATION_BATCH_SIZE);
  let ids: string[];
  const scan = await pool.connect();
  try {
    await scan.query('BEGIN READ ONLY');
    const rows = await loadRows(scan, opts);
    await scan.query('ROLLBACK');
    for (const row of rows) {
      tally(report, row);
      try {
        const opened = decryptTotpSecretDetailed(row.totp_secret_encrypted);
        if (opened.keySlot === 'current') report.readableWithCurrent += 1;
        else report.readableOnlyWithPrevious += 1;
      } catch {
        report.unreadable += 1;
      }
    }
    ids = rows.map((r) => r.id);
  } catch (err) {
    await scan.query('ROLLBACK').catch(() => {});
    throw new Error(`TOTP rotation ${mode} failed: ${err instanceof Error ? err.message : 'unknown error'}`);
  } finally {
    scan.release();
  }
  if (report.unreadable > 0) {
    report.ok = false;
    return report; // nothing written
  }

  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const rows = await loadRows(client, { onlyUserIds: batch }, true);
      let written = 0;
      for (const row of rows) {
        const stored = row.totp_secret_encrypted;
        const secret = decryptTotpSecretDetailed(stored).secret; // throws: batch rolls back
        const next = encryptTotpSecretWith(secret, current, target);
        if (decryptTotpSecretWith(next, current) !== secret) throw new Error('Re-encrypt check failed');
        const upd = await client.query(
          `UPDATE users SET totp_secret_encrypted = $1 WHERE id = $2 AND totp_secret_encrypted = $3`,
          [next, row.id, stored],
        );
        written += upd.rowCount ?? 0;
      }
      await client.query('COMMIT');
      report.written += written;
      report.batches += 1;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      report.committed = report.batches > 0;
      report.ok = false;
      throw new Error(
        `TOTP rotation ${mode} stopped after ${report.batches} batch(es): ${err instanceof Error ? err.message : 'unknown error'}`,
      );
    } finally {
      client.release();
    }
  }
  report.committed = true;
  report.ok = report.written === report.total;
  return report;
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
    lines.push(`written=${r.written} batches=${r.batches} committed=${r.committed}`);
  }
  lines.push(`result=${r.ok ? 'OK' : 'NOT OK'}`);
  return lines.join('\n');
}
