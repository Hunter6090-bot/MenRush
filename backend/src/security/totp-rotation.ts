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
 * - verify:  every row must be v2 and decrypt with the CURRENT key alone (previous ignored).
 * - reverse: one transaction, FOR UPDATE. Rewrites every row as v1 under the rollback target:
 *            TOTP_ENCRYPTION_KEY_PREVIOUS when set, else the current key. Checked before commit.
 *            Use before rolling the code back below v2, or before swapping the key back.
 */
import type { Pool, PoolClient } from 'pg';
import {
  currentTotpKeyRaw,
  decryptTotpSecretDetailed,
  decryptTotpSecretWith,
  encryptTotpSecretWith,
  totpVersionOf,
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
  /** reverse only: which key the v1 rows were written under. */
  reverseTarget?: 'previous' | 'current';
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
    written: 0, committed: false, ok: false,
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
  const previous = process.env.TOTP_ENCRYPTION_KEY_PREVIOUS || null;
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
          if (!current) throw new Error('no current key');
          decryptTotpSecretWith(stored, current);
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

      let next: string;
      if (mode === 'apply') {
        if (!current) throw new Error('No current TOTP key configured');
        next = encryptTotpSecretWith(secret, current, 'v2');
        if (decryptTotpSecretWith(next, current) !== secret) throw new Error('Re-encrypt check failed');
      } else {
        const target = previous ?? current;
        if (!target) throw new Error('No TOTP key configured for reverse');
        report.reverseTarget = previous ? 'previous' : 'current';
        next = encryptTotpSecretWith(secret, target, 'v1');
        if (decryptTotpSecretWith(next, target) !== secret) throw new Error('Reverse check failed');
      }
      const upd = await client.query(
        `UPDATE users SET totp_secret_encrypted = $1 WHERE id = $2 AND totp_secret_encrypted = $3`,
        [next, row.id, stored],
      );
      report.written += upd.rowCount ?? 0;
    }

    if (mode === 'verify') {
      report.ok = report.unreadable === 0 && report.v1 === 0;
      await client.query('ROLLBACK');
      return report;
    }
    if (!writes) {
      report.ok = report.unreadable === 0;
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
    `mode=${r.mode}`,
    `rows=${r.total} enabled=${r.enabled} pending=${r.pending}`,
    `format v1=${r.v1} v2=${r.v2}`,
    r.mode === 'verify'
      ? `readable_with_new_key_alone=${r.readableWithCurrent} unreadable=${r.unreadable}`
      : `readable current=${r.readableWithCurrent} previous_only=${r.readableOnlyWithPrevious} unreadable=${r.unreadable}`,
  ];
  if (r.mode === 'apply' || r.mode === 'reverse') {
    lines.push(`written=${r.written} committed=${r.committed}`);
    if (r.reverseTarget) lines.push(`reverse_target=${r.reverseTarget}_key`);
  }
  lines.push(`result=${r.ok ? 'OK' : 'NOT OK'}`);
  return lines.join('\n');
}
