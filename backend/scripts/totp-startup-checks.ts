/**
 * Production refuses to start without a real 2FA wrap key, and drops the JWT_SECRET fallback.
 * No real key is in this file: test keys are random per run, and the dev default is matched by
 * fingerprint (set TOTP_DEV_DEFAULT_FOR_TEST locally to check it by value).
 *   npm run test:totp-startup
 */
import assert from 'assert';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import {
  TotpCryptoError,
  assertTotpKeyForProduction,
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
    refuses(prod('short-passphrase'), 'too-short');
    refuses(prod(crypto.randomBytes(16).toString('base64')), 'too-short');
    refuses(prod(crypto.randomBytes(24).toString('base64')), 'too-short'); // 32 chars, 24 bytes
    refuses(prod('x'.repeat(31)), 'too-short');
  }],
  ['production refuses the dev default and the .env.example placeholders', () => {
    const examples = [path.join(__dirname, '../.env.example'), path.join(__dirname, '../../.env.example')];
    const placeholders = examples
      .filter((f) => fs.existsSync(f))
      .flatMap((f) => fs.readFileSync(f, 'utf8').split('\n'))
      .map((l) => l.match(/^JWT_SECRET=(.+)$/)?.[1]?.trim())
      .filter((v): v is string => !!v);
    assert.ok(placeholders.length >= 2, 'found the JWT_SECRET placeholders');
    for (const p of placeholders) refuses(prod(p), 'dev-default');
    const devDefault = process.env.TOTP_DEV_DEFAULT_FOR_TEST;
    if (devDefault) refuses(prod(devDefault), 'dev-default');
    const src = fs.readFileSync(path.join(__dirname, '../src/security/totp-crypto.ts'), 'utf8');
    assert.ok(src.includes('10e6d89d6d7eebfd625259c422fce843606b2949c67786f21312ea5eaadb90ff'), 'dev default fingerprint listed');
    assert.ok(!/menrush-dev-secret/i.test(src), 'the dev default value itself is not in the code');
  }],
  ['production accepts a 32-byte base64 key, a 64-char hex key, or a long passphrase', () => {
    assert.doesNotThrow(() => assertTotpKeyForProduction(prod(crypto.randomBytes(32).toString('base64'))));
    assert.doesNotThrow(() => assertTotpKeyForProduction(prod(crypto.randomBytes(32).toString('hex'))));
    assert.doesNotThrow(() => assertTotpKeyForProduction(prod(`a long passphrase ${crypto.randomBytes(16).toString('hex')}`)));
    assert.equal(totpKeyByteLength(crypto.randomBytes(32).toString('base64')), 32);
    assert.equal(totpKeyProblem(crypto.randomBytes(32).toString('base64')), null);
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
if (failures) process.exit(1);
console.log(`TOTP startup checks passed (${tests.length}).`);
