/**
 * Integration (real Postgres): TOTP wrap-key rotation end to end on a throwaway DB.
 * - Lazy re-encrypt: a v1 row under the old key upgrades to v2 on a successful 2FA login,
 *   and the guarded UPDATE never overwrites a row that changed in between.
 * - Unreadable row: the login error is the fixed friendly text, no OpenSSL text.
 * - rotate-totp-key: dry run (counts, no writes), --apply, --verify (new key alone), --reverse.
 * Keys are random per run. Needs a migrated DATABASE_URL; skips without one.
 *   DATABASE_URL=postgresql://menrush:menrush@localhost:5432/menrush_ci npm run test:totp-rotation-integration
 */
import assert from 'assert';
import crypto, { randomUUID } from 'crypto';
import { spawnSync } from 'child_process';
import path from 'path';

if (!process.env.DATABASE_URL) {
  console.log('totp-rotation-integration: SKIPPED (no DATABASE_URL)');
  process.exit(0);
}

const OLD_KEY = `test-old-${crypto.randomBytes(16).toString('hex')}`; // passphrase style, like today
const NEW_KEY = crypto.randomBytes(32).toString('base64'); // what Al will generate
process.env.JWT_SECRET = process.env.JWT_SECRET || `test-jwt-${crypto.randomBytes(16).toString('hex')}`;

function useKeys(current: string, previous?: string) {
  process.env.TOTP_ENCRYPTION_KEY = current;
  if (previous) process.env.TOTP_ENCRYPTION_KEY_PREVIOUS = previous;
  else delete process.env.TOTP_ENCRYPTION_KEY_PREVIOUS;
}

