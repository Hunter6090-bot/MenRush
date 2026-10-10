/**
 * TOTP wrap-key checks (no DB). Keys are random per run: nothing real is in this file.
 *   npm run test:totp-crypto
 */
import assert from 'assert';
import crypto from 'crypto';
import {
  TOTP_DECRYPT_FAILED_MESSAGE,
  TotpCryptoError,
  decryptTotpSecret,
  decryptTotpSecretDetailed,
  deriveV1Key,
  deriveV2Key,
  encryptTotpSecret,
  encryptTotpSecretWith,
  isRawBase64Key,
} from '../src/security/totp-crypto';

const SECRET = 'JBSWY3DPEHPK3PXP';
const passphrase = () => `test-passphrase-${crypto.randomBytes(12).toString('hex')}`;
const base64Key = () => crypto.randomBytes(32).toString('base64');

/** The exact pre-v2 encrypt (main before this PR), to prove old rows still read. */
function legacyEncrypt(secret: string, raw: string): string {
  const key = crypto.createHash('sha256').update(raw).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return `${iv.toString('base64')}.${cipher.getAuthTag().toString('base64')}.${enc.toString('base64')}`;
}

const ENV_KEYS = ['TOTP_ENCRYPTION_KEY', 'TOTP_ENCRYPTION_KEY_PREVIOUS', 'JWT_SECRET'] as const;
function withEnv(env: Partial<Record<(typeof ENV_KEYS)[number], string>>, run: () => void) {
  const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  try {
    for (const k of ENV_KEYS) {
      if (env[k] === undefined) delete process.env[k];
      else process.env[k] = env[k];
    }
    run();
  } finally {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k] as string;
    }
  }
}

function assertFriendly(run: () => unknown, failure?: string) {
  assert.throws(run, (err: unknown) => {
    assert.ok(err instanceof TotpCryptoError, 'TotpCryptoError');
    assert.equal(err.message, TOTP_DECRYPT_FAILED_MESSAGE);
    assert.ok(!/unsupported state|unable to authenticate|openssl|gcm/i.test(err.message), 'no OpenSSL text');
    if (failure) assert.equal(err.failure, failure);
    return true;
  });
}

