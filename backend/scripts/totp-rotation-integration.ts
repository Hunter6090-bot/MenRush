/**
 * Integration (real Postgres): TOTP wrap-key rotation end to end on a throwaway DB.
 * - Lazy re-encrypt: a v1 row under the old key upgrades to v2 on a successful 2FA login,
 *   and the guarded UPDATE never overwrites a row that changed in between.
 * - Unreadable row: the login error is the fixed friendly text, no OpenSSL text.
 * - rotate-totp-key: dry run (counts, no writes), --apply, --verify (new key alone).
 * - Rollback journeys, every member verifies at every step: forward rotation, key rollback
 *   (swap the variables, apply), forward again, then code rollback (TOTP_WRITE_FORMAT=v1,
 *   --reverse, and the pre-v2 decrypt reads every row). --reverse refuses without v1 writes.
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

function useKeys(current: string, previous?: string, writeFormat?: 'v1') {
  process.env.TOTP_ENCRYPTION_KEY = current;
  if (previous) process.env.TOTP_ENCRYPTION_KEY_PREVIOUS = previous;
  else delete process.env.TOTP_ENCRYPTION_KEY_PREVIOUS;
  if (writeFormat) process.env.TOTP_WRITE_FORMAT = writeFormat;
  else delete process.env.TOTP_WRITE_FORMAT;
}

/** The exact pre-v2 decrypt (main before #398): what reverted code would run. */
function legacyDecrypt(payload: string, raw: string): string {
  const key = crypto.createHash('sha256').update(raw).digest();
  const [ivB64, tagB64, dataB64] = payload.split('.');
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('Invalid encrypted secret');
  const d = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
  d.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([d.update(Buffer.from(dataB64, 'base64')), d.final()]).toString('utf8');
}

