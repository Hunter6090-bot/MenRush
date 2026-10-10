/**
 * Checks for the seed safety gate (scripts/seed-guard.ts) and the seed source. No DB.
 * - Refuses production (NODE_ENV, Railway production env, Railway or production-looking hosts).
 * - Refuses an unset or short SEED_TEST_PASSWORD; there is no default.
 * - The seed never updates password_hash on conflict and never prints a password, email or id.
 * - The old public test password is in no tracked file (matched by SHA-256, never stored here).
 * The real-PG behaviour (existing passwords kept) is in scripts/seed-test-users-integration.ts.
 */
import assert from 'assert';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { execFileSync, spawnSync } from 'child_process';
import { seedRefusal, isRailwayHost, looksLikeProductionHost, SEED_PASSWORD_MIN } from './seed-guard';

/** SHA-256 of the old hardcoded seed password (public in git history). The value is not here. */
const OLD_PASSWORD_SHA256 = '59232fd91457b0e77dd75a0441b12442925ac5d66e26fa47363b6a561379181b';

const LOCAL = 'postgresql://menrush:menrush@localhost:5432/menrush';
const PW = 'a-local-test-password-123';
const ok = (extra: NodeJS.ProcessEnv = {}) => ({ DATABASE_URL: LOCAL, SEED_TEST_PASSWORD: PW, ...extra });

const tests: [string, () => void][] = [
  ['local DB with a password: allowed', () => {
    assert.equal(seedRefusal(ok()), null);
    assert.equal(seedRefusal(ok({ NODE_ENV: 'development' })), null);
    assert.equal(seedRefusal(ok({ NODE_ENV: 'test', DATABASE_URL: 'postgresql://u:p@127.0.0.1:5432/menrush_ci' })), null);
  }],
  ['NODE_ENV=production: refused (any case, spaces)', () => {
    assert.equal(seedRefusal(ok({ NODE_ENV: 'production' })), 'node-env-production');
    assert.equal(seedRefusal(ok({ NODE_ENV: ' Production ' })), 'node-env-production');
  }],
  ['Railway production environment: refused', () => {
    assert.equal(seedRefusal(ok({ RAILWAY_ENVIRONMENT_NAME: 'production' })), 'railway-production');
    assert.equal(seedRefusal(ok({ RAILWAY_ENVIRONMENT: 'production' })), 'railway-production');
  }],
  ['Railway hosts: refused (internal, public proxy, app)', () => {
    for (const host of ['postgres.railway.internal', 'monorail.proxy.rlwy.net', 'shinkansen.proxy.rlwy.net', 'x.up.railway.app']) {
      assert.ok(isRailwayHost(host), host);
      assert.equal(seedRefusal(ok({ DATABASE_URL: `postgresql://u:p@${host}:5432/railway` })), 'railway-host', host);
    }
    assert.ok(!isRailwayHost('railway.example.com'));
  }],
  ['production-looking hosts: refused', () => {
    for (const host of ['db.prod.menrush.com', 'menrush-production.db.example.net', 'live-db.example.com']) {
      assert.ok(looksLikeProductionHost(host), host);
      assert.equal(seedRefusal(ok({ DATABASE_URL: `postgresql://u:p@${host}:5432/menrush` })), 'production-host', host);
    }
    assert.ok(!looksLikeProductionHost('localhost'));
    assert.ok(!looksLikeProductionHost('products-dev.example.com'), 'a word containing prod is not a prod label');
  }],
  ['no DATABASE_URL or a bad one: refused', () => {
    assert.equal(seedRefusal({ SEED_TEST_PASSWORD: PW }), 'no-database-url');
    assert.equal(seedRefusal(ok({ DATABASE_URL: 'not a url' })), 'bad-database-url');
  }],
  ['password: unset, blank or short is refused; no default anywhere', () => {
    assert.equal(seedRefusal({ DATABASE_URL: LOCAL }), 'no-password');
    assert.equal(seedRefusal(ok({ SEED_TEST_PASSWORD: '   ' })), 'no-password');
    assert.equal(seedRefusal(ok({ SEED_TEST_PASSWORD: 'x'.repeat(SEED_PASSWORD_MIN - 1) })), 'short-password');
  }],
  ['seed source: password set on insert only, no hardcoded password, prints no secrets', () => {
    const src = fs.readFileSync(path.join(__dirname, 'seed-test-users.ts'), 'utf8');
    assert.ok(!/password_hash\s*=\s*EXCLUDED/i.test(src), 'never updates password_hash on conflict');
    assert.ok(!/\bconst\s+TEST_PASSWORD\b/.test(src), 'no hardcoded TEST_PASSWORD constant');
    assert.ok(!/password\s*:\s*['"`]/.test(src), 'no per-user hardcoded password');
    assert.ok(/ON CONFLICT DO NOTHING/.test(src), 'non-fixture accounts are insert-only');
    for (const line of src.split('\n').filter((l) => /console\.(log|error|warn)/.test(l))) {
      assert.ok(!/\$\{[^}]*(password|email|\.id\b|hash)[^}]*\}/i.test(line), `no secret interpolated in: ${line.trim()}`);
    }
    assert.ok(src.indexOf('seedRefusal(process.env)') < src.indexOf("require('../src/db')"), 'gate runs before the DB module loads');
  }],
  ['the old public test password is in no tracked file', () => {
    const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
    const files = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
    let hits = 0;
    for (const f of files) {
      if (/\.(png|jpe?g|gif|webp|mp4|mov|woff2?|ico|pdf|zip)$/i.test(f)) continue;
      let text: string;
      try { text = fs.readFileSync(path.join(root, f), 'utf8'); } catch { continue; }
      for (const token of text.match(/[A-Za-z0-9!@#$%^&*_+=.-]{8,64}/g) ?? []) {
        if (crypto.createHash('sha256').update(token).digest('hex') === OLD_PASSWORD_SHA256) { hits += 1; console.error(`old password found in ${f}`); }
      }
    }
    assert.equal(hits, 0);
  }],
  ['the real script refuses before connecting (production, Railway host, no password)', () => {
    const run = (env: NodeJS.ProcessEnv) => spawnSync('npx', ['ts-node', '--transpile-only', path.join(__dirname, 'seed-test-users.ts')], {
      env: { PATH: process.env.PATH, HOME: process.env.HOME, DOTENV_CONFIG_PATH: '/nonexistent', ...env }, encoding: 'utf8', cwd: path.join(__dirname, '..'),
    });
    for (const [env, re] of [
      [ok({ NODE_ENV: 'production' }), /NODE_ENV is production/],
      [ok({ DATABASE_URL: 'postgresql://u:p@postgres.railway.internal:5432/railway' }), /Railway database/],
      [{ DATABASE_URL: 'postgresql://u:p@127.0.0.1:1/none' }, /SEED_TEST_PASSWORD is not set/],
    ] as const) {
      const r = run(env);
      assert.equal(r.status, 2, `${r.stdout}${r.stderr}`);
      assert.match(`${r.stderr}`, re);
      assert.ok(!`${r.stdout}${r.stderr}`.includes(PW), 'never echoes the password');
    }
  }],
];

let failures = 0;
for (const [name, run] of tests) {
  try { run(); console.log(`PASS ${name}`); } catch (err) { failures += 1; console.error(`FAIL ${name}`); console.error(err); }
}
if (failures) process.exit(1);
console.log(`Seed safety checks passed (${tests.length}).`);