async function main() {
  const { default: pool, query } = await import('../src/db');
  const { authenticator } = await import('otplib');
  const crypt = await import('../src/security/totp-crypto');
  const { runTotpRotation } = await import('../src/security/totp-rotation');
  const { twoFactorService } = await import('../src/services/two-factor.service');
  const { authService } = await import('../src/services/auth.service');

  const ids = { enabledA: randomUUID(), enabledB: randomUUID(), pending: randomUUID(), lazy: randomUUID(), race: randomUUID(), broken: randomUUID() };
  const all = Object.values(ids);
  const rotationIds = [ids.enabledA, ids.enabledB, ids.pending];
  const secrets: Record<string, string> = {};

  async function stored(id: string): Promise<string> {
    const r = await query(`SELECT totp_secret_encrypted FROM users WHERE id = $1`, [id]);
    return r.rows[0].totp_secret_encrypted;
  }

  try {
    for (const [name, id] of Object.entries(ids)) {
      secrets[id] = authenticator.generateSecret();
      const enabled = name !== 'pending';
      await query(
        `INSERT INTO users (id, email, password_hash, name, age, is_verified, verification_status, photo_url,
                            totp_secret_encrypted, totp_enabled)
         VALUES ($1, $2, 'x', $3, 30, TRUE, 'verified', '/uploads/test.jpg', $4, $5)`,
        [id, `totp-${id.slice(0, 8)}@test.menrush.local`, `TOTP ${name}`,
         crypt.encryptTotpSecretWith(secrets[id], OLD_KEY, 'v1'), enabled],
      );
    }
    await query(`UPDATE users SET totp_secret_encrypted = 'v2:AAAA.BBBB.CCCC' WHERE id = $1`, [ids.broken]);

    // Today's variables: old key only. v1 reads, nothing is rewritten.
    useKeys(OLD_KEY);
    const beforeA = await stored(ids.enabledA);
    assert.equal(await twoFactorService.verifyForLogin(ids.enabledA, authenticator.generate(secrets[ids.enabledA])), true);
    assert.equal(await stored(ids.enabledA), beforeA, 'no rewrite without a previous key');

    // Rotation window: new key current, old key previous.
    useKeys(NEW_KEY, OLD_KEY);

    // Lazy re-encrypt on successful verify.
    assert.equal(await twoFactorService.verifyForLogin(ids.lazy, authenticator.generate(secrets[ids.lazy])), true);
    const lazyNow = await stored(ids.lazy);
    assert.ok(lazyNow.startsWith('v2:'), 'lazy re-encrypt wrote v2');
    assert.equal(crypt.decryptTotpSecretWith(lazyNow, NEW_KEY), secrets[ids.lazy], 'readable with the new key alone');
    // A wrong code never rewrites.
    const beforeWrong = await stored(ids.enabledB);
    const wrong = authenticator.generate(secrets[ids.enabledB]) === '000000' ? '111111' : '000000';
    assert.equal(await twoFactorService.verifyForLogin(ids.enabledB, wrong), false);
    assert.equal(await stored(ids.enabledB), beforeWrong);

    // Guard: if the stored value changed after it was read, the UPDATE matches nothing.
    const opened = await twoFactorService.openEnabledSecret(ids.race);
    const replaced = crypt.encryptTotpSecretWith(authenticator.generateSecret(), NEW_KEY, 'v2');
    await query(`UPDATE users SET totp_secret_encrypted = $1 WHERE id = $2`, [replaced, ids.race]);
    const raced = await query(
      `UPDATE users SET totp_secret_encrypted = $1 WHERE id = $2 AND totp_secret_encrypted = $3`,
      [crypt.encryptTotpSecret(opened.secret), ids.race, opened.stored],
    );
    assert.equal(raced.rowCount, 0);
    assert.equal(await stored(ids.race), replaced);

    // Unreadable secret: fixed friendly text through the real login path.
    const pending = authService.signTwoFactorPendingToken(ids.broken);
    await assert.rejects(authService.completeTwoFactorLogin(pending, '123456'), (err: Error) => {
      assert.equal(err.message, crypt.TOTP_DECRYPT_FAILED_MESSAGE);
      assert.ok(!/unsupported state|unable to authenticate|openssl/i.test(err.message));
      return true;
    });

    const scope = { onlyUserIds: rotationIds };
    // Dry run: counts only, no writes.
    const snapshot = await Promise.all(rotationIds.map(stored));
    const dry = await runTotpRotation(pool, 'dry-run', scope);
    assert.deepEqual(
      [dry.total, dry.enabled, dry.pending, dry.v1, dry.v2, dry.readableWithCurrent, dry.readableOnlyWithPrevious, dry.unreadable, dry.written, dry.ok],
      [3, 2, 1, 3, 0, 0, 3, 0, 0, true],
    );
    assert.deepEqual(await Promise.all(rotationIds.map(stored)), snapshot, 'dry run wrote nothing');

    // Verify before apply fails (v1 rows, old key).
    const early = await runTotpRotation(pool, 'verify', scope);
    assert.equal(early.ok, false);

    // Apply: one transaction, all rows to v2 under the new key.
    const applied = await runTotpRotation(pool, 'apply', scope);
    assert.deepEqual([applied.written, applied.committed, applied.ok], [3, true, true]);
    for (const id of rotationIds) {
      const v = await stored(id);
      assert.ok(v.startsWith('v2:'));
      assert.equal(crypt.decryptTotpSecretWith(v, NEW_KEY), secrets[id]);
    }

    // Verify with the new key ALONE (previous removed).
    useKeys(NEW_KEY);
    const verified = await runTotpRotation(pool, 'verify', scope);
    assert.deepEqual([verified.total, verified.v2, verified.readableWithCurrent, verified.unreadable, verified.ok], [3, 3, 3, 0, true]);
    assert.equal(await twoFactorService.verifyForLogin(ids.enabledA, authenticator.generate(secrets[ids.enabledA])), true);

    // Apply refuses (rolls back everything) when any row is unreadable.
    const brokenScope = { onlyUserIds: [...rotationIds, ids.broken] };
    const beforeBroken = await Promise.all(rotationIds.map(stored));
    const refused = await runTotpRotation(pool, 'apply', brokenScope);
    assert.deepEqual([refused.unreadable, refused.committed, refused.ok], [1, false, false]);
    assert.deepEqual(await Promise.all(rotationIds.map(stored)), beforeBroken, 'nothing committed');

    // Reverse: back to v1 under the previous (old) key, readable by the pre-v2 code.
    useKeys(NEW_KEY, OLD_KEY);
    const reversed = await runTotpRotation(pool, 'reverse', scope);
    assert.deepEqual([reversed.written, reversed.committed, reversed.reverseTarget, reversed.ok], [3, true, 'previous', true]);
    for (const id of rotationIds) {
      const v = await stored(id);
      assert.ok(!v.startsWith('v2:') && v.split('.').length === 3);
      const legacyKey = crypto.createHash('sha256').update(OLD_KEY).digest();
      const [iv, tag, ct] = v.split('.');
      const d = crypto.createDecipheriv('aes-256-gcm', legacyKey, Buffer.from(iv, 'base64'));
      d.setAuthTag(Buffer.from(tag, 'base64'));
      assert.equal(Buffer.concat([d.update(Buffer.from(ct, 'base64')), d.final()]).toString('utf8'), secrets[id]);
    }

    // The CLI prints counts only: no ids, no ciphertext, no key.
    // (Rows written with the new key are unreadable under the old key alone, so exit 1 here.)
    const cli = spawnSync('npx', ['ts-node', '--transpile-only', path.join(__dirname, 'rotate-totp-key.ts')], {
      env: { ...process.env, TOTP_ENCRYPTION_KEY: OLD_KEY, TOTP_ENCRYPTION_KEY_PREVIOUS: '' },
      encoding: 'utf8',
    });
    const out = `${cli.stdout}${cli.stderr}`;
    assert.match(out, /mode=dry-run/);
    assert.match(out, /result=NOT OK/);
    assert.equal(cli.status, 1, 'non-zero exit when any row is unreadable');
    for (const id of all) assert.ok(!out.includes(id), 'no user id in output');
    assert.ok(!out.includes(OLD_KEY) && !out.includes(NEW_KEY), 'no key in output');
    assert.ok(!/v2:|[A-Za-z0-9+/]{16,}={0,2}\.[A-Za-z0-9+/]{16,}/.test(out), 'no ciphertext in output');

    console.log('totp-rotation-integration: OK');
  } finally {
    await query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [all]).catch(() => undefined);
    await pool.end();
  }
}

main().catch((err) => {
  console.error('totp-rotation-integration: FAILED');
  console.error(err);
  process.exit(1);
});
