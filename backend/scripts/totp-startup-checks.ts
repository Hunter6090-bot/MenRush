/**
 * Production refuses to start without a real 2FA wrap key, and drops the JWT_SECRET fallback.
 * No real key is in this file: test keys are random per run. The rule is about the key itself
 * (at least 32 random bytes as hex or base64); there is no list of known values to match.
 *   npm run test:totp-startup
 */
import assert from 'assert';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import {
  TOTP_KEY_MIN_BYTES,
  TotpCryptoError,
  assertTotpKeyForProduction,
  decodeTotpKey,
  currentTotpKeyRaw,
  decryptTotpSecret,
  encryptTotpSecret,
  totpKeyByteLength,
  totpKeyProblem,
} from '../src/security/totp-crypto';

const prod = (key?: string): NodeJS.ProcessEnv => ({ NODE_ENV: 'production', ...(key === undefined ? {} : { TOTP_ENCRYPTION_KEY: key }) });

function refuses(env: NodeJS.ProcessEnv, problem: string) {
  assert.throws(() => assertTotpKeyForProduction(env), (err: Error) => {
    assert.match(err.message, new RegExp(`TOTP_ENCRYPTION_KEY is ${problem}`));
    if (env.TOTP_ENCRYPTION_KEY && env.TOTP_ENCRYPTION_KEY.trim()) {
      assert.ok(!err.message.includes(env.TOTP_ENCRYPTION_KEY.trim()), 'message never echoes the key');
    }
    return true;
  });
}

function withEnv(env: Record<string, string | undefined>, run: () => void) {
  const keys = ['NODE_ENV', 'TOTP_ENCRYPTION_KEY', 'TOTP_ENCRYPTION_KEY_PREVIOUS', 'JWT_SECRET'];
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  try {
    for (const k of keys) {
      if (env[k] === undefined) delete process.env[k];
      else process.env[k] = env[k];
    }
    run();
  } finally {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k] as string;
    }
  }
}

