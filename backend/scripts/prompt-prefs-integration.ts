/**
 * Integration: users.prompt_prefs (migration 074) and /api/prompt-prefs on Postgres.
 * Needs a migrated DATABASE_URL (schema.sql + migrations). Skips without one.
 *   DATABASE_URL=postgresql://menrush:menrush123@localhost:5432/menrush \
 *   npx ts-node --transpile-only scripts/prompt-prefs-integration.ts
 */
import assert from 'assert';
import http from 'http';
import { randomUUID } from 'crypto';

if (!process.env.DATABASE_URL) {
  console.log('prompt-prefs-integration: SKIPPED (no DATABASE_URL)');
  process.exit(0);
}
process.env.JWT_SECRET = process.env.JWT_SECRET || 'prompt-prefs-integration-test';

async function main() {
  const express = (await import('express')).default;
  const { default: pool, query } = await import('../src/db');
  const { default: promptPrefsRoutes } = await import('../src/routes/prompt-prefs');
  const { authService } = await import('../src/services/auth.service');
  const { promptPrefsService } = await import('../src/services/prompt-prefs.service');

  const col = await query(
    `SELECT data_type, is_nullable, column_default
       FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'prompt_prefs'`,
  );
  assert.strictEqual(col.rows.length, 1, 'users.prompt_prefs exists');
  assert.strictEqual(col.rows[0].data_type, 'jsonb');
  assert.strictEqual(col.rows[0].is_nullable, 'NO');
  assert.match(String(col.rows[0].column_default), /'\{\}'/);

  const ids: string[] = [];
  async function makeUser(name: string) {
    const id = randomUUID();
    ids.push(id);
    await query(
      `INSERT INTO users (id, email, password_hash, name, age)
       VALUES ($1, $2, 'x', $3, 30)`,
      [id, `pp-${id.slice(0, 8)}@test.menrush.local`, name],
    );
    return id;
  }

  const app = express();
  app.use(express.json());
  app.use('/api/prompt-prefs', promptPrefsRoutes);
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}/api/prompt-prefs`;
  const call = (path: string, method: string, token: string) =>
    fetch(`${base}${path}`, { method, headers: { Authorization: `Bearer ${token}` } });

  try {
    const a = await makeUser('PP A');
    const b = await makeUser('PP B');
    const ta = authService.issueAccessToken(a);
    const tb = authService.issueAccessToken(b);

    const fresh = await query(`SELECT prompt_prefs FROM users WHERE id = $1`, [a]);
    assert.deepStrictEqual(fresh.rows[0].prompt_prefs, {}, 'default is {}');

    let res = await call('', 'GET', ta);
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(await res.json(), { never: [] });

    res = await call('/install/never', 'PUT', ta);
    assert.deepStrictEqual(await res.json(), { never: ['install'] });
    res = await call('/profile/never', 'PUT', ta);
    assert.deepStrictEqual(await res.json(), { never: ['install', 'profile'] });
    res = await call('/install/never', 'PUT', ta);
    assert.deepStrictEqual(await res.json(), { never: ['install', 'profile'] }, 'idempotent');

    // "Another device": a new request with a new token for the same member.
    res = await call('', 'GET', authService.issueAccessToken(a));
    assert.deepStrictEqual(await res.json(), { never: ['install', 'profile'] });

    res = await call('', 'GET', tb);
    assert.deepStrictEqual(await res.json(), { never: [] }, 'member B untouched');

    res = await call('/chips/never', 'PUT', ta);
    assert.strictEqual(res.status, 400);
    const stored = await query(`SELECT prompt_prefs FROM users WHERE id = $1`, [a]);
    assert.deepStrictEqual(stored.rows[0].prompt_prefs, { install: 'never', profile: 'never' });

    // Stray keys written by anything else never leave the server.
    await query(`UPDATE users SET prompt_prefs = prompt_prefs || '{"chips":"never","alerts":"x"}'::jsonb WHERE id = $1`, [b]);
    assert.deepStrictEqual(await promptPrefsService.getNever(b), []);
  } finally {
    server.close();
    if (ids.length) await query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [ids]);
    await pool.end();
  }

  console.log('prompt-prefs-integration: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
