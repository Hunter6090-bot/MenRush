/**
 * Integration (real Postgres): the seed never changes an existing account's password.
 * - An existing non-fixture account (one of the seed's team entries) is left completely
 *   untouched: same password hash, same name, same profile.
 * - An existing e2e fixture keeps its password hash; only its profile fields refresh.
 * - A new account gets SEED_TEST_PASSWORD.
 * - A second run with a different password changes no password at all.
 * - Output has no password, email or id.
 * Emails are read from the seed file in memory and never printed.
 * Needs a migrated DATABASE_URL; skips without one.
 */
import assert from 'assert';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import bcrypt from 'bcryptjs';

if (!process.env.DATABASE_URL) {
  console.log('seed-test-users-integration: SKIPPED (no DATABASE_URL)');
  process.exit(0);
}

const seedSrc = fs.readFileSync(path.join(__dirname, 'seed-test-users.ts'), 'utf8');
const seedEmails = [...seedSrc.matchAll(/email: '([^']+)'/g)].map((m) => m[1].toLowerCase());
const team = seedEmails.filter((e) => !e.endsWith('@example.com'));
const fixtures = seedEmails.filter((e) => e.endsWith('@example.com'));

function runSeed(password: string) {
  return spawnSync('npx', ['ts-node', '--transpile-only', path.join(__dirname, 'seed-test-users.ts')], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, NODE_ENV: 'test', SEED_TEST_PASSWORD: password, RAILWAY_ENVIRONMENT_NAME: '', RAILWAY_ENVIRONMENT: '' },
    encoding: 'utf8',
  });
}

async function main() {
  const { default: pool, query } = await import('../src/db');
  assert.ok(team.length >= 1 && fixtures.length >= 2, 'seed has team and fixture entries');
  const existingTeam = team[0];
  const existingFixture = fixtures[0];
  const newFixture = fixtures[1];
  const all = [...team, ...fixtures];
  const hashOf = async (email: string) => (await query(`SELECT password_hash FROM users WHERE LOWER(email) = $1`, [email])).rows[0]?.password_hash as string | undefined;

  try {
    await query(`DELETE FROM users WHERE LOWER(email) = ANY($1::text[])`, [all]);
    const teamHash = await bcrypt.hash(`existing-team-${crypto.randomBytes(8).toString('hex')}`, 4);
    const fixtureHash = await bcrypt.hash(`existing-fixture-${crypto.randomBytes(8).toString('hex')}`, 4);
    const teamId = crypto.randomUUID();
    await query(
      `INSERT INTO users (id, email, password_hash, name, age, bio) VALUES ($1, $2, $3, 'Kept Name', 40, 'kept bio')`,
      [teamId, existingTeam, teamHash],
    );
    await query(`INSERT INTO profiles (user_id, online, is_visible, is_ghost) VALUES ($1, FALSE, FALSE, TRUE)`, [teamId]);
    await query(
      `INSERT INTO users (id, email, password_hash, name, age, bio) VALUES ($1, $2, $3, 'Old Fixture', 50, 'old bio')`,
      [crypto.randomUUID(), existingFixture, fixtureHash],
    );

    const pw1 = `seed-${crypto.randomBytes(12).toString('hex')}`;
    const r1 = runSeed(pw1);
    const out1 = `${r1.stdout}${r1.stderr}`;
    assert.equal(r1.status, 0, 'seed run 1 exits 0');
    assert.match(out1, /untouched=1/);
    for (const e of all) assert.ok(!out1.toLowerCase().includes(e), 'no email in output');
    assert.ok(!out1.includes(pw1), 'no password in output');
    assert.ok(!/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.test(out1), 'no id in output');

    // Existing non-fixture account: completely untouched.
    const t = (await query(
      `SELECT u.password_hash, u.name, u.age, u.bio, p.is_visible, p.is_ghost, p.online
         FROM users u JOIN profiles p ON p.user_id = u.id WHERE u.id = $1`, [teamId])).rows[0];
    assert.deepEqual(
      [t.password_hash === teamHash, t.name, t.age, t.bio, t.is_visible, t.is_ghost, t.online],
      [true, 'Kept Name', 40, 'kept bio', false, true, false],
      'existing team account untouched',
    );
    assert.equal(await bcrypt.compare(pw1, t.password_hash), false, 'seed password does not open the existing account');

    // Existing fixture: password kept, profile refreshed.
    const f = (await query(`SELECT password_hash, bio FROM users WHERE LOWER(email) = $1`, [existingFixture])).rows[0];
    assert.equal(f.password_hash, fixtureHash, 'existing fixture keeps its password');
    assert.notEqual(f.bio, 'old bio', 'fixture profile refreshed');

    // New account: gets the seed password.
    const nh = await hashOf(newFixture);
    assert.ok(nh && (await bcrypt.compare(pw1, nh)), 'new fixture gets SEED_TEST_PASSWORD');

    // Second run with another password: no password changes anywhere.
    const before = await Promise.all(all.map(hashOf));
    const r2 = runSeed(`seed-${crypto.randomBytes(12).toString('hex')}`);
    assert.equal(r2.status, 0, 'seed run 2 exits 0');
    assert.match(`${r2.stdout}`, /created=0/);
    assert.deepEqual(await Promise.all(all.map(hashOf)), before, 'no password changed on re-run');

    console.log('seed-test-users-integration: PASS (existing passwords kept, team account untouched, new account gets env password)');
  } finally {
    await query(`DELETE FROM users WHERE LOWER(email) = ANY($1::text[])`, [all]).catch(() => undefined);
    await pool.end();
  }
}

main().catch((err) => {
  console.error('seed-test-users-integration: FAIL', err instanceof assert.AssertionError ? err.message : 'error');
  process.exit(1);
});