const tests: [string, () => void][] = [
  ['production refuses an unset or blank key', () => {
    refuses(prod(), 'unset');
    refuses(prod(''), 'unset');
    refuses(prod('   '), 'unset');
  }],
  ['production refuses a key under 32 bytes', () => {
    refuses(prod(crypto.randomBytes(16).toString('base64')), 'too-short');
    refuses(prod(crypto.randomBytes(24).toString('base64')), 'too-short'); // 32 chars, 24 bytes
    refuses(prod(crypto.randomBytes(31).toString('base64')), 'too-short');
    refuses(prod(crypto.randomBytes(31).toString('hex')), 'too-short'); // 62 hex chars
    assert.equal(TOTP_KEY_MIN_BYTES, 32);
  }],
  ['production refuses anything that is not hex or base64: passphrases, placeholders, words', () => {
    refuses(prod('short-passphrase'), 'not-encoded');
    refuses(prod(`a long passphrase ${crypto.randomBytes(16).toString('hex')}`), 'not-encoded');
    refuses(prod('x'.repeat(31)), 'not-encoded');
    refuses(prod('thisisaverylongpassphrasewithonlylettersxyzabc'), 'not-encoded'); // base64 alphabet, no digits or caps
    refuses(prod(`Ab1-${crypto.randomBytes(40).toString('hex')}`), 'not-encoded'); // a dash is neither hex nor base64
    const examples = [path.join(__dirname, '../.env.example'), path.join(__dirname, '../../.env.example')];
    const placeholders = examples
      .filter((f) => fs.existsSync(f))
      .flatMap((f) => fs.readFileSync(f, 'utf8').split('\n'))
      .map((l) => l.match(/^JWT_SECRET=(.+)$/)?.[1]?.trim())
      .filter((v): v is string => !!v);
    assert.ok(placeholders.length >= 2, 'found the JWT_SECRET placeholders');
    for (const p of placeholders) assert.notEqual(totpKeyProblem(p), null, 'placeholders are refused');
  }],
  ['production refuses low-variety keys even when long enough', () => {
    refuses(prod('a'.repeat(64)), 'low-variety'); // hex, one byte value
    refuses(prod('ab'.repeat(32)), 'low-variety'); // hex, repeating pair
    refuses(prod('0123456789abcdef'.repeat(4)), 'low-variety'); // hex, 8 distinct bytes
    refuses(prod(Buffer.alloc(32, 7).toString('base64')), 'not-encoded'); // one repeated byte: no digits, not key-like
    refuses(prod('Ab1+'.repeat(11)), 'low-variety'); // base64-shaped repeat, 33 bytes
    refuses(prod(Buffer.concat([crypto.randomBytes(8), Buffer.alloc(32, 0)]).toString('hex')), 'low-variety'); // mostly zeros
  }],
  ['production accepts a random 32-byte base64 key or a random 64-char hex key', () => {
    let accepted = 0;
    for (let i = 0; i < 200; i += 1) {
      const b64 = crypto.randomBytes(32).toString('base64');
      const hex = crypto.randomBytes(32).toString('hex');
      assert.equal(totpKeyProblem(hex), null, 'random hex always passes');
      if (totpKeyProblem(b64) === null) accepted += 1;
      else assert.equal(totpKeyProblem(b64), 'not-encoded', 'only a key with no digit (very rare) is refused');
    }
    assert.ok(accepted >= 195, `random base64 nearly always passes (${accepted}/200)`);
    let b64 = crypto.randomBytes(32).toString('base64');
    while (totpKeyProblem(b64) !== null) b64 = crypto.randomBytes(32).toString('base64');
    assert.doesNotThrow(() => assertTotpKeyForProduction(prod(b64)));
    assert.doesNotThrow(() => assertTotpKeyForProduction(prod(crypto.randomBytes(48).toString('base64'))));
    assert.equal(totpKeyByteLength(b64), 32);
    assert.equal(decodeTotpKey(crypto.randomBytes(32).toString('hex'))?.encoding, 'hex');
  }],
  ['no known-value list or fingerprint in the code (nothing to help offline guessing)', () => {
    const src = fs.readFileSync(path.join(__dirname, '../src/security/totp-crypto.ts'), 'utf8');
    assert.ok(!/[0-9a-f]{64}/.test(src), 'no 64-hex fingerprints');
    assert.ok(!/FINGERPRINT|PLACEHOLDER_KEY|dev-default|menrush-dev/i.test(src));
  }],
  ['outside production the guard is a no-op', () => {
    assert.doesNotThrow(() => assertTotpKeyForProduction({ NODE_ENV: 'development' }));
    assert.doesNotThrow(() => assertTotpKeyForProduction({}));
  }],
  ['production drops the JWT_SECRET fallback; dev keeps it', () => {
    const jwt = `jwt-${crypto.randomBytes(16).toString('hex')}`;
    withEnv({ NODE_ENV: 'production', JWT_SECRET: jwt }, () => {
      assert.equal(currentTotpKeyRaw(), null);
      assert.throws(() => encryptTotpSecret('JBSWY3DPEHPK3PXP'), (e: unknown) => e instanceof TotpCryptoError && e.failure === 'config');
    });
    withEnv({ NODE_ENV: 'development', JWT_SECRET: jwt }, () => {
      assert.equal(currentTotpKeyRaw(), jwt);
      assert.equal(decryptTotpSecret(encryptTotpSecret('JBSWY3DPEHPK3PXP')), 'JBSWY3DPEHPK3PXP');
    });
    const key = crypto.randomBytes(32).toString('base64');
    withEnv({ NODE_ENV: 'production', TOTP_ENCRYPTION_KEY: key, JWT_SECRET: jwt }, () => {
      assert.equal(currentTotpKeyRaw(), key);
    });
  }],
  ['boot.ts and server.ts run the guard before the DB and before listen', () => {
    const boot = fs.readFileSync(path.join(__dirname, '../src/boot.ts'), 'utf8');
    assert.ok(boot.indexOf('assertTotpKeyForProduction();') > -1);
    assert.ok(boot.indexOf('assertTotpKeyForProduction();') < boot.indexOf('await runPendingMigrations()'));
    const server = fs.readFileSync(path.join(__dirname, '../src/server.ts'), 'utf8');
    assert.ok(server.indexOf('assertTotpKeyForProduction();') > -1);
    assert.ok(server.indexOf('assertTotpKeyForProduction();') < server.indexOf('server.listen('));
  }],
  ['the real boot exits 1 in production with no key, before any migration', () => {
    const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: 'production', DATABASE_URL: 'postgresql://nobody@127.0.0.1:1/none', JWT_SECRET: 'x'.repeat(40) };
    delete env.TOTP_ENCRYPTION_KEY;
    const run = spawnSync('npx', ['ts-node', '--transpile-only', path.join(__dirname, '../src/boot.ts')], {
      env, encoding: 'utf8', timeout: 60_000, cwd: path.join(__dirname, '..'),
    });
    const out = `${run.stdout}${run.stderr}`;
    assert.equal(run.status, 1, out);
    assert.match(out, /Refusing to start: TOTP_ENCRYPTION_KEY is unset/);
    assert.ok(!/Applied|migration/i.test(out.replace(/totp:rotate[^\n]*/g, '')), 'no migration ran');
  }],
];