async function main() {
  const { default: pool, query } = await import('../src/db');
  const { authenticator } = await import('otplib');
  const crypt = await import('../src/security/totp-crypto');
  const { runTotpRotation } = await import('../src/security/totp-rotation');
  const { twoFactorService } = await import('../src/services/two-factor.service');
  const { authService } = await import('../src/services/auth.service');

  const ids = { enabledA: randomUUID(), enabledB: randomUUID(), pending: randomUUID(), lazy: randomUUID(), race: randomUUID(), broken: randomUUID() };
  const fleet = { f1: randomUUID(), f2: randomUUID(), f3: randomUUID(), f4: randomUUID(), fPending: randomUUID() };
  const lateSetup = randomUUID();
  const all = [...Object.values(ids), ...Object.values(fleet), lateSetup];
  const rotationIds = [ids.enabledA, ids.enabledB, ids.pending];
  const secrets: Record<string, string> = {};

  async function stored(id: string): Promise<string> {
    const r = await query(`SELECT totp_secret_encrypted FROM users WHERE id = $1`, [id]);
    return r.rows[0].totp_secret_encrypted;
  }
  /** A real 2FA login with a fresh code (last-step replay guard reset so steps can repeat). */
  async function login(id: string, code = authenticator.generate(secrets[id])): Promise<boolean> {
    await query(`UPDATE users SET totp_last_step = NULL WHERE id = $1`, [id]);
    return twoFactorService.verifyForLogin(id, code);
  }

  try {
    for (const [name, id] of [...Object.entries(ids), ...Object.entries(fleet)]) {
      secrets[id] = authenticator.generateSecret();
      const enabled = name !== 'pending' && name !== 'fPending';
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
    assert.equal(await login(ids.enabledA), true);
    assert.equal(await stored(ids.enabledA), beforeA, 'no rewrite without a previous key');

    // Rotation window: new key current, old key previous.
    useKeys(NEW_KEY, OLD_KEY);

    // Lazy re-encrypt on successful verify.
    assert.equal(await login(ids.lazy), true);
    const lazyNow = await stored(ids.lazy);
    assert.ok(lazyNow.startsWith('v2:'), 'lazy re-encrypt wrote v2');
    assert.equal(crypt.decryptTotpSecretWith(lazyNow, NEW_KEY), secrets[ids.lazy], 'readable with the new key alone');
    // A wrong code never rewrites.
    const beforeWrong = await stored(ids.enabledB);
    const wrong = authenticator.generate(secrets[ids.enabledB]) === '000000' ? '111111' : '000000';
    assert.equal(await login(ids.enabledB, wrong), false);
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
    assert.equal(await login(ids.enabledA), true);

    // Apply refuses (rolls back everything) when any row is unreadable.
    const brokenScope = { onlyUserIds: [...rotationIds, ids.broken] };
    const beforeBroken = await Promise.all(rotationIds.map(stored));
    const refused = await runTotpRotation(pool, 'apply', brokenScope);
    assert.deepEqual([refused.unreadable, refused.committed, refused.ok], [1, false, false]);
    assert.deepEqual(await Promise.all(rotationIds.map(stored)), beforeBroken, 'nothing committed');

    // ── Rollback journeys: every member can verify at every step ───────────
    const fleetIds = Object.values(fleet);
    const fleetScope = { onlyUserIds: fleetIds };
    async function everyoneVerifies(step: string) {
      for (const id of fleetIds) {
        if (id === fleet.fPending) {
          const p = await twoFactorService.openPendingSecret(id);
          assert.ok(twoFactorService.verifyCode(p.secret, authenticator.generate(secrets[id])), `${step}: pending setup still confirms`);
        } else {
          assert.equal(await login(id), true, `${step}: member can verify`);
        }
      }
    }
    async function formats(): Promise<string[]> {
      return Promise.all(fleetIds.map(async (id) => ((await stored(id)).startsWith('v2:') ? 'v2' : 'v1')));
    }
    async function rotateTo(current: string, previous: string, step: string) {
      useKeys(current, previous);
      await everyoneVerifies(`${step} (both keys set, before apply)`);
      const r = await runTotpRotation(pool, 'apply', fleetScope);
      assert.deepEqual([r.unreadable, r.committed, r.ok], [0, true, true], `${step}: apply`);
      useKeys(current); // previous removed only after verify with the new key alone
      const v = await runTotpRotation(pool, 'verify', fleetScope);
      assert.deepEqual([v.v1, v.unreadable, v.ok], [0, 0, true], `${step}: verify with one key`);
      await everyoneVerifies(`${step} (one key)`);
    }

    // Today: v1 under the old key, old key only.
    useKeys(OLD_KEY);
    await everyoneVerifies('today');
    // 1. Forward rotation to the new key.
    await rotateTo(NEW_KEY, OLD_KEY, 'forward');
    // 2. Key rollback on the same code: swap the variables, apply, verify. Nobody locked out.
    await rotateTo(OLD_KEY, NEW_KEY, 'key rollback');
    for (const id of fleetIds) assert.equal(crypt.decryptTotpSecretWith(await stored(id), OLD_KEY), secrets[id]);
    // 3. Forward again, so the code rollback below starts from all-v2 under the new key.
    await rotateTo(NEW_KEY, OLD_KEY, 'forward again');
    assert.deepEqual(await formats(), ['v2', 'v2', 'v2', 'v2', 'v2']);

    // 4. Code rollback. Wrong order first: --reverse refuses while the app still writes v2,
    //    because a login after it would turn a reversed row back into v2 (unreadable by old code).
    const before4 = await Promise.all(fleetIds.map(stored));
    const refusedReverse = await runTotpRotation(pool, 'reverse', fleetScope);
    assert.deepEqual([refusedReverse.refused, refusedReverse.written, refusedReverse.ok], ['reverse-needs-write-format-v1', 0, false]);
    assert.deepEqual(await Promise.all(fleetIds.map(stored)), before4, 'refused reverse wrote nothing');
    {
      // Show why: a hand-written v1 row is upgraded back to v2 by a login while v2 writes are on.
      useKeys(NEW_KEY, OLD_KEY);
      await query(`UPDATE users SET totp_secret_encrypted = $1 WHERE id = $2`,
        [crypt.encryptTotpSecretWith(secrets[fleet.f1], NEW_KEY, 'v1'), fleet.f1]);
      assert.equal(await login(fleet.f1), true);
      assert.ok((await stored(fleet.f1)).startsWith('v2:'), 'v2 writes on: the row goes back to v2');
    }
    // Right order: (a) TOTP_WRITE_FORMAT=v1 first, on the current code.
    useKeys(NEW_KEY, undefined, 'v1');
    assert.equal(await login(fleet.f2), true);
    assert.ok(!(await stored(fleet.f2)).startsWith('v2:'), 'lazy re-encrypt now writes v1');
    // A member who starts 2FA setup inside the window gets a v1 secret.
    await query(
      `INSERT INTO users (id, email, password_hash, name, age, is_verified, verification_status, photo_url)
       VALUES ($1, $2, 'x', 'TOTP late', 30, TRUE, 'verified', '/uploads/test.jpg')`,
      [lateSetup, `totp-${lateSetup.slice(0, 8)}@test.menrush.local`],
    );
    const late = await twoFactorService.beginSetup(lateSetup, `totp-${lateSetup.slice(0, 8)}@test.menrush.local`);
    secrets[lateSetup] = late.secret;
    assert.ok(!(await stored(lateSetup)).startsWith('v2:'), 'setup during rollback writes v1');
    // (b) --reverse: every row v1 under the current key, then (c) verify in v1.
    const rollbackScope = { onlyUserIds: [...fleetIds, lateSetup] };
    const reversed = await runTotpRotation(pool, 'reverse', rollbackScope);
    assert.deepEqual([reversed.format, reversed.written, reversed.committed, reversed.ok], ['v1', 6, true, true]);
    const v1check = await runTotpRotation(pool, 'verify', rollbackScope);
    assert.deepEqual([v1check.format, v1check.v1, v1check.v2, v1check.unreadable, v1check.ok], ['v1', 6, 0, 0, true]);
    // Still fine on the current code while the revert deploys.
    await everyoneVerifies('code rollback, before revert');
    // (d) Revert the code: the pre-v2 decrypt reads every row with the same key.
    for (const id of [...fleetIds, lateSetup]) {
      const v = await stored(id);
      assert.equal(legacyDecrypt(v, NEW_KEY), secrets[id], 'pre-v2 code reads every row');
      assert.ok(authenticator.check(authenticator.generate(secrets[id]), legacyDecrypt(v, NEW_KEY)), 'and the code verifies');
    }
    useKeys(NEW_KEY);

    // The CLI prints counts only: no ids, no ciphertext, no key.
    // (Rows written with the new key are unreadable under the old key alone, so exit 1 here.)
    const cli = spawnSync('npx', ['ts-node', '--transpile-only', path.join(__dirname, 'rotate-totp-key.ts')], {
      env: { ...process.env, NODE_ENV: 'test', TOTP_ENCRYPTION_KEY: OLD_KEY, TOTP_ENCRYPTION_KEY_PREVIOUS: '', TOTP_WRITE_FORMAT: '' },
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