const tests: [string, () => void][] = [
  ['v1 row written by the old code reads with the current key (no rotation flag)', () => {
    const a = passphrase();
    const stored = legacyEncrypt(SECRET, a);
    withEnv({ TOTP_ENCRYPTION_KEY: a, JWT_SECRET: passphrase() }, () => {
      const r = decryptTotpSecretDetailed(stored);
      assert.deepEqual([r.secret, r.version, r.keySlot, r.needsReencrypt], [SECRET, 'v1', 'current', false]);
    });
  }],
  ['v1 row reads via TOTP_ENCRYPTION_KEY_PREVIOUS after the key changes, flagged for re-encrypt', () => {
    const oldKey = passphrase();
    const stored = legacyEncrypt(SECRET, oldKey);
    withEnv({ TOTP_ENCRYPTION_KEY: base64Key(), TOTP_ENCRYPTION_KEY_PREVIOUS: oldKey }, () => {
      const r = decryptTotpSecretDetailed(stored);
      assert.deepEqual([r.secret, r.version, r.keySlot, r.needsReencrypt], [SECRET, 'v1', 'previous', true]);
    });
  }],
  ['v1 under the current key is flagged only while a previous key is set (rotation)', () => {
    const a = passphrase();
    const stored = legacyEncrypt(SECRET, a);
    withEnv({ TOTP_ENCRYPTION_KEY: a, TOTP_ENCRYPTION_KEY_PREVIOUS: passphrase() }, () => {
      assert.equal(decryptTotpSecretDetailed(stored).needsReencrypt, true);
    });
  }],
  ['new writes are v2: and read back with the current key', () => {
    withEnv({ TOTP_ENCRYPTION_KEY: base64Key() }, () => {
      const stored = encryptTotpSecret(SECRET);
      assert.ok(stored.startsWith('v2:'));
      assert.equal(stored.slice(3).split('.').length, 3);
      const r = decryptTotpSecretDetailed(stored);
      assert.deepEqual([r.secret, r.version, r.keySlot, r.needsReencrypt], [SECRET, 'v2', 'current', false]);
    });
  }],
  ['v2 with a passphrase key (today\'s style) works too', () => {
    withEnv({ TOTP_ENCRYPTION_KEY: passphrase() }, () => {
      assert.equal(decryptTotpSecret(encryptTotpSecret(SECRET)), SECRET);
    });
  }],
  ['32-byte base64 key is used raw for v2; v1 keeps SHA-256 so old rows are unaffected', () => {
    const k = base64Key();
    assert.equal(isRawBase64Key(k), true);
    assert.deepEqual(deriveV2Key(k), Buffer.from(k, 'base64'));
    assert.deepEqual(deriveV1Key(k), crypto.createHash('sha256').update(k).digest());
    assert.equal(isRawBase64Key('not-a-key'), false);
    assert.equal(isRawBase64Key(crypto.randomBytes(16).toString('base64')), false);
    const pass = passphrase();
    assert.deepEqual(deriveV2Key(pass), crypto.createHash('sha256').update(pass).digest());
  }],
  ['JWT_SECRET fallback kept when TOTP_ENCRYPTION_KEY is unset', () => {
    const jwt = passphrase();
    const legacy = legacyEncrypt(SECRET, jwt);
    withEnv({ JWT_SECRET: jwt }, () => {
      assert.equal(decryptTotpSecret(legacy), SECRET);
      assert.equal(decryptTotpSecret(encryptTotpSecret(SECRET)), SECRET);
    });
  }],
  ['wrong key: fixed friendly message, failure=key, no OpenSSL text', () => {
    const stored = legacyEncrypt(SECRET, passphrase());
    withEnv({ TOTP_ENCRYPTION_KEY: passphrase(), TOTP_ENCRYPTION_KEY_PREVIOUS: passphrase() }, () => {
      assertFriendly(() => decryptTotpSecret(stored), 'key');
    });
  }],
  ['damaged ciphertext: friendly message, failure=format', () => {
    withEnv({ TOTP_ENCRYPTION_KEY: passphrase() }, () => {
      assertFriendly(() => decryptTotpSecret('not.valid'), 'format');
      assertFriendly(() => decryptTotpSecret('v2:only-one-part'), 'format');
    });
  }],
  ['explicit-key helpers round-trip both versions', () => {
    const k = base64Key();
    for (const v of ['v1', 'v2'] as const) {
      withEnv({ TOTP_ENCRYPTION_KEY: k }, () => {
        assert.equal(decryptTotpSecret(encryptTotpSecretWith(SECRET, k, v)), SECRET);
      });
    }
  }],
  ['service and routes never pass raw crypto errors to the client', () => {
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    const svc = fs.readFileSync(path.join(__dirname, '../src/services/two-factor.service.ts'), 'utf8');
    assert.ok(!/decryptTotpSecret\(/.test(svc), 'service uses openStored, not bare decrypt');
    assert.ok(/console\.warn\(`\[2fa\] decrypt failed user=\$\{userId\} failure=\$\{failure\}`\)/.test(svc));
    assert.ok(/WHERE id = \$2 AND totp_secret_encrypted = \$3/.test(svc), 'lazy re-encrypt is guarded');
  }],
  ['rotate script takes keys and DATABASE_URL from the environment only, never a local .env', () => {
    const fs = require('fs') as typeof import('fs');
    const os = require('os') as typeof import('os');
    const path = require('path') as typeof import('path');
    const { spawnSync } = require('child_process') as typeof import('child_process');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'totp-env-'));
    const fakeKey = passphrase();
    fs.writeFileSync(path.join(dir, '.env'),
      `DATABASE_URL=postgresql://dotenv-user:dotenv-pass@dotenv-host.invalid:5432/x\nTOTP_ENCRYPTION_KEY=${fakeKey}\nJWT_SECRET=${fakeKey}\n`);
    const env: NodeJS.ProcessEnv = { ...process.env };
    for (const k of ['DATABASE_URL', 'TOTP_ENCRYPTION_KEY', 'TOTP_ENCRYPTION_KEY_PREVIOUS', 'JWT_SECRET']) delete env[k];
    const tsNode = path.join(__dirname, '../node_modules/.bin/ts-node');
    const run = spawnSync(tsNode, ['--transpile-only', path.join(__dirname, 'rotate-totp-key.ts')], { cwd: dir, env, encoding: 'utf8', timeout: 60_000 });
    fs.rmSync(dir, { recursive: true, force: true });
    const out = `${run.stdout}${run.stderr}`;
    assert.equal(run.status, 2, out);
    assert.match(out, /DATABASE_URL is not set in the environment/);
    assert.ok(!out.includes(fakeKey) && !out.includes('dotenv-pass') && !out.includes('dotenv-host'), 'nothing from .env printed or used');
  }],
  ['rotate script source never prints process.env', () => {
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    for (const f of ['scripts/rotate-totp-key.ts', 'src/security/totp-rotation.ts']) {
      const src = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
      const printed = src.match(/console\.(log|error|warn|info)\([^;]*;/g) ?? [];
      for (const call of printed) assert.ok(!/process\.env|secret|stored|row\.id|\bkey\b\s*[,)]/.test(call), `${f}: ${call}`);
    }
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
console.log(`TOTP crypto checks passed (${tests.length}).`);