/**
 * The rotate gate uses the same rule as boot. No DB here: apply must refuse before connecting,
 * and the report lines must show the rule result. (Real-PG coverage: test:totp-rotation-integration.)
 */
const asyncTests: [string, () => Promise<void>][] = [
  ['rotate gate: apply refuses a key production would refuse, before touching the DB', async () => {
    const { runTotpRotation, formatRotationReport } = await import('../src/security/totp-rotation');
    const noDb = { connect: async () => { throw new Error('must not connect'); } } as unknown as import('pg').Pool;
    const saved = { k: process.env.TOTP_ENCRYPTION_KEY, p: process.env.TOTP_ENCRYPTION_KEY_PREVIOUS, f: process.env.TOTP_WRITE_FORMAT };
    try {
      delete process.env.TOTP_ENCRYPTION_KEY_PREVIOUS;
      delete process.env.TOTP_WRITE_FORMAT;
      for (const [key, problem] of [
        ['a passphrase that is long enough to pass a length check', 'not-encoded'],
        [crypto.randomBytes(24).toString('base64'), 'too-short'],
        ['ab'.repeat(32), 'low-variety'],
      ] as const) {
        process.env.TOTP_ENCRYPTION_KEY = key;
        const r = await runTotpRotation(noDb, 'apply');
        assert.deepEqual([r.refused, r.keyProblem, r.written, r.ok], ['current-key-not-strong', problem, 0, false]);
        const out = formatRotationReport(r);
        assert.match(out, new RegExp(`key_check=FAIL problem=${problem}`));
        assert.match(out, /result=NOT OK/);
        assert.ok(!out.includes(key), 'the key is never printed');
      }
      process.env.TOTP_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
      const verifyNoKey = await runTotpRotation(noDb, 'verify').catch((e) => e as Error);
      assert.ok(verifyNoKey instanceof Error && /must not connect/.test(verifyNoKey.message), 'a strong key goes on to read rows');
      const rev = formatRotationReport({ ...(await runTotpRotation(noDb, 'reverse')), mode: 'reverse' });
      assert.ok(!/key_check/.test(rev), 'reverse (code rollback) does not apply the rule');
    } finally {
      for (const [k, v] of [['TOTP_ENCRYPTION_KEY', saved.k], ['TOTP_ENCRYPTION_KEY_PREVIOUS', saved.p], ['TOTP_WRITE_FORMAT', saved.f]] as const) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  }],
];

(async () => {
  let failures = 0;
  for (const [name, run] of tests) {
    try {
      run();
      console.log(`PASS ${name}`);
    } catch (err) {
      failures += 1;
      console.error(`FAIL ${name}`);
      console.error(err);
    }
  }
  for (const [name, run] of asyncTests) {
    try {
      await run();
      console.log(`PASS ${name}`);
    } catch (err) {
      failures += 1;
      console.error(`FAIL ${name}`);
      console.error(err);
    }
  }
  if (failures) process.exit(1);
  console.log(`TOTP startup checks passed (${tests.length + asyncTests.length}).`);
})();
