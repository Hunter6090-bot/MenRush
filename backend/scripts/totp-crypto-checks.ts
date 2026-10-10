/**
 * TOTP wrap-key checks (no DB). Keys are random per run: nothing real is in this file.
 *   npm run test:totp-crypto
 */
import assert from 'assert';
import crypto from 'crypto';
import {
  TOTP_DECRYPT_FAILED_MESSAGE,
  TOTP_UNAVAILABLE_MESSAGE,
  TotpCryptoError,
  decryptTotpSecret,
  decryptTotpSecretDetailed,
  decryptTotpSecretWith,
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

/** The exact pre-v2 decrypt (main before this PR), to prove rollback rows read on old code. */
function legacyDecrypt(payload: string, raw: string): string {
  const key = crypto.createHash('sha256').update(raw).digest();
  const [ivB64, tagB64, dataB64] = payload.split('.');
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('Invalid encrypted secret');
  const d = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
  d.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([d.update(Buffer.from(dataB64, 'base64')), d.final()]).toString('utf8');
}

const ENV_KEYS = ['TOTP_ENCRYPTION_KEY', 'TOTP_ENCRYPTION_KEY_PREVIOUS', 'JWT_SECRET', 'TOTP_WRITE_FORMAT'] as const;
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
    assert.ok(/console\.warn\(`\[2fa\] decrypt failed failure=\$\{failure\}`\)/.test(svc));
    const logs = svc.match(/console\.(log|warn|error|info)\([^;]*;/g) ?? [];
    assert.ok(logs.length >= 3);
    for (const call of logs) assert.ok(!/user=|userId|user_id|\.id\b|email/.test(call), `no member id in log: ${call}`);
    const routes = fs.readFileSync(path.join(__dirname, '../src/routes/auth.ts'), 'utf8');
    assert.ok(/if \(error instanceof TotpCryptoError\) \{\s*const text = error\.failure === 'config' \? TOTP_UNAVAILABLE_MESSAGE : TOTP_DECRYPT_FAILED_MESSAGE;\s*return res\.status\(503\)\.json\(\{ error: text \}\);/.test(routes), '/2fa/verify sends only a fixed text, 503');
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
  ['open() needs a 12-byte IV, a 16-byte tag, strict base64 and a ciphertext; anything else is format', () => {
    const k = passphrase();
    withEnv({ TOTP_ENCRYPTION_KEY: k }, () => {
      const good = encryptTotpSecretWith(SECRET, k, 'v1');
      assert.equal(decryptTotpSecret(good), SECRET);
      const [iv, tag, ct] = good.split('.');
      assert.equal(Buffer.from(iv, 'base64').length, 12);
      assert.equal(Buffer.from(tag, 'base64').length, 16);
      const b = (n: number) => crypto.randomBytes(n).toString('base64');
      const bad = [
        `${b(16)}.${tag}.${ct}`, // 16-byte IV
        `${b(8)}.${tag}.${ct}`, // 8-byte IV
        `${iv}.${b(12)}.${ct}`, // 12-byte (truncated) tag
        `${iv}.${b(4)}.${ct}`, // 4-byte tag
        `${iv}.${tag.slice(0, -4)}.${ct}`, // tag cut short
        `${iv}.${b(17)}.${ct}`, // 17-byte tag
        `${iv}.${tag}.`, // no ciphertext
        `${iv}!.${tag}.${ct}`, // not strict base64
        `${iv}.${tag}.${ct}.extra`, // four parts
        `v2:${b(16)}.${tag}.${ct}`, // v2 with a 16-byte IV
        `v2:${iv}.${b(12)}.${ct}`, // v2 with a short tag
      ];
      for (const p of bad) assertFriendly(() => decryptTotpSecret(p), 'format');
      for (const p of bad) assertFriendly(() => decryptTotpSecretWith(p, k), 'format');
    });
  }],
  ['TOTP_WRITE_FORMAT=v1 (code rollback): writes are v1 under the current key, readable by the pre-v2 code', () => {
    const k = base64Key();
    withEnv({ TOTP_ENCRYPTION_KEY: k, TOTP_WRITE_FORMAT: 'v1' }, () => {
      const stored = encryptTotpSecret(SECRET);
      assert.ok(!stored.startsWith('v2:'));
      assert.equal(legacyDecrypt(stored, k), SECRET, 'pre-v2 code reads it');
      // v2 under current is stale in v1 mode, even with no previous key.
      const v2 = encryptTotpSecretWith(SECRET, k, 'v2');
      assert.equal(decryptTotpSecretDetailed(v2).needsReencrypt, true);
      assert.equal(decryptTotpSecretDetailed(stored).needsReencrypt, false, 'v1 under current is final');
    });
    const old = passphrase();
    withEnv({ TOTP_ENCRYPTION_KEY: k, TOTP_ENCRYPTION_KEY_PREVIOUS: old, TOTP_WRITE_FORMAT: 'v1' }, () => {
      const r = decryptTotpSecretDetailed(encryptTotpSecretWith(SECRET, old, 'v1'));
      assert.deepEqual([r.keySlot, r.needsReencrypt], ['previous', true], 'v1 under the previous key is moved to current');
    });
  }],
  ['default write format: v2 under current with a previous key set is final (no endless rewrite)', () => {
    const k = base64Key();
    withEnv({ TOTP_ENCRYPTION_KEY: k, TOTP_ENCRYPTION_KEY_PREVIOUS: passphrase() }, () => {
      assert.equal(decryptTotpSecretDetailed(encryptTotpSecret(SECRET)).needsReencrypt, false);
    });
  }],
  ['failure copy is honest and helpful: our fault, code may be right, support email, no impossible steps, no dashes', () => {
    for (const msg of [TOTP_DECRYPT_FAILED_MESSAGE, TOTP_UNAVAILABLE_MESSAGE]) {
      assert.match(msg, /problem on our side/);
      assert.match(msg, /support@menrush\.com/);
      assert.ok(!/trusted device|turn (it |2fa |two-factor )?off|disable|beta/i.test(msg), msg);
      assert.ok(!/[\u2013\u2014]/.test(msg), 'no en or em dashes');
    }
    assert.match(TOTP_DECRYPT_FAILED_MESSAGE, /your code may be right/);
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    const login = fs.readFileSync(path.join(__dirname, '../../frontend/src/pages/Login.tsx'), 'utf8');
    assert.ok(/pendingToken \? 'text-\[15px\]/.test(login), '2FA step error is 15px');
    const settings = fs.readFileSync(path.join(__dirname, '../../frontend/src/components/TwoFactorSettings.tsx'), 'utf8');
    assert.ok(/\{error \? <p className="text-\[15px\]/.test(settings), '2FA settings error is 15px');
  }],
  ['rotate script needs NODE_ENV set explicitly, production for Railway, and --confirm-production to write there', () => {
    const fs = require('fs') as typeof import('fs');
    const os = require('os') as typeof import('os');
    const path = require('path') as typeof import('path');
    const { spawnSync } = require('child_process') as typeof import('child_process');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'totp-gate-'));
    const tsNode = path.join(__dirname, '../node_modules/.bin/ts-node');
    const run = (extra: NodeJS.ProcessEnv, args: string[]) => {
      const env: NodeJS.ProcessEnv = { ...process.env, TOTP_ENCRYPTION_KEY: passphrase(), ...extra };
      if (extra.NODE_ENV === undefined) delete env.NODE_ENV;
      const r = spawnSync(tsNode, ['--transpile-only', path.join(__dirname, 'rotate-totp-key.ts'), ...args], { cwd: dir, env, encoding: 'utf8', timeout: 60_000 });
      return { status: r.status, out: `${r.stdout}${r.stderr}` };
    };
    // Nothing below ever connects: each run is refused before the first query.
    const railway = 'postgresql://u:p@postgres.railway.internal:5432/railway';
    const local = 'postgresql://u:p@127.0.0.1:1/none';
    let r = run({ DATABASE_URL: local }, []);
    assert.equal(r.status, 2, r.out); assert.match(r.out, /set NODE_ENV explicitly/);
    r = run({ DATABASE_URL: railway, NODE_ENV: 'development' }, []);
    assert.equal(r.status, 2, r.out); assert.match(r.out, /Railway database but NODE_ENV is not production/);
    r = run({ DATABASE_URL: railway, NODE_ENV: 'production' }, ['--apply']);
    assert.equal(r.status, 2, r.out); assert.match(r.out, /without --confirm-production/);
    r = run({ DATABASE_URL: railway, NODE_ENV: 'production' }, ['--reverse']);
    assert.equal(r.status, 2, r.out); assert.match(r.out, /without --confirm-production/);
    r = run({ DATABASE_URL: local, NODE_ENV: 'test' }, ['--aply']);
    assert.equal(r.status, 2, r.out); assert.match(r.out, /Unknown option/);
    assert.ok(!r.out.includes('--aply'), 'unknown flags are counted, not echoed');
    fs.rmSync(dir, { recursive: true, force: true });
  }],
  ['runbook: real order, --confirm-production on every write, --reverse needs TOTP_WRITE_FORMAT=v1', () => {
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    const doc = fs.readFileSync(path.join(__dirname, '../../docs/totp-key-rotation.md'), 'utf8');
    const header = fs.readFileSync(path.join(__dirname, 'rotate-totp-key.ts'), 'utf8').split('*/')[0];
    for (const text of [doc, header]) {
      for (const line of text.split('\n')) {
        if (/totp:rotate\b.*--(apply|reverse)\b/.test(line)) {
          assert.ok(line.includes('--confirm-production'), `write command without --confirm-production: ${line.trim()}`);
        }
      }
      assert.ok(!/being revised|to be revised|\bTBD\b|\bTODO\b/i.test(text), 'no placeholder runbook text');
      assert.match(text, /--reverse[^\n]*\n?[^\n]*TOTP_WRITE_FORMAT=v1/, '--reverse is described with its v1 requirement');
    }
    const order = ['## 1. Deploy', '## 2. Rotate', '## 3. Verify', '## 4. Key rollback', '## 5. Code rollback'];
    let at = -1;
    for (const heading of order) {
      const i = doc.indexOf(heading);
      assert.ok(i > at, `runbook section in order: ${heading}`);
      at = i;
    }
    const code = doc.slice(doc.indexOf('## 5. Code rollback'));
    const v1 = code.indexOf('TOTP_WRITE_FORMAT=v1');
    const reverse = code.indexOf('--reverse --confirm-production');
    const revert = code.indexOf('Revert the code');
    assert.ok(v1 > 0 && reverse > v1 && revert > reverse, 'code rollback: v1 writes, then --reverse, then revert');
    assert.ok(!/[\u2013\u2014]/.test(doc), 'no en or em dashes');
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
